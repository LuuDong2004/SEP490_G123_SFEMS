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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { STANDARD_TIERS, type StandardEvaluation, type StandardItem, type StandardStatus, type StandardTier } from "@/domains/facility/standard";
import type { FacilityTodoFilter } from "@/domains/facility/todo";
import { CsvcStatisticsPanel, GROUP_ICONS } from "@/features/organization/explorer/facility-nav";
import { FacilityTodo } from "@/features/organization/explorer/facility-todo";

const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, useGrouping: false });

/** Tiền tố của từng mức trong `requirements` máy chủ ghi ("tối thiểu: ≥ 15 phòng (0,6 phòng/lớp × 24 lớp)"). */
const TIER_PREFIX: Record<StandardTier, string> = { MIN: "tối thiểu", LEVEL1: "mức độ 1", LEVEL2: "mức độ 2" };

const unitOf = (item: StandardItem) => (item.kind === "AREA" ? "khu" : "phòng");

/**
 * Điều kiện chưa đạt của một mức, đọc thành chữ ngắn — đúng cái đang thiếu (máy chủ tách sẵn từng điều kiện, `gaps`):
 * thiếu mấy phòng / khu, phòng nhỏ hơn mức đòi, thiếu bao nhiêu m² tổng. Trước đây đọc vế đầu của chuỗi quy tắc nên
 * phòng y tế đủ số mà thiếu diện tích vẫn ghi "Cần 1 phòng", cổng / khu vệ sinh bị gọi là "phòng".
 */
type Need = { kind: "count" | "room" | "total"; text: string; action: "Thêm" | "Sửa" };
function needsOf(item: StandardItem, tier: StandardTier): Need[] {
  const gap = item.gaps?.[tier];
  if (!gap) return [];
  const out: Need[] = [];
  if (gap.needCount != null && gap.needCount > item.count) {
    out.push({ kind: "count", text: `${num.format(gap.needCount - item.count)} ${unitOf(item)}`, action: "Thêm" });
  }
  if (gap.needRoomArea != null) {
    out.push({ kind: "room", text: `Mỗi ${unitOf(item)} ≥ ${num.format(gap.needRoomArea)} m²`, action: "Sửa" });
  }
  if (gap.needTotalArea != null && gap.needTotalArea > Number(item.totalArea ?? 0)) {
    out.push({ kind: "total", text: `${num.format(gap.needTotalArea - Number(item.totalArea ?? 0))} m²`, action: "Sửa" });
  }
  return out;
}

const MISSING_TEXT: Record<StandardItem["missing"][number], string> = {
  area: "Chưa khai diện tích",
  students: "Chưa có số học sinh",
  classes: "Chưa có số lớp",
};

/** Còn thiếu ở mức THẤP NHẤT có điều kiện riêng chưa đạt; thiếu dữ liệu để đánh giá thì nói thiếu dữ liệu gì. */
function shortfall(item: StandardItem): { text: string; action: string | null } | null {
  for (const t of STANDARD_TIERS) {
    if (item.status[t.key] !== "FAIL") continue;
    const needs = needsOf(item, t.key);
    if (needs.length) return { text: needs.map((n) => n.text).join(" · "), action: needs[0].action };
  }
  if (item.missing?.length && Object.values(item.status).includes("FAIL")) {
    return { text: MISSING_TEXT[item.missing[0]], action: item.missing[0] === "area" ? "Nhập" : null };
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
  return line ? `Chuẩn ${TIER_PREFIX[tier]}: ${line.slice(prefix.length).trim().replace(/≥/g, "ít nhất")}` : undefined;
}

/** Chữ của một ô, kèm khung gợi ý của hệ thống (không dùng `title` của trình duyệt). */
function Hint({ tip, children }: { tip?: string; children: React.ReactNode }) {
  if (!tip) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="cursor-default">{children}</span></TooltipTrigger>
      <TooltipContent className="max-w-80">{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Kết quả một mức, cùng chữ với Excel "Đánh giá mức độ đạt chuẩn": ĐẠT (xanh), CHƯA ĐẠT (đỏ); mức không đặt điều kiện
 * cho loại này thì để trống như Excel.
 */
function StatusText({ status, strong }: { status: StandardStatus; strong?: boolean }) {
  if (status === "NONE") return null;
  return status === "PASS"
    ? <span className={cn("text-success-text text-xs", strong ? "font-bold" : "font-medium")}>ĐẠT</span>
    : <span className={cn("text-destructive-text text-xs", strong ? "font-bold" : "font-medium")}>CHƯA ĐẠT</span>;
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
  const [filter, setFilter] = useState<"fail" | "pass" | "all">("all");
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
  // STT như Excel: đánh trên MỌI loại có chuẩn (trước khi lọc) — lọc "Chưa đạt" vẫn giữ đúng số 2.3, 3.1… của bản xuất.
  const numbers = new Map<string, { no: number; items: Map<number, string> }>();
  (data?.groups ?? []).filter((g) => g.items.some((i) => i.hasRules)).forEach((g, gi) => {
    const items = new Map<number, string>();
    g.items.filter((i) => i.hasRules).forEach((i, ii) => items.set(i.roomTypeId, `${gi + 1}.${ii + 1}`));
    numbers.set(g.code ?? g.name, { no: gi + 1, items });
  });
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
          <Button type="button" size="sm" disabled={!data || busy} onClick={() => void download()}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Xuất đánh giá
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setStats(true)}>
            <FileSpreadsheet />
            Biểu số liệu
          </Button>
        </div>
      </section>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Segmented label="Lọc loại CSVC" value={filter} onChange={setFilter}
          options={[
            { value: "all", label: `Tất cả · ${ruled.length}` },
            { value: "fail", label: `Chưa đạt · ${failCount}` },
            { value: "pass", label: `Đã đạt · ${ruled.length - failCount}` },
          ]} />
        <FacilityTodo strip schoolId={schoolId} onNavigate={(tab, todo) => { onTodo?.(todo ?? null); goTab(tab); }} />
      </div>

      {/* Bảng cao kín phần còn lại của tab; dòng gọn để thường vừa màn, dài hơn thì lăn chuột — không vẽ thanh cuộn. */}
      <div className="bg-card shadow-e1 no-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border">
        {/* Cùng bố cục bảng Excel "Đánh giá mức độ đạt chuẩn" (FacilityStandardExcel): STT theo khối, ba mức ĐẠT /
            CHƯA ĐẠT, cột điều kiện cảnh báo thiếu ghi đủ các dòng — xem trên màn là thấy đúng thứ sẽ xuất. */}
        <Table>
          <TableHeader className="bg-surface-subtle sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-14 text-center">STT</TableHead>
              <TableHead>Các hạng mục công trình</TableHead>
              {STANDARD_TIERS.map((t) => (
                <TableHead key={t.key} className="w-28 text-center whitespace-normal">Tiêu chuẩn {t.short.toLowerCase()}</TableHead>
              ))}
              <TableHead className="w-80">Điều kiện cảnh báo thiếu</TableHead>
              <TableHead className="w-20"><span className="sr-only">Thao tác</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data ? <TableSkeletonRows rows={8} cols={7} /> : groups.length === 0 ? (
              <TableEmpty colSpan={7} title={ruled.length === 0 ? "Chưa có chuẩn CSVC cho cấp học của trường" : filter === "fail" ? "Mọi loại đều đạt" : "Chưa loại nào đạt"} />
            ) : groups.map((g, gi) => (
              <Fragment key={g.code ?? gi}>
                <TableRow className="bg-primary/[0.04] hover:bg-primary/[0.04] border-t [&>td]:h-10">
                  <TableCell className="py-2 text-center font-semibold tabular-nums">{numbers.get(g.code ?? g.name)?.no}</TableCell>
                  <TableCell className="py-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <GroupIcon code={g.code} />
                      {numbers.get(g.code ?? g.name)?.no}. {g.name}
                    </span>
                  </TableCell>
                  {STANDARD_TIERS.map((t) => (
                    <TableCell key={t.key} className="py-2 text-center"><StatusText status={g.status[t.key]} strong /></TableCell>
                  ))}
                  <TableCell colSpan={2} />
                </TableRow>
                {g.items.map((item) => {
                  const miss = shortfall(item);
                  return (
                    <TableRow key={item.roomTypeId} className={cn("group/row align-top [&>td]:py-2", LIFT_ROW)}>
                      <TableCell className="text-center tabular-nums">{numbers.get(g.code ?? g.name)?.items.get(item.roomTypeId)}</TableCell>
                      <TableCell className="whitespace-normal">- {item.name}</TableCell>
                      {STANDARD_TIERS.map((t) => (
                        <TableCell key={t.key} className="text-center">
                          <Hint tip={tierExplain(item, t.key)}><StatusText status={item.status[t.key]} /></Hint>
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-normal">
                        {item.shortfalls.length ? (
                          <ul className="text-xs leading-relaxed">
                            {item.shortfalls.map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {miss?.action ? (
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
            <DialogTitle>Biểu số liệu CSVC theo từng phòng</DialogTitle>
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
