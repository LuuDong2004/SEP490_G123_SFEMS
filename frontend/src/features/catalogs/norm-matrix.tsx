import { useCan, useInvalidate, useList, useNotification } from "@refinedev/core";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { FillBox } from "@/shared/components/layout/fill-box";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LEVEL_GRADES, type EquipmentNorm } from "@/domains/equipment-standard/types";

import { useLevelParam } from "./level-picker";
import { CatalogDetailDialog, OutsideCatalog, type CatalogView } from "./minimum-catalog";
import { NormDocumentImport } from "./norm-document-import";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NORMS = "equipment_norms";
const ALL = "__all__";
const PAGE = 50;

type StandardStatus = "DRAFT" | "ACTIVE" | "RETIRED";
const STATUS_LABEL: Record<StandardStatus, string> = { DRAFT: "Bản nháp", ACTIVE: "Đang áp dụng", RETIRED: "Hết hiệu lực" };
const BASIS_ORDER = ["per_school", "per_room", "per_teacher", "per_class", "per_student"] as const;
/** Nhãn gọn cho ô chọn trong bảng (cột hẹp); màn khác dùng `NORM_BASIS_LABELS`. */
const BASIS_SHORT: Record<string, string> = {
  per_school: "Trường",
  per_room: "Phòng bộ môn",
  per_teacher: "Giáo viên",
  per_class: "Lớp",
  per_student: "Học sinh",
};

/** Khối lớp gọn: "1, 2", "1–3"; trống = mọi lớp của cấp ("1–5"). */
function gradesShort(gradeLevels: string | null | undefined, level?: string): string {
  const grades = gradeLevels ? gradeLevels.split(",").map(Number).sort((a, b) => a - b) : level ? LEVEL_GRADES[level] ?? [] : [];
  if (!grades.length) return "Mọi lớp";
  const contiguous = grades.length > 2 && grades.every((g, i) => i === 0 || g === grades[i - 1] + 1);
  return contiguous ? `${grades[0]}–${grades[grades.length - 1]}` : grades.join(", ");
}

/** Sáu cột mà phép tính số phải có đọc (`AdequacyService.Context.required`). */
type CalcFields = Pick<EquipmentNorm, "minQuantity" | "normBasis" | "basisSize" | "gradeLevels" | "optional">;
type Edit = Partial<CalcFields>;

/**
 * Kiểu dòng cần xem — suy từ chính dòng, không lưu:
 * - `noqty`: phụ lục không ghi số (hoặc bộ nạp đọc nhầm chữ vào ô số lượng) — dòng không tính được;
 * - `guess`: phụ lục chỉ ghi một con số ("07"), bộ nạp không biết tính theo gì nên để "theo trường";
 * - `unit`: phụ lục ghi "/…" mà không phải giáo viên, học sinh, lớp, trường, phòng ("01/hố cát");
 * - `dup`: cùng thiết bị ở nhiều dòng — phép tính lấy dòng cho số lớn nhất;
 * - `optional`: dòng tự chọn — không vào đủ / thiếu.
 */
type Flag = "noqty" | "guess" | "unit" | "dup" | "optional" | "ok";
const FLAGS: { key: Flag; label: string; variant: "destructive" | "warning" | "info" | "neutral" }[] = [
  { key: "guess", label: "Đoán theo trường", variant: "warning" },
  { key: "noqty", label: "Chưa có số lượng", variant: "destructive" },
  { key: "unit", label: "Đơn vị lạ", variant: "warning" },
  { key: "dup", label: "Trùng thiết bị", variant: "info" },
  { key: "optional", label: "Tự chọn (không tính)", variant: "neutral" },
];
const BARE_NUMBER = /^\s*\d+(?:[.,]\d+)?\s*$/;
const KNOWN_PER = /\/[^/]*(gv|hs|học sinh|giáo viên|trường|lớp|phòng|phbm)/i;

function flagOf(n: EquipmentNorm & CalcFields, dupCount: number): Flag {
  if (n.optional) return "optional";
  if (n.minQuantity == null) return "noqty";
  const text = n.quantityText ?? "";
  if (n.normBasis === "per_school" && BARE_NUMBER.test(text)) return "guess";
  if (text.includes("/") && !KNOWN_PER.test(text)) return "unit";
  if (dupCount > 1) return "dup";
  return "ok";
}

/** "Phải có" gọn — đọc đúng như `AdequacyService` tính, để người sửa thấy hệ quả ngay trên dòng. */
function formulaOf(n: CalcFields & { subject: EquipmentNorm["subject"] }): string {
  if (n.optional) return "Không tính";
  if (n.minQuantity == null) return "?";
  const q = String(n.minQuantity);
  const size = n.basisSize && n.basisSize > 1 ? n.basisSize : null;
  switch (n.normBasis) {
    case "per_room":
      return `${q} × phòng`;
    case "per_teacher":
      return n.subject?.code === "CHUNG" || !n.subject ? `${q} × tổng GV` : `${q} × GV`;
    case "per_class":
      return size ? `${q} × ⌈lớp ÷ ${size}⌉` : `${q} × lớp`;
    case "per_student":
      return size ? `${q} × ⌈HS ÷ ${size}⌉` : `${q} × HS`;
    default:
      return q;
  }
}

/** Ý nghĩa của "Phải có" khi rê chuột — chữ ngắn trong ô không tự giải thích hết. */
const FORMULA_HINT: Record<string, string> = {
  per_room: "Số lượng × số phòng bộ môn của môn (chưa khai phòng thì tính 1 phòng)",
  per_teacher: "Số lượng × số giáo viên dạy môn",
  per_class: "Số lượng × số lớp của các khối áp dụng (chia cỡ nhóm, làm tròn lên)",
  per_student: "Cộng từng lớp: sĩ số ÷ cỡ nhóm, làm tròn lên, × số lượng",
  per_school: "Cả trường một số lượng",
};

/**
 * Số lượng tối thiểu: mỗi dòng phụ lục một hàng, các cột là ĐÚNG những gì phép tính số phải có dùng —
 * số lượng, tính theo, cỡ nhóm, khối áp dụng, tự chọn (môn để đếm giáo viên / phòng) — đặt cạnh
 * nguyên văn phụ lục và công thức ra. Dòng nghi đọc sai được lọc sẵn; bộ NHÁP sửa thẳng trên ô và
 * sửa nhiều dòng một lần. Bộ đang áp dụng chỉ xem — luật của `EquipmentNormService.requireDraft`.
 */
export function NormMatrix() {
  const { result: standardsResult, query: standardsQuery } = useList<any>({
    resource: "equipment_standards",
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const standards = useMemo(() => standardsResult?.data ?? [], [standardsResult]);
  const levels = useMemo(() => {
    const seen = new Map<number, any>();
    for (const s of standards) if (s.educationLevel && !seen.has(s.educationLevel.id)) seen.set(s.educationLevel.id, s.educationLevel);
    return [...seen.values()];
  }, [standards]);
  const mayWrite = useCan({ resource: NORMS, action: "edit" }).data?.can ?? false;

  const [standardId, setStandardId] = useState<number | null>(null);
  // Cấp học chọn ở menu xổ của tab (?level=). "Ngoài danh mục tối thiểu": thiết bị ngoài thông tư — không có số lượng
  // tối thiểu, hiện đúng bảng của màn Danh mục.
  const { outside, level: pickedLevel } = useLevelParam(levels, levels[0]?.code);
  const [viewingCatalog, setViewingCatalog] = useState<CatalogView | null>(null);
  const currentLevel = pickedLevel ?? levels[0];
  useEffect(() => setStandardId(null), [currentLevel?.id]);
  const levelStandards = standards.filter((s: any) => s.educationLevel?.id === currentLevel?.id);
  // Người sửa được thì mặc định mở bản nháp (nếu có) — đó là bộ duy nhất sửa được.
  const standard =
    levelStandards.find((s: any) => s.id === standardId) ??
    (mayWrite ? levelStandards.find((s: any) => s.status === "DRAFT") : undefined) ??
    levelStandards.find((s: any) => s.status === "ACTIVE") ??
    levelStandards[0];
  const status: StandardStatus = standard?.status ?? "ACTIVE";
  const editable = mayWrite && status === "DRAFT";
  const levelCode: string | undefined = standard?.educationLevel?.code;

  const { result: rowsResult, query: rowsQuery } = useList<EquipmentNorm>({
    resource: NORMS,
    filters: [{ field: "standard.id", operator: "eq", value: standard?.id }],
    pagination: { currentPage: 1, pageSize: 1000 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: !!standard?.id && !outside },
  });
  const rows = useMemo(() => rowsResult?.data ?? [], [rowsResult]);

  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState(ALL);
  const [flag, setFlag] = useState<Flag | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setEdits({});
    setSelected(new Set());
    setSubject(ALL);
    setFlag(ALL);
  }, [standard?.id]);
  useEffect(() => setPage(1), [standard?.id, q, subject, flag]);

  const dupCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rows) if (r.catalog?.id) m.set(r.catalog.id, (m.get(r.catalog.id) ?? 0) + 1);
    return m;
  }, [rows]);

  const view = useMemo(
    () =>
      rows.map((r) => {
        const e = edits[r.id];
        const eff = { ...r, ...e };
        return { row: r, eff, edited: !!e, flag: flagOf(eff, r.catalog?.id ? dupCounts.get(r.catalog.id) ?? 1 : 1) };
      }),
    [rows, edits, dupCounts],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of view) c[v.flag] = (c[v.flag] ?? 0) + 1;
    return c;
  }, [view]);
  const review = (counts.guess ?? 0) + (counts.noqty ?? 0) + (counts.unit ?? 0) + (counts.dup ?? 0);
  const subjects = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(String(r.subject?.id ?? "none"), r.subject?.name ?? "Chưa gắn môn");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const filtered = view.filter(
    (v) =>
      (flag === ALL || v.flag === flag) &&
      (subject === ALL || String(v.row.subject?.id ?? "none") === subject) &&
      (!needle || v.row.name.toLowerCase().includes(needle) || v.row.code.toLowerCase().includes(needle)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);
  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.row.id));

  const edit = (id: number, patch: Edit) => {
    const base = rows.find((r) => r.id === id);
    if (!base) return;
    setEdits((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      // Sửa về đúng giá trị cũ thì dòng không còn là "đã sửa".
      const e = next[id];
      const same = (Object.keys(e) as (keyof Edit)[]).every((k) => (e[k] ?? null) === ((base as any)[k] ?? null));
      if (same) delete next[id];
      return next;
    });
  };
  const editSelected = (patch: Edit) => {
    for (const id of selected) edit(id, patch);
    setSelected(new Set());
  };

  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const [saving, setSaving] = useState(false);
  const editCount = Object.keys(edits).length;
  /** Một yêu cầu cho mọi dòng đã sửa (`PATCH /equipment_norms/batch`) — tất cả hoặc không gì. */
  const save = async () => {
    setSaving(true);
    try {
      const items = Object.entries(edits).map(([id, changes]) => ({ id: Number(id), changes }));
      const res = await kyInstance.patch(`${NORMS}/batch`, { json: { items }, timeout: 120_000 }).json<{ updated: number }>();
      notify?.({ type: "success", message: `Đã lưu ${res.updated} dòng.` });
      setEdits({});
      invalidate({ resource: NORMS, invalidates: ["list"] });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Chưa lưu dòng nào" });
    } finally {
      setSaving(false);
    }
  };

  if (outside) {
    return (
      <ListView>
        <ListViewHeader canCreate={false} title="Số lượng tối thiểu" />
        <OutsideCatalog onOpen={(id) => setViewingCatalog({ id })} />
        <CatalogDetailDialog view={viewingCatalog} editableNorm={false} onClose={() => setViewingCatalog(null)}
          onEditNorm={() => setViewingCatalog(null)} />
      </ListView>
    );
  }

  const cols = editable ? 8 : 7;
  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Số lượng tối thiểu" />

      <div className="flex flex-wrap items-center gap-2">
        {standardsQuery.isLoading ? <Skeleton className="h-6 w-24 rounded-full" /> : null}
        {levelStandards.length > 1 ? (
          <Select value={String(standard?.id ?? "")} onValueChange={(v) => setStandardId(Number(v))}>
            <SelectTrigger className="w-full max-w-[16rem]" aria-label="Bộ"><SelectValue /></SelectTrigger>
            <SelectContent>
              {levelStandards.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{STATUS_LABEL[s.status as StandardStatus] ?? s.status}{s.standardVersion ? ` · ${s.standardVersion}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : standard ? (
          <Badge variant={status === "DRAFT" ? "warning" : status === "ACTIVE" ? "success" : "neutral"}>{STATUS_LABEL[status]}</Badge>
        ) : null}
        {mayWrite && standard && !editable ? (
          <span className="text-muted-foreground text-[0.8125rem]">
            Bộ {STATUS_LABEL[status].toLowerCase()} chỉ xem — sửa trên bản nháp ở{" "}
            <Link to="/equipment-standards" className="text-primary underline-offset-2 hover:underline">Danh mục thiết bị tối thiểu</Link>.
          </span>
        ) : null}
        {mayWrite && standard ? <NormDocumentImport standardId={standard.id} editable={editable} /> : null}
        <div className="ms-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8125rem] text-muted-foreground">
          <span><b className="text-foreground tabular-nums">{rows.length}</b> dòng</span>
          <span><b className="text-foreground tabular-nums">{dupCounts.size}</b> thiết bị</span>
          <span><b className={cn("tabular-nums", review ? "text-warning-text" : "text-foreground")}>{review}</b> dòng cần xem</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="bg-field shadow-e1 focus-within:border-ring flex h-9 w-full max-w-[20rem] items-center gap-2 rounded-full border border-input px-2.5">
          <Search className="text-muted-foreground h-4 w-4" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã, tên thiết bị" aria-label="Tìm"
            className="w-full bg-transparent text-sm outline-none" />
        </label>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-full max-w-[14rem]" aria-label="Môn"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi môn</SelectItem>
            {subjects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo kiểm tra">
          {[{ key: ALL as Flag | typeof ALL, label: "Tất cả", n: rows.length }, ...FLAGS.map((f) => ({ key: f.key as Flag | typeof ALL, label: f.label, n: counts[f.key] ?? 0 }))].map((c) => (
            <button key={c.key} type="button" aria-pressed={flag === c.key} onClick={() => setFlag(c.key)}
              disabled={c.key !== ALL && c.n === 0}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors disabled:opacity-40",
                flag === c.key ? "bg-primary border-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
              {c.label}<span className="tabular-nums font-semibold">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      {editable && selected.size ? (
        <div className="bg-primary/5 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <b>Đã chọn {selected.size} dòng</b>
          <span className="text-muted-foreground ms-2">Tính theo</span>
          <Select value="" onValueChange={(v) => editSelected({ normBasis: v })}>
            <SelectTrigger size="sm" className="w-[12rem]" aria-label="Đổi tính theo cho các dòng đã chọn"><SelectValue placeholder="Vui lòng chọn…" /></SelectTrigger>
            <SelectContent>{BASIS_ORDER.map((b) => <SelectItem key={b} value={b}>{BASIS_SHORT[b]}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={() => editSelected({ optional: true })}>Đánh dấu tự chọn</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => editSelected({ optional: false })}>Bỏ tự chọn</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Bỏ chọn</Button>
        </div>
      ) : null}

      <FillBox>
        <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  {editable ? (
                    <TableHead className="w-10">
                      <Checkbox aria-label="Chọn mọi dòng đang lọc" checked={allFilteredSelected}
                        onCheckedChange={() => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((v) => v.row.id)))} />
                    </TableHead>
                  ) : null}
                  <TableHead className="min-w-[14rem]">Thiết bị</TableHead>
                  <TableHead>Phụ lục</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead>Tính theo</TableHead>
                  <TableHead className="text-right">Cỡ nhóm</TableHead>
                  <TableHead>Khối lớp</TableHead>
                  <TableHead>Phải có</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsQuery.isLoading || standardsQuery.isLoading ? (
                  <TableEmpty colSpan={cols} loading />
                ) : !shown.length ? (
                  <TableEmpty colSpan={cols} filtered={!!needle || flag !== ALL || subject !== ALL}
                    title={rows.length ? "Không có dòng nào khớp bộ lọc." : "Bộ này chưa có thiết bị nào."} />
                ) : (
                  shown.map(({ row, eff, edited, flag: f }) => {
                    const dups = row.catalog?.id ? dupCounts.get(row.catalog.id) ?? 1 : 1;
                    return (
                      <TableRow key={row.id} className={cn(selected.has(row.id) && "bg-primary/5", edited && "bg-info-subtle/70")}>
                        {editable ? (
                          <TableCell>
                            <Checkbox aria-label={`Chọn ${row.name}`} checked={selected.has(row.id)}
                              onCheckedChange={() => setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              })} />
                          </TableCell>
                        ) : null}
                        <TableCell className="min-w-[14rem] max-w-[26rem] whitespace-normal">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                            <span className="font-mono">{row.code}</span>· {row.subject?.name ?? "Chưa gắn môn"}
                            {edited ? <Badge size="sm">Đã sửa</Badge> : null}
                            {eff.optional ? <Badge size="sm" variant="neutral" title="Nhóm tự chọn trong phụ lục — không tính vào đủ / thiếu">Tự chọn</Badge> : null}
                            {dups > 1 ? <Badge size="sm" variant="info" title="Cùng thiết bị ở nhiều dòng — tính theo dòng cao nhất">Trùng {dups} dòng</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span title={f === "noqty" ? "Phụ lục không ghi số — chưa tính được" : f === "unit" ? "Đơn vị phụ lục không khớp cách tính nào" : row.quantityText ?? ""}
                            className={cn("inline-block max-w-[12rem] truncate rounded border px-1.5 py-0.5 font-mono text-xs align-middle",
                              f === "noqty" ? "bg-destructive-subtle text-destructive-text" : f === "unit" ? "bg-warning-subtle text-warning-text" : "bg-muted")}>
                            {row.quantityText || "(trống)"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {editable ? (
                            <Input type="number" min={0} step="any" aria-label={`Số lượng ${row.name}`} className="ms-auto h-8 w-[4.5rem] text-right"
                              value={eff.minQuantity ?? ""} onChange={(e) => edit(row.id, { minQuantity: e.target.value === "" ? null : Number(e.target.value) })} />
                          ) : (eff.minQuantity ?? "—")}
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Select value={eff.normBasis} onValueChange={(v) => edit(row.id, { normBasis: v })}>
                              <SelectTrigger size="sm" className="w-[9.5rem]" aria-label={`Tính theo ${row.name}`}><SelectValue /></SelectTrigger>
                              <SelectContent>{BASIS_ORDER.map((b) => <SelectItem key={b} value={b}>{BASIS_SHORT[b]}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : <span className="whitespace-nowrap">{BASIS_SHORT[eff.normBasis] ?? eff.normBasis}</span>}
                          {f === "guess" ? (
                            <Badge size="sm" variant="warning" className="ms-1.5" title="Phụ lục chỉ ghi một con số — hệ thống đoán là cả trường">đoán</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {editable && (eff.normBasis === "per_class" || eff.normBasis === "per_student") ? (
                            <Input type="number" min={1} aria-label={`Cỡ nhóm ${row.name}`} className="ms-auto h-8 w-[4rem] text-right"
                              value={eff.basisSize ?? ""} onChange={(e) => edit(row.id, { basisSize: e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))) })} />
                          ) : eff.basisSize && eff.basisSize > 1 ? eff.basisSize : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {editable ? (
                            <Input aria-label={`Khối lớp ${row.name}`} placeholder={gradesShort(null, levelCode)} className="h-8 w-[5.5rem]"
                              value={eff.gradeLevels ?? ""} onChange={(e) => edit(row.id, { gradeLevels: e.target.value.replace(/[^0-9,]/g, "") || null })} />
                          ) : gradesShort(eff.gradeLevels, levelCode)}
                        </TableCell>
                        <TableCell title={eff.optional ? "Tự chọn — không tính" : FORMULA_HINT[eff.normBasis]}
                          className={cn("whitespace-nowrap tabular-nums", (eff.optional || f === "noqty") && "text-muted-foreground")}>
                          {formulaOf(eff)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 text-[0.8125rem]">
            <span className="text-muted-foreground">{filtered.length ? `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, filtered.length)} / ${filtered.length} dòng` : "0 dòng"}</span>
            <div className="ms-auto flex items-center gap-1">
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
              <span className="tabular-nums">{page} / {pages}</span>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Trang sau" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
            </div>
            {editCount ? (
              <div className="flex items-center gap-2 border-s ps-3">
                <b>{editCount} dòng đã sửa</b>
                <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEdits({})}>Huỷ</Button>
                <Button type="button" size="sm" disabled={saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu"}</Button>
              </div>
            ) : null}
          </div>
        </div>
      </FillBox>
    </ListView>
  );
}
