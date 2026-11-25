import { useCan, useGetIdentity } from "@refinedev/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Boxes, ChevronRight, CircleCheck, ClipboardCheck, PackageX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { DashboardError, DashboardSkeleton } from "@/features/dashboard/dashboard-skeleton";
import { Kpi, TONE, type Tone } from "@/features/dashboard/kpi";
import { ManagementOverview } from "@/features/dashboard/management-overview";
import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import {
  ChartCard,
  DonutBreakdown,
  GroupedBars,
  RangeSelect,
  type Slice,
} from "@/shared/components/charts/charts";
import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { count } from "@/shared/lib/chart-palette";

import { Badge } from "@/shared/ui/badge";
import { VOUCHER_ROUTES } from "@/domains/equipment/types";
import { ASSET_STATUS_GROUPS, type Dashboard as DashboardData } from "@/domains/report/types";
import { WithUnit } from "@/shared/components/charts/with-unit";
import { LoadingText } from "@/shared/components/spinner";
import { PinnedCampusBadge } from "@/shared/components/campus/campus";

/** Lọc sẵn "Chờ duyệt" trên danh sách phiếu (cùng dạng tham số `syncWithLocation` của Refine). */
const PENDING_FILTER = "filters[0][field]=status&filters[0][operator]=eq&filters[0][value]=PENDING";

const PERIODS = [
  { value: "month", label: "Tháng này" },
  { value: "quarter", label: "Quý này" },
  { value: "year", label: "Năm nay" },
  { value: "all", label: "Mọi lúc" },
];
type Todo = { key: string; icon: ReactNode; label: string; count: number; to: string; tone: Tone };

/**
 * Bảng điều khiển theo cấp quản lý: cùng một bộ chỉ số, gộp trên phạm vi của
 * người xem — trường thấy trường mình, UBND thấy địa bàn, Sở thấy toàn ngành.
 *
 * <p>Tài khoản không có `reports:read` (giáo viên) thấy lời chào thay vì một
 * màn hình đầy ô trống.
 */
export const Dashboard = () => {
  const { data: identity } = useGetIdentity<{ fullName?: string; username?: string }>();
  const { perspective } = usePerspective();
  const can = useCan({ resource: "reports", action: "list" });
  const mayRead = can.data?.can ?? false;
  const [period, setPeriod] = useState("month");
  // Năm học trên đầu trang: sổ thiết bị tính đến hết năm đó, biểu đồ ghi tăng là 12 tháng của năm đó.
  const { id: yearId } = useSchoolYear();
  const { data, isError, refetch, isFetching } = useQuery({
    queryKey: ["reports", "dashboard", period, yearId],
    enabled: mayRead,
    // Cả cụm câu gộp; quay về trang chủ trong một phút không tính lại.
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => kyInstance.get("reports/dashboard", { signal,  searchParams: { period, ...(yearId != null ? { yearId: String(yearId) } : {}) } }).json<DashboardData>(),
  });
  const d = data && "kpis" in data ? data : undefined;

  // Đang hỏi quyền / chưa có số liệu lần nào: khung chờ đúng bố cục — không vẽ các thẻ trống trông như đã tải xong.
  if (can.isLoading) return <DashboardSkeleton />;
  if (mayRead && !d) return isError ? <DashboardError onRetry={() => void refetch()} retrying={isFetching} /> : <DashboardSkeleton />;

  if (!mayRead) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Xin chào{identity?.fullName ? `, ${identity.fullName}` : ""}</h1>
        <p className="text-muted-foreground">Quản lý thiết bị trường học. Chọn chức năng ở thanh bên trái để bắt đầu.</p>
      </div>
    );
  }

  // Màn tổng hợp không còn nút làm mới / in: số liệu tự làm mới (staleTime), in ở màn báo cáo.
  const tools = null;

  // Không thuộc trường nào (Sở, UBND, ADMIN) thì tổng quan theo địa bàn — cùng số liệu, câu hỏi khác.
  if (perspective !== "school") return <ManagementOverview d={d} tools={tools} />;

  const k = d?.kpis;
  const usable = k ? Math.round((k.inUse / Math.max(k.equipment, 1)) * 100) : 0;

  const byStatus = new Map((d?.statuses ?? []).map((s) => [s.key, s.count]));
  const assetGroups: Slice[] = ASSET_STATUS_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: g.statuses.reduce((s, st) => s + (byStatus.get(st) ?? 0), 0),
  }));

  const v = new Map((d?.vouchers ?? []).map((s) => [s.key, s.count]));
  const voucherSlices: Slice[] = [
    { key: "completed", label: "Hoàn tất", count: v.get("COMPLETED") ?? 0 },
    { key: "approved", label: "Đang thực hiện", count: v.get("APPROVED") ?? 0 },
    { key: "pending", label: "Chờ duyệt", count: v.get("PENDING") ?? 0 },
    { key: "draft", label: "Nháp", count: v.get("DRAFT") ?? 0 },
    { key: "closed", label: "Từ chối, huỷ", count: (v.get("REJECTED") ?? 0) + (v.get("CANCELLED") ?? 0) },
  ];
  const pending = (d?.pending ?? []).filter((p) => p.count > 0).sort((a, b) => b.count - a.count);

  // Việc đang chờ người của trường: mỗi dòng một loại việc, số việc, và lối tới đúng màn làm việc đó.
  const todo: Todo[] = [
    ...pending.map((p) => ({
      key: `pending:${p.key}`,
      icon: <ClipboardCheck />,
      label: `${p.label} chờ duyệt`,
      count: p.count,
      to: `${VOUCHER_ROUTES[p.key]}?${PENDING_FILTER}`,
      tone: "warning" as const,
    })),
  ].filter((t) => t.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tổng hợp
          {d ? <span className="text-muted-foreground ms-3 text-base font-normal">{d.scope}</span> : <LoadingText className="ms-3 align-middle font-normal" />}
          <PinnedCampusBadge className="ms-3 align-middle" />
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm first-letter:uppercase">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
          {tools}
        </div>
      </div>

      {/* Ba con số đứng đầu, mỗi số một thẻ BẤM ĐƯỢC tới màn của nó: tổng thiết bị, việc chờ duyệt, thiết bị mất qua kiểm
          kê. Số bằng 0 ở hai thẻ sau là tin tốt nên biểu tượng chuyển sang xanh. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi to="/equipment" icon={<Boxes />} label="Thiết bị trong hệ thống" value={k ? <WithUnit value={count.format(k.equipment)} unit="thiết bị" /> : "…"}
          meter={k ? { percent: usable, label: `Đang sử dụng ${count.format(k.inUse)} / ${count.format(k.equipment)}`, title: "Số thiết bị Đang sử dụng ÷ tổng thiết bị còn trong hệ thống (không tính thiết bị đã mất)" } : undefined} />
        {/* Ra đúng các phiếu đang chờ (lọc sẵn Chờ duyệt) như mục "Cần xử lý", không phải cả danh sách (E2E-19). */}
        <Kpi to={pending[0] ? `${VOUCHER_ROUTES[pending[0].key]}?${PENDING_FILTER}` : "/equipment-intakes"} icon={<ClipboardCheck />}
          tone={k && k.pendingVouchers > 0 ? "warning" : "good"} label="Phiếu chờ duyệt" value={k ? <WithUnit value={count.format(k.pendingVouchers)} unit="phiếu" /> : "…"} />
        <Kpi to="/equipment" icon={<PackageX />} tone={k && k.missing > 0 ? "destructive" : "good"} label="Mất (theo kiểm kê)"
          value={k ? <WithUnit value={count.format(k.missing)} unit="thiết bị" /> : "…"} />
      </div>

      {/* Chỉ BA khối dưới hàng chỉ số — màn tổng hợp là để nhìn một lượt, không phải để đọc hết mọi con số
          hệ thống có: hai vòng cơ cấu (tài sản đang ở đâu, phiếu đang tới đâu), rồi diễn biến 12 tháng
          cạnh danh sách việc đang chờ. Chi tiết hơn nằm ở từng màn mà các thẻ và dòng dẫn tới. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Thiết bị theo trạng thái">
          <DonutBreakdown items={assetGroups} unit="thiết bị" />
        </ChartCard>
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              Phiếu trong kỳ
              {/* Nói rõ phạm vi: ô này chỉ đếm phiếu LẬP trong kỳ, nên "Chờ duyệt" ở đây có thể ít hơn thẻ
                  "Phiếu chờ duyệt" phía trên — thẻ ấy đếm mọi phiếu đang chờ, kể cả phiếu lập từ kỳ trước. */}
              <HelpHint>Chỉ tính phiếu LẬP trong kỳ đang chọn, mọi loại phiếu.</HelpHint>
            </span>
          }
          action={<RangeSelect value={period} onChange={setPeriod} options={PERIODS} />}>
          <DonutBreakdown items={voucherSlices} unit="phiếu" emptyText="Chưa có phiếu nào trong kỳ" />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2"
          title={
            <span className="flex items-center gap-2">
              Thiết bị ghi tăng 12 tháng
              <HelpHint>Số thiết bị được ghi tăng (phiếu ghi tăng đã duyệt) trong từng tháng.</HelpHint>
            </span>
          }>
          <GroupedBars height="h-64" data={(d?.months ?? []).slice(-12)} xKey="month" xFormatter={(m) => m.slice(0, 2) + "/" + m.slice(5)} series={[
            { key: "intake", label: "Ghi tăng" },
          ]} />
        </ChartCard>
        <ChartCard title="Cần xử lý" action={k ? <Badge variant={todo.length ? "warning" : "success"}>{count.format(todo.reduce((s, t) => s + t.count, 0))}</Badge> : null}>
          {todo.length === 0 ? (
            <div className="text-muted-foreground my-auto flex flex-col items-center gap-2 py-6 text-center text-sm">
              <span className="bg-success-subtle text-success-text flex size-10 items-center justify-center rounded-full"><CircleCheck className="size-5" /></span>
              Không có việc nào đang chờ.
            </div>
          ) : (
            <ul className="-mx-2 -my-1">
              {todo.map((t) => (
                <li key={t.key}>
                  <Link to={t.to} className="hover:bg-muted/60 group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", TONE[t.tone])}>{t.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    <span className="font-semibold tabular-nums">{count.format(t.count)}</span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

    </div>
  );
};
