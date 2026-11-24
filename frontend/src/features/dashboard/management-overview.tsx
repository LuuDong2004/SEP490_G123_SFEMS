import { useCan } from "@refinedev/core";
import { AlertTriangle, ArrowRight, Boxes, Building2, Gauge, School, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Kpi } from "@/features/dashboard/kpi";
import { ChartCard, DonutBreakdown, RangeSelect, GroupedBars, type Slice } from "@/shared/components/charts/charts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { count } from "@/shared/lib/chart-palette";
import { Badge } from "@/shared/ui/badge";
import { ASSET_STATUS_GROUPS, type Dashboard as DashboardData } from "@/domains/report/types";
import { WithUnit } from "@/shared/components/charts/with-unit";
import { LoadingText } from "@/shared/components/spinner";
import { currentPortal } from "@/shared/api/portal";
import { useSchoolYear } from "@/shared/hooks/use-school-year";

/** Loại phiếu → màn danh sách của nó. */
const VOUCHER_ROUTES: Record<string, string> = {
  equipment_intakes: "/equipment-intakes",
  inventory_sessions: "/inventory-sessions",
  purchase_proposals: "/purchase-proposals",
};

/** Một loại phiếu đang có phiếu chờ duyệt: bấm mở danh sách nếu tài khoản xem được loại phiếu đó. */
function PendingRow({ kind, label, pending }: { kind: string; label: string; pending: number }) {
  // Loại phiếu không có màn vẫn được đếm để tổng khớp với bảng bên cạnh, chỉ không mở được.
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
  const admin = currentPortal() === "admin";
  const thisYear = d?.yearCurrent ?? true;
  // Năm học trên đầu trang chỉ đổi biểu đồ ghi tăng; các số khác là số liệu hiện tại.
  const yearName = useSchoolYear().year?.name;
  const [gap, setGap] = useState<string | null>(null);
  const [span, setSpan] = useState(12);
  const gapRows = GAPS.map((g) => {
    const states = (d?.attention ?? []).map(g.state);
    return { key: g.key, label: g.label, missing: states.filter((s) => s === g.missing).length, short: states.filter((s) => s === "Chưa đáp ứng").length };
  });
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
          <span className="text-muted-foreground ms-2 text-sm font-normal">· Số liệu hiện tại</span>
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
          label="Đáp ứng tối thiểu" value={k ? (thisYear ? `${k.adequacyPercent}%` : "—") : "…"}
          info={thisYear ? "Tỷ lệ thiết bị đã đủ so với danh mục tối thiểu. Chỉ tính trường đã nhập thiết bị." : NOT_YET}
          meter={k ? { percent: thisYear ? k.adequacyPercent : 0, label: "" } : undefined} />
        <Kpi to="/reports/facility-standard" icon={<Building2 />} tone={k && k.facilityPercent < 80 ? "warning" : "good"}
          label="Đạt chuẩn CSVC" value={k ? (thisYear ? `${k.facilityPercent}%` : "—") : "…"}
          info={!thisYear ? NOT_YET : k ? `Tỷ lệ trường đạt chuẩn cơ sở vật chất từ mức tối thiểu trở lên. Chỉ tính ${count.format(k.facilitySchools)} trường đã khai phòng.` : undefined}
          meter={k ? { percent: thisYear ? k.facilityPercent : 0, label: "" } : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className={admin ? "xl:col-span-3" : "xl:col-span-2"}
          title={<span className="flex items-center gap-2"><AlertTriangle className="text-warning-text size-4" />Trường cần đôn đốc{d && d.attentionTotal ? ` (${count.format(d.attentionTotal)})` : ""}</span>}
          description={d && d.attentionTotal ? "Bấm vào cột để xem danh sách trường." : undefined}>
          {!d ? (
            <LoadingText className="flex justify-center py-6" />
          ) : d.attentionTotal === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Mọi trường đã nhập thiết bị, khai phòng và nộp biên bản kiểm kê.</p>
          ) : (
            <GroupedBars data={gapRows} xKey="label" stacked legend={false} height="h-48" onPick={(row) => setGap(String(row.key))}
              series={[{ key: "missing", label: "Chưa khai" }, { key: "short", label: "Chưa đáp ứng" }]} />
          )}
        </ChartCard>

        {/* Quản trị viên không thuộc cấp duyệt nào (GBR-07) nên không có khung phiếu chờ duyệt. */}
        {admin ? null : (
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
        )}
      </div>

      <GapDialog gap={GAPS.find((g) => g.key === gap) ?? null} schools={d?.attention ?? []} onClose={() => setGap(null)} />

      <div className="grid flex-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Thiết bị toàn địa bàn theo trạng thái">
          <DonutBreakdown items={assetGroups} unit="thiết bị" spread />
        </ChartCard>
        <ChartCard title={thisYear ? `Thiết bị ghi tăng ${span} tháng` : `Thiết bị ghi tăng năm học ${yearName ?? ""}`}
          action={<RangeSelect value={String(span)} onChange={(v) => setSpan(Number(v))} options={SPANS} />}>
          {/* Khung cao theo chỗ còn lại của trang; biểu đồ nằm tuyệt đối bên trong nên không tự đẩy khung giãn ra. */}
          <div className="relative min-h-44 flex-1">
            <div className="absolute inset-0">
              <GroupedBars height="aspect-auto h-full" data={(d?.months ?? []).slice(-span)} xKey="month" xFormatter={(m) => m.slice(0, 2) + "/" + m.slice(5)} series={[
                { key: "intake", label: "Ghi tăng" },
              ]} />
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

type GapSchool = DashboardData["attention"][number];

/**
 * Ba việc Sở đôn đốc trường, mỗi việc một cột xếp chồng: phần dưới là trường chưa khai (chưa nộp), phần trên là trường
 * đã khai mà chưa đáp ứng. Trường khai dần thì cột chuyển màu từ "chưa khai" sang "chưa đáp ứng".
 */
const GAPS: { key: string; label: string; missing: string; state: (s: GapSchool) => string | null }[] = [
  { key: "equipment", label: "Thiết bị tối thiểu", missing: "Chưa khai thiết bị",
    state: (s) => (s.equipment === 0 ? "Chưa khai thiết bị" : s.equipmentShort ? "Chưa đáp ứng" : null) },
  { key: "facility", label: "Chuẩn CSVC", missing: "Chưa khai CSVC",
    state: (s) => (s.rooms === 0 ? "Chưa khai CSVC" : s.facilityShort ? "Chưa đáp ứng" : null) },
  { key: "inventory", label: "Biên bản kiểm kê", missing: "Chưa nộp biên bản",
    state: (s) => (s.inventoryDue ? "Chưa nộp biên bản" : null) },
];

/** Danh sách trường của một cột — bấm tên trường mở hồ sơ trường. */
/** Khoảng thời gian của biểu đồ ghi tăng — máy chủ trả 12 tháng gần nhất, màn hình cắt theo lựa chọn. */
const SPANS = [3, 6, 12].map((n) => ({ value: String(n), label: `${n} tháng gần nhất` }));

/** Đáp ứng tối thiểu, chuẩn CSVC tính theo lớp, học sinh, phòng của từng năm học — hiện mới tính cho năm hiện tại. */
const NOT_YET = "Chưa tính theo năm học này. Chọn năm học hiện tại để xem.";

const PAGE = 10;
/** Bỏ dấu để tìm "le hong phong" ra "Lê Hồng Phong". */
const fold = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

function GapDialog({ gap, schools, onClose }: { gap: (typeof GAPS)[number] | null; schools: GapSchool[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const all = gap ? schools.filter((s) => gap.state(s) != null) : [];
  const rows = q.trim() ? all.filter((s) => fold(s.name).includes(fold(q.trim()))) : all;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(page, pages - 1);
  const close = () => {
    setQ("");
    setPage(0);
    onClose();
  };
  return (
    <Dialog open={gap != null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{gap?.label}</DialogTitle>
          <DialogDescription>{count.format(all.length)} trường</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Tìm trường…" className="pl-9" autoFocus />
        </div>
        {rows.length === 0 ? <p className="text-muted-foreground py-4 text-center text-sm">Không có trường nào khớp.</p> : null}
        {/* Đủ chỗ cho 10 dòng: trang cuối ít dòng thì hộp không co lại, thanh phân trang đứng yên ở đáy. */}
        <ul className="-mx-2 min-h-[23rem] flex-1">
          {rows.slice(at * PAGE, (at + 1) * PAGE).map((s) => (
            <li key={s.id}>
              <Link to={`/schools/show/${s.id}`} onClick={close}
                className="hover:bg-accent flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm">
                <span className="min-w-0 truncate">{s.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={gap?.state(s) === "Chưa đáp ứng" ? "info" : "warning"}>{gap?.state(s)}</Badge>
                  <ArrowRight className="text-muted-foreground size-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {pages > 1 ? (
          <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {at * PAGE + 1}–{Math.min(rows.length, (at + 1) * PAGE)} / {count.format(rows.length)}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={at === 0} onClick={() => setPage(at - 1)}>Trước</Button>
              <span className="px-2 tabular-nums">{at + 1}/{pages}</span>
              <Button type="button" variant="outline" size="sm" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Sau</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
