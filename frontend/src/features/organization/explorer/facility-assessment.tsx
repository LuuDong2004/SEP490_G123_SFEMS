import { useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, SquareStack } from "lucide-react";
import { Fragment, useState } from "react";
import { useSearchParams } from "react-router";

import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";
import { QueryError } from "@/shared/components/query-error";
import { Segmented } from "@/shared/components/segmented";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { errorMessage } from "@/shared/lib/api-error";
import { safeDownloadName } from "@/shared/lib/download-filename";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { STANDARD_TIERS, type StandardEvaluation, type StandardItem, type StandardStatus, type StandardTier } from "@/domains/facility/standard";
import type { FacilityTodoFilter } from "@/domains/facility/todo";
import { CsvcStatisticsPanel, GROUP_ICONS } from "@/features/organization/explorer/facility-nav";
import { FacilityTodo } from "@/features/organization/explorer/facility-todo";

const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, useGrouping: false });

/** Tiền tố của từng mức trong `requirements` máy chủ ghi ("tối thiểu: ≥ 15 phòng (0,6 phòng/lớp × 24 lớp)"). */
const TIER_PREFIX: Record<StandardTier, string> = { MIN: "tối thiểu", LEVEL1: "mức độ 1", LEVEL2: "mức độ 2" };

/** Yêu cầu gọn của một mức — bỏ phần giải thích trong ngoặc, lấy điều kiện đầu ("≥ 15 phòng", "tổng ≥ 605,4 m²"). */
function tierRequirement(item: StandardItem, tier: StandardTier): string | null {
  const prefix = `${TIER_PREFIX[tier]}:`;
  const line = item.requirements.find((r) => r.startsWith(prefix));
  if (!line) return null;
  return line.slice(prefix.length).replace(/\s*\([^)]*\)/g, "").split(";")[0].trim() || null;
}

const parseVn = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Còn thiếu ở mức THẤP NHẤT chưa đạt có điều kiện riêng: số phòng, số m², hoặc chưa khai diện tích. */
function shortfall(item: StandardItem): { text: string; action: string } | null {
  for (const t of STANDARD_TIERS) {
    if (item.status[t.key] !== "FAIL") continue;
    const req = tierRequirement(item, t.key);
    if (!req) continue;
    const rooms = /^≥ ([\d.]+) phòng/.exec(req);
    if (rooms) {
      const missing = parseVn(rooms[1]) - item.count;
      if (missing > 0) return { text: `${num.format(missing)} ${item.kind === "AREA" ? "khu" : "phòng"}`, action: "Thêm" };
    }
    if (item.shortfalls.some((s) => s.includes("chưa có diện tích"))) return { text: "Chưa khai diện tích", action: "Nhập" };
    const area = /([\d.,]+) m²/.exec(req);
    if (area) {
      const missing = parseVn(area[1]) - Number(item.totalArea ?? 0);
      if (missing > 0) return { text: `${num.format(missing)} m²`, action: "Nhập" };
    }
    return { text: req, action: "Xem" };
  }
  return null;
}

const failing = (item: StandardItem) => Object.values(item.status).includes("FAIL");

function GroupIcon({ code }: { code: string | null }) {
  const spec = GROUP_ICONS[code ?? ""];
  const Icon = spec?.icon ?? SquareStack;
  return <Icon className={cn("size-4 shrink-0", spec?.tone ?? "text-muted-foreground")} aria-hidden />;
}

/** Yêu cầu đầy đủ của một mức, đọc thành câu — chú thích khi rê chuột ("Cần ít nhất 15 phòng (0,6 phòng/lớp × 24 lớp)"). */
function tierExplain(item: StandardItem, tier: StandardTier): string | undefined {
  const prefix = `${TIER_PREFIX[tier]}:`;
  const line = item.requirements.find((r) => r.startsWith(prefix));
  return line ? `Cần ${line.slice(prefix.length).trim().replace(/≥/g, "ít nhất")}` : undefined;
}

/**
 * Kết quả một mức. Chưa đạt thì ghi điều kiện bằng chữ — "Cần 15 phòng", "Cần tổng 605,4 m²" (trưởng nhóm 12/11/2026:
 * "✕ ≥" khó hiểu); rê chuột thấy cách tính. Chưa đạt vì mức dưới chưa đạt (không có điều kiện riêng) thì "Chưa đạt".
 */
function TierCell({ item, tier }: { item: StandardItem; tier: StandardTier }) {
  const status: StandardStatus = item.status[tier];
  // Mức này không đặt điều kiện cho loại này (phòng nghỉ GV chỉ có ở mức độ 2) — ghi chữ, không để "—" khó hiểu.
  // Ít màu (trưởng nhóm 12/11/2026): chữ thường, không nền; chỉ ô có điều kiện riêng chưa đạt mới đỏ, "Đạt" xanh,
  // còn lại xám — mắt đi thẳng tới chỗ phải làm.
  if (status === "NONE") return <span className="text-muted-foreground text-xs">Không yêu cầu</span>;
  if (status === "PASS") return <span className="text-success-text text-xs font-medium">Đạt</span>;
  const req = tierRequirement(item, tier);
  return req ? (
    <span className="text-destructive-text text-xs font-medium whitespace-nowrap" title={tierExplain(item, tier)}>
      Cần {req.replace(/≥\s*/g, "")}
    </span>
  ) : (
    <span className="text-muted-foreground text-xs" title="Chưa đạt vì mức dưới chưa đạt">Chưa đạt</span>
  );
}

/**
 * Tab Đánh giá CSVC của một trường — phương án C (trưởng nhóm chốt 12/11/2026): dải đầu = kết luận mức đạt + ba mức
 * (đạt / tổng loại có chuẩn) + xuất Excel mẫu Sở, Biểu số liệu; dải "Cần hoàn thiện"; rồi bảng chuẩn theo khối, mỗi
 * loại một dòng với kết quả ba mức (✕ kèm yêu cầu) và còn thiếu bao nhiêu. Không dòng giải thích phụ.
 */
export function FacilityAssessment({ schoolId, onTab, onTodo, onAdd }: {
  schoolId: number;
  /**
   * "Thêm ›" ở một loại còn thiếu: mở hộp Thêm phòng điền sẵn loại đó, ở lại tab này (M2-11, 13/11/2026). Vắng thì
   * chuyển sang tab Cơ sở vật chất như cũ.
   */
  onAdd?: (roomType: { id: number; code: string; name: string; kind: "ROOM" | "AREA" }) => void;
  /** Bấm một việc có danh sách hạng mục riêng: màn trường lọc danh sách hạng mục theo việc đó. */
  onTodo?: (todo: FacilityTodoFilter | null) => void;
  /** Chuyển tab của màn trường. Vắng thì ghi `?tab=` lên địa chỉ — trang riêng của trường đọc nó. */
  onTab?: (tab: string) => void;
}) {
  const [, setParams] = useSearchParams();
  const goTab = onTab ?? ((tab: string) => setParams((p) => { p.set("tab", tab); return p; }, { replace: true }));
  const { open: notify } = useNotification();
  const query = useQuery({
    queryKey: ["facility-standard", schoolId],
    queryFn: ({ signal }) => kyInstance.get(`facility-standard/schools/${schoolId}`, { signal }).json<StandardEvaluation>(),
  });
  const data = query.data;
  const [filter, setFilter] = useState<"fail" | "pass" | "all">("fail");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(false);

  // "Xuất đánh giá" tải thẳng (bảng đánh giá đã ở ngay tab); "Biểu số liệu" mở hộp xem, trong hộp có nút tải (trưởng
  // nhóm 12/11/2026: xem rồi thích thì tải).
  async function download() {
    if (!data) return;
    setBusy(true);
    try {
      const blob = await kyInstance.get(`facility-standard/schools/${schoolId}/export`, { timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh gia muc do chuan - ${safeDownloadName(data.school.name)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;

  const ruled = (data?.groups ?? []).flatMap((g) => g.items.filter((i) => i.hasRules));
  const failCount = ruled.filter(failing).length;
  const keep = (i: StandardItem) => i.hasRules && (filter === "all" || (filter === "fail" ? failing(i) : !failing(i)));
  const groups = (data?.groups ?? []).map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length > 0);
  // Mức đang hướng tới: mức thấp nhất có chuẩn mà chưa đạt.
  const target = data?.tiers.find((t) => t.total > 0 && !t.reached)?.tier;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="bg-card shadow-e1 grid shrink-0 items-center gap-5 rounded-lg border px-5 py-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-1">
          {data ? (
            <>
              <p className="text-muted-foreground text-xs">
                {data.school.classes ?? "—"} lớp · {data.school.students != null ? num.format(data.school.students) : "—"} học sinh
              </p>
              <p className={cn("text-2xl leading-tight font-bold", data.reached ? "text-success-text" : "text-destructive-text")}>
                {data.reached ? `Đạt ${data.reachedLabel.toLowerCase()}` : data.reachedLabel}
              </p>
            </>
          ) : <Skeleton className="h-12 w-56" />}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(data?.tiers ?? STANDARD_TIERS.map((t) => ({ tier: t.key, passed: 0, total: 0, reached: false }))).map((t) => {
            const on = t.tier === target;
            const pct = t.total ? Math.round((t.passed * 100) / t.total) : 0;
            return (
              <div key={t.tier} className={cn("space-y-2 rounded-lg border px-3.5 py-3", on && "border-destructive/40 bg-destructive-subtle/40")}>
                <p className="text-sm font-semibold">{STANDARD_TIERS.find((x) => x.key === t.tier)?.short}</p>
                <p className="text-xl font-bold tabular-nums">
                  {t.total ? <>{t.passed}<span className="text-muted-foreground text-sm font-medium">/{t.total} loại đạt</span></>
                    : <span className="text-muted-foreground text-sm font-medium">Chưa có chuẩn</span>}
                </p>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div className={cn("h-full rounded-full", t.reached ? "bg-success" : on ? "bg-destructive" : "bg-muted-foreground/40")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button type="button" size="sm" disabled={!data || busy} onClick={() => void download()} title="Tải bảng đánh giá mức độ chuẩn (Excel mẫu Sở)">
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Xuất đánh giá
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setStats(true)} title="Xem biểu số liệu CSVC (mẫu Sở), tải Excel trong hộp">
            <FileSpreadsheet />
            Biểu số liệu
          </Button>
        </div>
      </section>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Segmented label="Lọc loại CSVC" value={filter} onChange={setFilter}
          options={[
            { value: "fail", label: `Chưa đạt · ${failCount}` },
            { value: "pass", label: `Đã đạt · ${ruled.length - failCount}` },
            { value: "all", label: `Tất cả · ${ruled.length}` },
          ]} />
        <FacilityTodo strip schoolId={schoolId} onNavigate={(tab, todo) => { onTodo?.(todo ?? null); goTab(tab); }} />
      </div>

      {/* Bảng cao kín phần còn lại của tab; dòng gọn để thường vừa màn, dài hơn thì lăn chuột — không vẽ thanh cuộn. */}
      <div className="bg-card shadow-e1 no-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-surface-subtle sticky top-0 z-10">
            <TableRow>
              <TableHead>Loại CSVC</TableHead>
              <TableHead className="w-28 text-right">Hiện có</TableHead>
              {STANDARD_TIERS.map((t) => <TableHead key={t.key} className="w-36 text-center">{t.short}</TableHead>)}
              <TableHead className="w-44">Còn thiếu</TableHead>
              <TableHead className="w-24"><span className="sr-only">Thao tác</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data ? <TableSkeletonRows rows={8} cols={7} /> : groups.length === 0 ? (
              <TableEmpty colSpan={7} title={ruled.length === 0 ? "Chưa có chuẩn CSVC cho cấp học của trường" : filter === "fail" ? "Mọi loại đều đạt" : "Chưa loại nào đạt"} />
            ) : groups.map((g, gi) => (
              <Fragment key={g.code ?? gi}>
                {/* Dòng khối nổi nhẹ: biểu tượng màu cùng bộ với cột trái tab Cơ sở vật chất, nền tint rất nhạt. */}
                <TableRow className="bg-primary/[0.04] hover:bg-primary/[0.04] border-t [&>td]:h-10">
                  <TableCell colSpan={2} className="py-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <GroupIcon code={g.code} />
                      {g.name}
                    </span>
                  </TableCell>
                  {STANDARD_TIERS.map((t) => (
                    <TableCell key={t.key} className={cn("py-2 text-center text-xs font-semibold",
                      g.status[t.key] === "PASS" ? "text-success-text" : "text-muted-foreground")}>
                      {g.status[t.key] === "PASS" ? "Đạt" : g.status[t.key] === "FAIL" ? "Chưa đạt" : "—"}
                    </TableCell>
                  ))}
                  <TableCell colSpan={2} />
                </TableRow>
                {g.items.map((item) => {
                  const miss = shortfall(item);
                  return (
                    <TableRow key={item.roomTypeId} className={cn("group/row [&>td]:h-10 [&>td]:py-1", LIFT_ROW)}>
                      <TableCell className="pl-8 whitespace-normal">{item.name}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", item.count === 0 && "text-muted-foreground")}>
                        {item.count}
                        {item.count > 0 && Number(item.totalArea) > 0 ? <span className="text-muted-foreground"> · {num.format(Number(item.totalArea))} m²</span> : null}
                      </TableCell>
                      {STANDARD_TIERS.map((t) => <TableCell key={t.key} className="text-center"><TierCell item={item} tier={t.key} /></TableCell>)}
                      <TableCell>
                        {miss ? <span className="font-semibold">{miss.text}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Nút làm tiếp ở cột riêng, thẳng hàng một cột. */}
                      <TableCell className="text-right">
                        {miss ? (
                          <button type="button" className="text-primary hover:text-primary/80 text-sm font-semibold"
                            onClick={() => (miss.action === "Thêm" && onAdd
                              ? onAdd({ id: item.roomTypeId, code: item.code, name: item.name, kind: item.kind })
                              : goTab("rooms"))}>
                            {miss.action} ›
                          </button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={stats} onOpenChange={setStats}>
        <DialogContent size="wide" className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Biểu số liệu CSVC (mẫu Sở)</DialogTitle>
            <DialogDescription className="sr-only">Lấy từ hồ sơ CSVC đang khai của trường.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            {stats ? <CsvcStatisticsPanel schoolId={schoolId} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
