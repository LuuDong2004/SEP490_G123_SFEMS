import { useCan } from "@refinedev/core";
import { AlertTriangle, ArrowRight, Boxes, Gauge, PackageX, School } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Kpi } from "@/features/dashboard/kpi";
import { ChartCard, DonutBreakdown, GroupedBars, type Slice } from "@/shared/components/charts/charts";
import { count } from "@/shared/lib/chart-palette";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ASSET_STATUS_GROUPS, type Dashboard as DashboardData } from "@/domains/report/types";
import { WithUnit } from "@/shared/components/charts/with-unit";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { LoadingText } from "@/shared/components/spinner";

/** Loại phiếu → màn danh sách của nó. Xuất kho và lưu kho không còn màn nên không liệt kê. */
const VOUCHER_ROUTES: Record<string, string> = {
  equipment_intakes: "/equipment-intakes",
  equipment_allocations: "/equipment-allocations",
  equipment_transfers: "/equipment-transfers",
  equipment_loans: "/equipment-loans",
  damage_reports: "/damage-reports",
  inventory_sessions: "/inventory-sessions",
  disposals: "/disposals",
  purchase_proposals: "/purchase-proposals",
  repair_orders: "/repair-orders",
  warranty_claims: "/warranty-claims",
  maintenance_orders: "/maintenance-orders",
  consumption_records: "/consumption-records",
  room_bookings: "/room-bookings",
};

/** Một loại phiếu đang có phiếu chờ duyệt: bấm mở danh sách nếu tài khoản xem được loại phiếu đó. */
function PendingRow({ kind, label, pending }: { kind: string; label: string; pending: number }) {
  // Loại phiếu không còn màn (xuất kho, lưu kho) vẫn được đếm để tổng khớp với bảng bên cạnh, chỉ không mở được.
  const allowed = useCan({ resource: kind, action: "list" }).data?.can ?? false;
  const mayOpen = allowed && !!VOUCHER_ROUTES[kind];
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <Badge variant="warning">{count.format(pending)}</Badge>
      {mayOpen ? <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" /> : <span className="size-4" />}
    </>
  );
  return mayOpen ? (
    <Link to={VOUCHER_ROUTES[kind]} className="group hover:bg-muted/60 flex items-center gap-3 rounded-md px-2 py-2">{body}</Link>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2">{body}</div>
  );
}

/**
 * Tổng quan của góc nhìn QUẢN LÝ (Sở, UBND): cùng số liệu với bảng điều khiển của
 * trường (`/reports/dashboard`, gộp trên phạm vi của người xem) nhưng đặt câu hỏi của
 * người quản lý địa bàn — trường nào cần chú ý, đáp ứng định mức tới đâu, việc gì đang
 * chờ cơ quan mình — thay vì luồng phiếu hằng ngày của một trường.
 */
export function ManagementOverview({ d, tools }: { d: DashboardData | undefined; tools?: ReactNode }) {
  const k = d?.kpis;
  const byStatus = new Map((d?.statuses ?? []).map((s) => [s.key, s.count]));
  const assetGroups: Slice[] = ASSET_STATUS_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: g.statuses.reduce((s, st) => s + (byStatus.get(st) ?? 0), 0),
  }));

  const waiting = (d?.pending ?? []).filter((p) => p.count > 0);
  const waitingTotal = waiting.reduce((n, p) => n + p.count, 0);

  // Cả trang vừa đúng một màn hình (như một trang trình chiếu): hàng biểu đồ cuối giãn lấp phần còn lại.
  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-4">
      {/* Cùng đầu trang với màn của trường: "Tổng hợp" + phạm vi, ngày và nút bên phải. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tổng hợp
          {d ? <span className="text-muted-foreground ms-3 text-base font-normal">{d.scope}</span> : <LoadingText className="ms-3 align-middle font-normal" />}
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm first-letter:uppercase">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
          {tools}
        </div>
      </div>

      {/* Bốn thẻ số như màn của trường: số to, biểu tượng theo tình trạng, bấm mở màn của con số. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi to="/schools" icon={<School />} label="Trường trong phạm vi"
          value={k ? <WithUnit value={count.format(k.schools)} unit="trường" /> : "…"} />
        <Kpi to="/equipment" icon={<Boxes />} label="Thiết bị trong hệ thống"
          value={k ? <WithUnit value={count.format(k.equipment)} unit="thiết bị" /> : "…"} />
        <Kpi to="/equipment-minimum" icon={<Gauge />} tone={k && k.adequacyPercent < 80 ? "warning" : "good"}
          label="Đáp ứng tối thiểu (trường đã nhập)" value={k ? `${k.adequacyPercent}%` : "…"}
          info="Tỷ lệ thiết bị đã đủ so với danh mục tối thiểu. Chỉ tính trường đã nhập thiết bị."
          meter={k ? { percent: k.adequacyPercent, label: "" } : undefined} />
        <Kpi to="/equipment" icon={<PackageX />} tone={k && k.broken + k.missing > 0 ? "destructive" : "good"}
          label="Hỏng, báo mất" value={k ? <WithUnit value={count.format(k.broken + k.missing)} unit="thiết bị" /> : "…"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><AlertTriangle className="text-warning-text size-4" />Trường cần chú ý</span>}>
          {!d ? (
            <LoadingText className="flex justify-center py-6" />
          ) : d.attention.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Không có trường nào có thiết bị hỏng hoặc mất.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trường</TableHead>
                  <TableHead className="text-right">Thiết bị</TableHead>
                  <TableHead className="text-right">Hỏng</TableHead>
                  <TableHead className="text-right">Mất</TableHead>
                  <TableHead className="text-right">Phiếu chờ duyệt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.attention.map((s) => (
                  <TableRow key={s.id} className={cn("group/row", LIFT_ROW)}>
                    <TableCell>
                      <Link to={`/schools/show/${s.id}`} className="hover:text-primary hover:underline">{s.name}</Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(s.equipment)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(s.broken)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(s.missing)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.pending > 0 ? <Badge variant="warning">{count.format(s.pending)}</Badge> : "0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ChartCard>

        <ChartCard title={waitingTotal ? `Phiếu đang chờ duyệt (${count.format(waitingTotal)})` : "Phiếu đang chờ duyệt"}
          description={
            // Chờ AI duyệt: Sở chỉ duyệt trường Sở quản lý, UBND chỉ duyệt trường trên địa bàn — một con số
            // chung làm người xem tưởng cả chừng ấy phiếu đang chờ mình.
            waitingTotal && d?.waitingAt
              ? d.waitingAt.filter((w) => w.count > 0).map((w) => `${w.label} ${count.format(w.count)}`).join(" · ")
              : undefined
          }>
          {!d ? (
            <LoadingText className="flex justify-center py-6" />
          ) : waiting.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Không có phiếu nào đang chờ duyệt.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {waiting.map((p) => (
                <li key={p.key}>
                  <PendingRow kind={p.key} label={p.label} pending={p.count} />
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Thiết bị toàn địa bàn theo trạng thái">
          <DonutBreakdown items={assetGroups} unit="thiết bị" spread />
        </ChartCard>
        <ChartCard title="Thiết bị ghi tăng 12 tháng">
          {/* Khung cao theo chỗ còn lại của trang; biểu đồ nằm tuyệt đối bên trong nên không tự đẩy khung giãn ra. */}
          <div className="relative min-h-44 flex-1">
            <div className="absolute inset-0">
              <GroupedBars height="aspect-auto h-full" data={d?.months ?? []} xKey="month" xFormatter={(m) => m.slice(0, 2) + "/" + m.slice(5)} series={[
                { key: "intake", label: "Ghi tăng" },
              ]} />
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
