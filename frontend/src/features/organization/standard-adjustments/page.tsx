import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, GraduationCap, LayoutGrid, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";

import { EmptyState, TableEmpty } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  STATUS_LABELS,
  type AdjustRule,
  type Adjustment,
  type LevelItems,
  type OverviewRow,
  type RuleItem,
} from "@/domains/standard-adjustment/types";

import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { usePerspective } from "@/shared/hooks/use-perspective";

import { AsideRow } from "../resources/equipment-aside";
import { ReviewDialog } from "./review-dialog";
import { SchoolAdjustments } from "./school-adjustments";
import { EMPTY_RULE, RuleSheet } from "./rule-sheet";
import { LIFT_ROW } from "@/shared/lib/row-lift";

const LEVEL_GRADES: Record<string, number[]> = { TH: [1, 2, 3, 4, 5], THCS: [6, 7, 8, 9], THPT: [10, 11, 12] };
const num = new Intl.NumberFormat("vi-VN");

type Level = { id: number; code: string; name: string };
const anyOn = (r: AdjustRule | null | undefined) => !!r && (r.allowReduce || r.allowSubstitute || r.allowCustom);
const inGrade = (i: RuleItem, g: string) => g === "all" || i.gradeLevels == null || i.gradeLevels.split(",").includes(g);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");

/**
 * `/standard-adjustments` — đề nghị điều chỉnh chuẩn của các trường, góc nhìn cơ quan quản lý: đề nghị chờ người
 * xem duyệt và bảng theo dõi tỷ lệ đạt theo hai chuẩn. Quy định điều chỉnh (Sở cho thiết bị nào được điều chỉnh)
 * là cấu hình của danh mục — màn riêng {@link StandardAdjustmentRulesPage}, tab trong nhóm Tài sản và thiết bị.
 */
export function StandardAdjustmentsPage() {
  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Đề nghị điều chỉnh chuẩn" />
      <SchoolsTab />
    </ListView>
  );
}

/**
 * `/standard-adjustment-rules` — Sở chọn theo cấp học thiết bị nào trong danh mục tối thiểu trường được điều chỉnh
 * và tới đâu (UBND, trường chỉ xem). Đứng cạnh Danh mục thiết bị tối thiểu vì nó là cấu hình của chính danh mục đó.
 */
export function StandardAdjustmentRulesPage() {
  const canWrite = useCan({ resource: "standard_adjustment_rules", action: "edit" }).data?.can ?? false;
  // Trường: danh sách đề nghị điều chỉnh của chính trường, lập / xem từng đề nghị trong hộp thoại.
  // Sở / UBND: định nghĩa thiết bị nào trường được tăng, giảm, thay thế.
  const { perspective } = usePerspective();
  return (
    <ListView>
      <ListViewHeader canCreate={false}
        title={perspective === "school" ? "Điều chỉnh chuẩn tối thiểu" : "Cấu hình điều chỉnh chuẩn tối thiểu"} />
      {perspective === "school" ? <SchoolAdjustments /> : <RulesTab canWrite={canWrite} />}
    </ListView>
  );
}

// ------------------------------------------------------------------ quy định

function RulesTab({ canWrite }: { canWrite: boolean }) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const levels = useQuery({
    queryKey: ["education_levels", "adjust"],
    queryFn: ({ signal }) => kyInstance.get("education_levels", { signal,  searchParams: { _start: "0", _end: "50" } }).json<Level[]>(),
    select: (l) => l.filter((x) => x.code in LEVEL_GRADES),
  });
  const [levelId, setLevelId] = useState<number | null>(null);
  useEffect(() => {
    if (levelId == null && levels.data?.length) setLevelId(levels.data.find((l) => l.code === "THCS")?.id ?? levels.data[0].id);
  }, [levels.data, levelId]);
  const items = useQuery({
    queryKey: ["standard_adjustment_rules", "items", levelId],
    enabled: levelId != null,
    queryFn: ({ signal }) => kyInstance.get("standard_adjustment_rules/items", { signal,  searchParams: { levelId: String(levelId) } }).json<LevelItems>(),
  });
  // Thứ tự môn theo danh mục Môn học (Toán, Vật lý, Hoá học…), không theo thứ tự thiết bị trong danh mục.
  const subjectOrder = useQuery({
    queryKey: ["subjects", "order"],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => kyInstance.get("subjects", { signal,  searchParams: { _start: "0", _end: "200", _sort: "sortOrder", _order: "asc" } })
      .json<{ id: number }[]>(),
    select: (l) => new Map(l.map((x, k) => [String(x.id), k])),
  });
  const pendingCount = useQuery({
    queryKey: ["standard_adjustments", "awaiting-count"],
    queryFn: ({ signal }) => kyInstance.get("standard_adjustments", { signal,  searchParams: { status: "PENDING" } }).json<Adjustment[]>(),
    select: (l) => l.length,
  });

  const [pending, setPending] = useState<Record<number, AdjustRule | null>>({});
  const [grade, setGrade] = useState("all");
  const [subject, setSubject] = useState<string>("all");
  const [filter, setFilter] = useState<"all" | "on" | "off">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<RuleItem | null>(null);
  const [saving, setSaving] = useState(false);
  // Chọn nhiều thiết bị để áp điều chỉnh một lần — giữ qua các trang và bộ lọc, bỏ khi đổi cấp học.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkFloor, setBulkFloor] = useState(50);

  useEffect(() => {
    setPending({});
    setGrade("all");
    setSubject("all");
    setSelected(new Set());
  }, [levelId]);
  useEffect(() => setPage(1), [grade, subject, filter, q, levelId, pageSize]);

  const data = items.data;
  const ruleOf = (i: RuleItem) => (i.catalogId in pending ? pending[i.catalogId] : i.rule);
  const grades = LEVEL_GRADES[data?.levelCode ?? ""] ?? [];
  const base = useMemo(() => (data?.items ?? []).filter((i) => inGrade(i, grade)), [data, grade]);
  const subjects = useMemo(() => {
    const m = new Map<string, { key: string; name: string; n: number; on: number }>();
    for (const i of base) {
      const key = String(i.subjectId ?? "none");
      if (!m.has(key)) m.set(key, { key, name: i.subjectName ?? "Dùng chung", n: 0, on: 0 });
      const s = m.get(key)!;
      s.n++;
      if (anyOn(i.catalogId in pending ? pending[i.catalogId] : i.rule)) s.on++;
    }
    // Môn không có thiết bị ở lớp đang chọn thì không hiện; "Dùng chung" (không gắn môn) đứng cuối.
    const order = subjectOrder.data;
    const rank = (k: string) => (k === "none" ? Number.MAX_SAFE_INTEGER : order?.get(k) ?? Number.MAX_SAFE_INTEGER - 1);
    const last = (x: { key: string; name: string }) => (x.name === "Dùng chung" ? Number.MAX_SAFE_INTEGER : rank(x.key));
    return [...m.values()].sort((a, b) => last(a) - last(b) || a.name.localeCompare(b.name, "vi"));
  }, [base, pending, subjectOrder.data]);
  const term = fold(q.trim());
  const shown = base
    .filter((i) => subject === "all" || String(i.subjectId ?? "none") === subject)
    .filter((i) => filter === "all" || (filter === "on" ? anyOn(ruleOf(i)) : !anyOn(ruleOf(i))))
    .filter((i) => !term || fold(`${i.name} ${i.code}`).includes(term));
  const adjustedCount = (data?.items ?? []).filter((i) => anyOn(ruleOf(i))).length;
  const dirty = Object.keys(pending).length;

  const toggle = (i: RuleItem, key: "allowReduce" | "allowCustom") => {
    const r = structuredClone(ruleOf(i) ?? EMPTY_RULE(i.catalogId));
    r[key] = !r[key];
    setPending((p) => ({ ...p, [i.catalogId]: anyOn(r) ? r : null }));
  };

  const pick = (id: number, on: boolean) => setSelected((s) => {
    const next = new Set(s);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const allShown = shown.length > 0 && shown.every((i) => selected.has(i.catalogId));
  const pickShown = (on: boolean) => setSelected((s) => {
    const next = new Set(s);
    for (const i of shown) if (on) next.add(i.catalogId); else next.delete(i.catalogId);
    return next;
  });
  /** Áp cho mọi thiết bị đã chọn: bật / tắt đổi số lượng (với mức sàn chọn ở thanh), bật / tắt cho thay thế, hoặc bỏ hết. */
  const applyBulk = (change: (r: AdjustRule) => void) => {
    const items = (data?.items ?? []).filter((i) => selected.has(i.catalogId));
    setPending((p) => {
      const next = { ...p };
      for (const i of items) {
        const r = structuredClone((i.catalogId in p ? p[i.catalogId] : i.rule) ?? EMPTY_RULE(i.catalogId));
        change(r);
        next[i.catalogId] = anyOn(r) ? r : null;
      }
      return next;
    });
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const rules = Object.entries(pending).map(([id, r]) => {
        const x = r ?? EMPTY_RULE(Number(id));
        return {
          catalogId: Number(id), allowReduce: x.allowReduce, reduceFloor: x.reduceFloor, allowSubstitute: x.allowSubstitute,
          substitutes: x.substitutes.map((s) => ({ catalogId: s.catalogId, ratio: s.ratio })), allowCustom: x.allowCustom, basis: x.basis,
        };
      });
      const fresh = await kyInstance.put("standard_adjustment_rules", { json: { levelId: data.levelId, rules } }).json<LevelItems>();
      qc.setQueryData(["standard_adjustment_rules", "items", levelId], fresh);
      setPending({});
      notify?.({ type: "success", message: `Đã áp dụng cho ${num.format(data.schools)} trường ${data.levelName}` });
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* MỘT hàng: chọn cấp học bên trái, tóm tắt số bên phải — không dựng bốn ô số to cho bốn con số. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="bg-card shadow-e1 inline-flex flex-wrap gap-1 rounded-xl border p-1" role="group" aria-label="Cấp học">
          {(levels.data ?? []).map((l) => (
            <button key={l.id} type="button" aria-pressed={l.id === levelId}
              className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                l.id === levelId ? "bg-brand-gradient shadow-e1 font-semibold" : "text-foreground/80 hover:bg-accent hover:text-foreground")}
              onClick={() => setLevelId(l.id)} disabled={dirty > 0 && l.id !== levelId} title={dirty ? "Lưu hoặc huỷ thay đổi trước" : undefined}>
              {l.name}
            </button>
          ))}
        </div>
        {data ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:ms-auto">
            {([
              ["thiết bị trong danh mục", data.items.length, ""],
              ["cho điều chỉnh", adjustedCount, adjustedCount ? "text-primary" : ""],
              ["trường áp dụng", data.schools, ""],
              ["đề nghị chờ duyệt", pendingCount.data ?? 0, pendingCount.data ? "text-warning-text" : ""],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className={cn("text-base font-semibold tabular-nums", tone)}>{num.format(value)}</span>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <FillBox className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
            {/* MỘT cột lọc, cùng khuôn cột trái màn Thiết bị: "Tất cả thiết bị", rồi Khối lớp, rồi Môn học — khối và
                môn cộng dồn, số cạnh môn tính trong khối đang chọn. */}
            <Card className="flex max-h-[75vh] flex-col gap-0 overflow-hidden py-0 lg:h-full lg:max-h-none">
              <div className="shrink-0 border-b p-2">
                <AsideRow root selected={grade === "all" && subject === "all"} onClick={() => { setGrade("all"); setSubject("all"); }}
                  icon={<LayoutGrid />} label="Tất cả thiết bị" count={data.items.length} />
              </div>
              <div className="scrollbar-fade min-h-0 flex-1 space-y-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
                <p className="text-overline text-muted-foreground px-2 pt-1 pb-0.5">Khối lớp</p>
                {grades.map((g) => {
                  const k = String(g);
                  const n = data.items.filter((i) => inGrade(i, k)).length;
                  return (
                    <AsideRow key={k} selected={grade === k} onClick={() => setGrade(grade === k ? "all" : k)}
                      icon={<GraduationCap className="text-gold-500" />} label={`Lớp ${g}`} count={n} disabled={n === 0} />
                  );
                })}
                <p className="text-overline text-muted-foreground px-2 pt-3 pb-0.5">Môn học</p>
                {subjects.map((s) => (
                  <AsideRow key={s.key} selected={subject === s.key} onClick={() => setSubject(subject === s.key ? "all" : s.key)}
                    icon={<BookOpen />} label={s.on ? <>{s.name} <span className="text-primary text-xs">· {s.on} cho điều chỉnh</span></> : s.name}
                    count={s.n} disabled={s.n === 0} />
                ))}
              </div>
            </Card>
            <Card className="min-h-0 min-w-0 gap-0 py-0">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
                {canWrite ? (
                  <Checkbox checked={allShown} className="me-1"
                    aria-label="Chọn mọi thiết bị đang lọc" title={`Chọn cả ${num.format(shown.length)} thiết bị đang lọc`}
                    onCheckedChange={(v) => pickShown(v === true)} />
                ) : null}
                <div className="relative w-full min-w-0 sm:w-80">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã…" className="ps-8" />
                </div>
                <div className="bg-muted inline-flex gap-0.5 rounded-lg p-0.5">
                  {([["all", "Tất cả"], ["on", "Cho điều chỉnh"], ["off", "Bắt buộc"]] as const).map(([k, t]) => (
                    <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                      className={cn("rounded-md px-2.5 py-1 text-sm", filter === k ? "bg-card text-primary font-medium shadow-sm" : "text-muted-foreground")}>
                      {t}
                    </button>
                  ))}
                </div>
                <span className="text-muted-foreground text-xs tabular-nums sm:ms-auto">{num.format(shown.length)} thiết bị</span>
              </div>
              {canWrite && selected.size ? (
                <div className="bg-primary/[0.06] flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
                  <span className="font-medium tabular-nums">Đã chọn {num.format(selected.size)} thiết bị</span>
                  <span className="bg-border mx-1 h-5 w-px" />
                  <Button type="button" size="sm" variant="outline" className="h-7"
                    onClick={() => applyBulk((r) => { r.allowReduce = true; r.reduceFloor = bulkFloor; })}>
                    Cho đổi số lượng
                  </Button>
                  <span className="text-muted-foreground text-xs">sàn</span>
                  <div className="bg-muted inline-flex gap-0.5 rounded-md p-0.5">
                    {[0, 25, 50, 75].map((f) => (
                      <button key={f} type="button" aria-pressed={bulkFloor === f} onClick={() => setBulkFloor(f)}
                        className={cn("h-6 rounded px-1.5 text-xs tabular-nums", bulkFloor === f ? "bg-card text-primary font-semibold shadow-e1" : "text-muted-foreground")}>
                        {f}%
                      </button>
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => applyBulk((r) => { r.allowCustom = true; })}>
                    Cho thay thế
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7"
                    onClick={() => applyBulk((r) => { r.allowReduce = false; r.allowSubstitute = false; r.allowCustom = false; })}>
                    Bắt buộc theo chuẩn Bộ
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="ms-auto h-7" onClick={() => setSelected(new Set())}>
                    Bỏ chọn
                  </Button>
                </div>
              ) : null}
              <div className="min-h-0 flex-1 divide-y overflow-auto [&>*:last-child]:border-b">
                {shown.slice((page - 1) * pageSize, page * pageSize).map((i) => {
                  const r = ruleOf(i);
                  const changed = i.catalogId in pending;
                  return (
                    <div key={i.catalogId} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", anyOn(r) && "bg-primary/[0.03]",
                      selected.has(i.catalogId) && "bg-primary/[0.07]")}>
                      {canWrite ? (
                        <Checkbox checked={selected.has(i.catalogId)} onCheckedChange={(v) => pick(i.catalogId, v === true)}
                          aria-label={`Chọn ${i.name}`} />
                      ) : null}
                      <div className="min-w-0 flex-1 basis-64">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium" title={i.name}>{i.name}</span>
                          {changed ? <Badge variant="warning">Chưa lưu</Badge> : null}
                          {i.optional ? <Badge variant="neutral">Tự chọn</Badge> : null}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {i.code}{i.quantityText ? ` · ${i.quantityText}` : ""}{i.gradeLevels ? ` · lớp ${i.gradeLevels.replaceAll(",", ", ")}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip on={!!r?.allowReduce} disabled={!canWrite} onClick={() => toggle(i, "allowReduce")}
                          label={r?.allowReduce ? (r.reduceFloor ? `Giảm còn ≥ ${r.reduceFloor}%` : "Được bỏ hẳn") : "Đổi số lượng"} />
                        <Chip on={!!r?.allowCustom} disabled={!canWrite} onClick={() => toggle(i, "allowCustom")} label="Cho thay thế" />
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(i)}>Chi tiết</Button>
                    </div>
                  );
                })}
                {shown.length === 0 ? <EmptyState filtered className="h-full" title="Không có thiết bị khớp bộ lọc" /> : null}
              </div>
              {shown.length ? (
                <div className="shrink-0 border-t px-3 py-2">
                  <DataTablePagination currentPage={page} pageCount={Math.max(1, Math.ceil(shown.length / pageSize))}
                    setCurrentPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={shown.length}
                    pageSizeLabel="Số thiết bị mỗi trang" />
                </div>
              ) : null}
            </Card>
          </FillBox>

          {dirty ? (
            <div className="bg-card sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 shadow-e3" role="status">
              <span className="flex-1 text-sm"><b>{dirty} thiết bị</b> đã đổi, chưa áp dụng cho trường.</span>
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setPending({})}>Huỷ thay đổi</Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Lưu và áp dụng cho {num.format(data.schools)} trường
              </Button>
            </div>
          ) : null}

          <RuleSheet item={editing} rule={editing ? ruleOf(editing) ?? null : null} readOnly={!canWrite}
            onClose={() => setEditing(null)}
            onDone={(r) => {
              setPending((p) => ({ ...p, [r.catalogId]: anyOn(r) ? r : null }));
              setEditing(null);
            }} />
        </>
      )}
    </div>
  );
}

function Chip({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled} title={label}
      className={cn("max-w-64 truncate rounded-full border px-2.5 py-0.5 text-xs disabled:cursor-default",
        on ? "border-primary/40 bg-primary/10 text-primary font-medium" : "text-muted-foreground border-dashed",
        disabled && !on && "hidden")}>
      {on ? "✓ " : "+ "}{label}
    </button>
  );
}

// ------------------------------------------------------------------ đề nghị của các trường

function SchoolsTab() {
  const [open, setOpen] = useState<number | null>(null);
  const awaiting = useQuery({
    queryKey: ["standard_adjustments", "awaiting"],
    queryFn: ({ signal }) => kyInstance.get("standard_adjustments", { signal,  searchParams: { awaiting: "me" } }).json<Adjustment[]>(),
  });
  const overview = useQuery({
    queryKey: ["standard_adjustments", "overview"],
    queryFn: ({ signal }) => kyInstance.get("standard_adjustments/overview", { signal }).json<OverviewRow[]>(),
  });

  return (
    <div className="space-y-4">
      {awaiting.data?.length ? (
        <Card className="gap-0 py-0">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Chờ bạn duyệt <Badge variant="warning">{awaiting.data.length}</Badge></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trường</TableHead>
                <TableHead>Số đề nghị</TableHead>
                <TableHead className="text-right">Số dòng</TableHead>
                <TableHead>Trình lúc</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {awaiting.data.map((a) => (
                <TableRow key={a.id} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="font-medium">{a.schoolName}</TableCell>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.lines}</TableCell>
                  <TableCell className="text-sm">{a.submittedAt}{a.submittedBy ? ` · ${a.submittedBy}` : ""}</TableCell>
                  <TableCell><Button type="button" size="sm" className="h-7 px-3 text-xs" onClick={() => setOpen(a.id)}>Duyệt</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <FillBox>
      <Card className="min-h-0 flex-1 gap-0 py-0">
        <div className="shrink-0 border-b px-4 py-2.5 text-sm font-semibold">Trường đã đề nghị điều chỉnh</div>
          <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table>
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Trường</TableHead>
                  <TableHead>Cơ quan duyệt</TableHead>
                  <TableHead className="text-right">Đang điều chỉnh</TableHead>
                  <TableHead>Đề nghị gần nhất</TableHead>
                  <TableHead className="text-right">Đạt theo chuẩn Bộ</TableHead>
                  <TableHead className="text-right">Đạt theo chuẩn đã duyệt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!overview.data?.length ? (
                  <TableEmpty colSpan={6} loading={overview.isLoading} title="Chưa có trường nào đề nghị điều chỉnh" />
                ) : null}
                {(overview.data ?? []).map((r) => (
                  <TableRow key={r.schoolId} className={cn("group/row", LIFT_ROW, "hover:bg-muted/50 cursor-pointer")} onClick={() => setOpen(r.latestId)}>
                    <TableCell>
                      <div className="font-medium">{r.schoolName}</div>
                      <div className="text-muted-foreground text-xs">{r.levelName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.bodyName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.effective}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{r.latestCode}</span>{" "}
                      <Badge variant={r.latestStatus === "PENDING" ? "warning" : "success"}>{STATUS_LABELS[r.latestStatus]}</Badge>
                      <span className="text-muted-foreground ms-1 text-xs">{r.latestLines} dòng</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.basePercent}%</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <b>{r.percent}%</b>
                      {r.percent - r.basePercent >= 30 ? (
                        <Badge variant="warning" className="ms-1.5" title="Chênh nhiều giữa hai chuẩn — nên xem lại">+{r.percent - r.basePercent}</Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
      </Card>
      </FillBox>
      {open ? <ReviewDialog id={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
