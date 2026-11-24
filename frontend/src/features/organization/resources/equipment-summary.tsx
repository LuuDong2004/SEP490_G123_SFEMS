import { useNotification, type CrudFilter } from "@refinedev/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleDashed, DoorOpen, FileSpreadsheet, FoldVertical, School as SchoolIcon, Search, Settings, UnfoldVertical, Warehouse, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { ToolbarFilterSlot, ToolbarLeadExtras, ToolbarTrail, useToolbarMenu } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { errorMessage } from "@/shared/lib/api-error";
import { DEFAULT_PAGE_SIZE, quantityFormat, readableUnit } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { CrossLink } from "@/shared/components/cross-link";
import { HelpHint } from "@/shared/components/form/help-hint";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { downloadSummary, EquipmentExportDialog } from "./equipment-export-dialog";
import { QTY_TONE, hueChip, hueOf } from "./equipment-colors";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

type Row = {
  catalog_id: number;
  code: string;
  name: string;
  tracking_type: "SERIAL" | "BULK";
  minimum_required: boolean | null;
  self_made: boolean | null;
  asset_category: string | null;
  unit: string | null;
  subject: string | null;
  type: string | null;
  room_id?: number | null;
  room?: string;
  school?: string;
  schools: number;
  total: number;
  /** Số HỒ SƠ thiết bị (một tài sản = 1, một lô vật tư = 1) — cộng được qua các mặt hàng khác đơn vị. */
  records: number;
  usable: number | null;
  in_use: number | null;
  in_stock: number | null;
  /** Chuẩn tối thiểu (chỉ bảng Tổng hợp): số phải có và số còn thiếu, cộng trên các trường đang xem. Trống = không thuộc chuẩn. */
  required?: number | null;
  shortage?: number | null;
  short_schools?: number | null;
};

/** Cột số lượng — thứ tự là thứ tự đọc: có bao nhiêu → đang ở đâu. */
const QTY: { key: keyof Row; label: string; tone?: "strong" | "success" | "warning" | "destructive"; hint?: string }[] = [
  { key: "total", label: "Tổng", tone: "strong" },
  { key: "in_use", label: "Đang dùng" },
  { key: "in_stock", label: "Trong kho" },
];

/**
 * Đối chiếu chuẩn tối thiểu (thay cột "Dùng được" — trưởng nhóm 24/11/2026): phải có bao nhiêu, còn thiếu bao nhiêu.
 * Chỉ ở bảng Tổng hợp: chuẩn tính theo trường, không theo kho/phòng.
 */
const NORM: { key: "required" | "shortage"; label: string }[] = [
  { key: "required", label: "Phải có" },
  { key: "shortage", label: "Còn thiếu" },
];

/** Độ rộng cố định của từng cột số (theo độ dài tiêu đề) — cột Thiết bị lấy phần còn lại. */
const COL_W: Record<string, string> = {
  total: "w-20", in_use: "w-24", in_stock: "w-24", required: "w-24", shortage: "w-24",
};

/** Bộ lọc của cây bên trái → tham số của `/equipment/summary` (cùng tên với bộ lọc danh sách). */
function params(filters: CrudFilter[], q: string, by: "catalog" | "room") {
  const out: Record<string, string> = { by };
  for (const f of filters) {
    if ("field" in f && f.value != null && f.value !== "") out[f.field] = String(f.value);
  }
  if (q) out.q = q;
  return out;
}

/** Bộ lọc chỉ nói PHẠM VI đang xem (không lọc thiết bị) — bảng trống với riêng chúng là phạm vi chưa có thiết bị. */
const SCOPE_FIELDS = new Set(["school.id", "schoolBody"]);

const n = (v: number | null | undefined) => Number(v ?? 0);

type SummaryResponse = {
  rows: Row[];
  maxSchools: number;
  /** Theo kho/phòng: tổng số nhóm trường × kho/phòng (phân trang ở máy chủ). */
  total?: number;
  /** Theo kho/phòng: số kho/phòng và số hồ sơ của mỗi trường có trên trang, đếm trên cả danh sách. */
  schoolTotals?: { schoolId: number; school: string | null; rooms: number; records: number }[];
};

/**
 * Màn Thiết bị dạng TỔNG HỢP SỐ LƯỢNG (kiểu "Tổng đầu thiết bị" / "Theo kho/phòng" của
 * MISA): mỗi dòng một mặt hàng — hoặc một mặt hàng trong một kho/phòng — với số lượng tách
 * theo tình trạng. Bấm một dòng: mặt hàng quản lý theo từng cái mở bảng từng tài sản của
 * nó; vật tư tiêu hao mở các chỗ để của nó.
 */
export function EquipmentSummary({ by, filters, drill }: {
  by: "catalog" | "room";
  filters: CrudFilter[];
  drill: (filters: CrudFilter[], label: string) => void;
}) {
  const menu = useToolbarMenu();
  // Ô tìm và trang đang xem nhớ trong phiên của tab: F5 hay mở một tài sản rồi quay lại không mất chỗ (E2E-14).
  const [q, setQ] = usePersistentState<string>("equipment.summary.q", "");
  // Các kho/phòng đang THU GỌN (theo khoá nhóm), nhớ trong phiên của tab.
  const [collapsed, setCollapsed] = usePersistentState<string[]>("equipment.summary.collapsed", []);
  const toggle = (key: string) =>
    setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  const [term, setTerm] = useState(() => q.trim());
  useEffect(() => {
    const id = window.setTimeout(() => setTerm(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const search = params(filters, term, by);
  // Tổng hợp theo thiết bị: máy chủ trả đủ dòng (số mặt hàng), phân trang ở máy khách. Theo kho/phòng:
  // phân trang ở MÁY CHỦ theo nhóm trường × kho/phòng — toàn địa bàn là hàng trăm nghìn dòng, trả hết
  // một lần là treo cả máy chủ lẫn trình duyệt. Một trang là N PHÒNG, không phải N dòng.
  // Mặc định 20 như mọi bảng khác.
  const [page, setPage] = usePersistentState<number>(`equipment.summary.page.${by}`, 1);
  const [pageSize, setPageSize] = usePersistentState<number>(`equipment.summary.size.${by}`, DEFAULT_PAGE_SIZE);
  const searchKey = JSON.stringify(search);
  // Đổi bộ lọc / ô tìm thì về trang 1 — nhưng không ở lần dựng đầu, kẻo xoá trang vừa nhớ.
  const lastKey = useRef(searchKey);
  useEffect(() => {
    if (lastKey.current === searchKey) return;
    lastKey.current = searchKey;
    setPage(1);
  }, [searchKey, setPage]);
  const serverPaged = by === "room";
  const query = serverPaged
    ? { ...search, _start: String((page - 1) * pageSize), _end: String(page * pageSize) }
    : search;
  const { data, isFetching } = useQuery({
    queryKey: ["equipment", "summary", query],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => kyInstance.get("equipment/summary", { signal,  searchParams: query }).json<SummaryResponse>(),
  });
  const { open: notify } = useNotification();
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const multiSchool = (data?.maxSchools ?? 0) > 1 || new Set(rows.map((r) => r.school)).size > 1;

  // Theo kho/phòng: gom các dòng của cùng một phòng dưới một dòng tiêu đề.
  const groups = useMemo(() => {
    if (by !== "room") return [{ key: "all", title: "", roomId: undefined as number | null | undefined, room: undefined as string | undefined, rows }];
    const map = new Map<string, { key: string; title: string; school?: string; roomId?: number | null; room?: string; rows: Row[] }>();
    for (const r of rows) {
      const key = `${r.school}|${r.room_id ?? "none"}`;
      if (!map.has(key)) map.set(key, { key, title: r.room ?? "", school: r.school, roomId: r.room_id ?? null, room: r.room, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()];
  }, [by, rows, multiSchool]);

  // Tên trùng nhau (cùng thiết bị ở danh mục hai cấp học — "Bản đồ hành chính Việt Nam" của TH và THCS) thì gắn
  // cấp học lấy từ đầu mã danh mục, kẻo hai dòng giống hệt nhau không biết dòng nào là gì (E2E-16). Chỉ ở góc nhìn
  // quản lý — tài khoản trường không gắn nhãn này.
  const dupNames = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.name, (seen.get(r.name) ?? 0) + 1);
    return new Set([...seen].filter(([, c]) => c > 1).map(([name]) => name));
  }, [rows]);

  // Nhiều trường (Sở, UBND): các kho/phòng đứng dưới tên TRƯỜNG của chúng. Số kho/phòng và số tài sản của
  // mỗi trường do máy chủ đếm trên cả danh sách, không chỉ trang đang xem.
  const schoolTotals = useMemo(() => {
    const out = new Map<string, { rooms: number; records: number }>();
    for (const t of data?.schoolTotals ?? []) out.set(t.school ?? "", { rooms: n(t.rooms), records: n(t.records) });
    return out;
  }, [data]);

  const unitCount = serverPaged ? n(data?.total) : rows.length;
  const pageCount = Math.max(1, Math.ceil(unitCount / pageSize));
  const current = Math.min(page, pageCount);
  // Lọc lại làm danh sách ngắn đi mà đang đứng ở trang sau cùng: kéo về trang cuối còn dữ liệu.
  useEffect(() => {
    if (serverPaged && data && page > pageCount) setPage(pageCount);
  }, [serverPaged, data, page, pageCount, setPage]);
  const offset = (current - 1) * pageSize;
  const pageGroups = serverPaged ? groups : [{ ...groups[0], rows: rows.slice(offset, offset + pageSize) }];


  // Bấm một dòng: mở bảng Chi tiết lọc theo mặt hàng (và phòng) — tài sản từng cái lẫn lô
  // đều ở đó, nên không còn phải rẽ sang một tab riêng cho vật tư tiêu hao.
  const open = (r: Row) => {
    const extra: CrudFilter[] = [{ field: "catalog.id", operator: "eq", value: r.catalog_id }];
    if (by === "room") extra.push({ field: "room.id", operator: "eq", value: r.room_id ?? "none" });
    drill(extra, by === "room" ? `${r.name} — ${r.room}` : r.name);
  };

  // Xuất ra tệp Excel thật do máy chủ dựng, cùng bộ lọc đang xem: số lượng là ô SỐ có ngăn hàng nghìn
  // (15.750), không phải chữ số trơn của CSV — "15750" đọc dễ nhầm với 15,75.
  // Cơ quan quản lý (thấy nhiều trường): hộp chọn trường và "mỗi trường một trang tính". Tài khoản của một
  // trường: tải thẳng.
  const { perspective } = usePerspective();
  const [exportOpen, setExportOpen] = useState(false);
  const exportName = by === "room" ? "Thiết bị theo kho phòng.xlsx" : "Thiết bị tổng hợp.xlsx";
  const exportExcel = async () => {
    if (perspective !== "school") {
      setExportOpen(true);
      return;
    }
    try {
      await downloadSummary(search, exportName);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    }
  };

  // Cột Môn chỉ hiện khi có mặt hàng gắn môn — một cột toàn "—" chỉ chiếm chỗ.
  const showSubject = rows.some((r) => r.subject);
  const norm = by === "catalog" ? NORM : [];
  const cols = 3 + (showSubject ? 1 : 0) + QTY.length + norm.length;
  return (
    <section className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <EquipmentExportDialog open={exportOpen} onOpenChange={setExportOpen} params={search} filename={exportName} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-0 flex-1 basis-40 sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã DM thiết bị…" aria-label="Tìm thiết bị"
            className="pr-9 pl-8" />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Xoá" className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {/* Ô trường và Bộ lọc (từ cột trái, qua portal) — nút chỉ biểu tượng. */}
        <ToolbarFilterSlot />
        <ToolbarLeadExtras />
        {/* Không đếm "N dòng": số dòng của bảng tổng hợp không nói gì — con số người đọc cần là
            số thiết bị, đã có trên cột trái và trên từng nhóm. */}
        <div className="flex items-center gap-2 sm:ms-auto">
        <ToolbarTrail />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác">
              <Settings />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {menu ? (
              <>
                {menu}
                <DropdownMenuSeparator />
              </>
            ) : null}
            {by === "room" && groups.length > 1 ? (
              !groups.every((g) => collapsed.includes(g.key)) ? (
                <DropdownMenuItem onSelect={() => setCollapsed((c) => [...new Set([...c, ...groups.map((g) => g.key)])])}>
                  <FoldVertical />
                  Thu gọn tất cả
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setCollapsed((c) => c.filter((k) => !groups.some((g) => g.key === k)))}>
                  <UnfoldVertical />
                  Mở tất cả
                </DropdownMenuItem>
              )
            ) : null}
            <DropdownMenuItem disabled={!rows.length} onSelect={() => void exportExcel()}>
              <FileSpreadsheet />
              Xuất Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-auto [&_tbody_tr:last-child]:border-b">
        {/* Độ rộng cột CỐ ĐỊNH (`table-fixed` + `colgroup`): để tự co theo nội dung thì thu gọn
            một kho/phòng — các dòng mặt hàng biến mất — làm cả bảng tính lại và cột xê dịch. */}
        <table className="w-full min-w-[56rem] table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            <col />
            {showSubject ? <col className="w-40" /> : null}
            <col className="w-20" />
            {[...QTY, ...norm].map((c) => (
              <col key={c.key} className={COL_W[c.key as string] ?? "w-20"} />
            ))}
          </colgroup>
          {/* Đầu bảng nền trung tính (xám nhạt), không xanh: màu xanh dành cho điều hướng và nút chính; dữ liệu nổi lên
              bằng sắc riêng của từng cột số. */}
          {/* Đầu bảng kẻ ô rõ ràng, nền xanh nhạt của hệ thống: mỗi cột một ô có vạch dọc, nhóm "Số lượng" có vạch ngang
              ngăn với các cột con; tiêu đề cột số mang màu của chính cột đó. */}
          {/* Vạch kẻ màu chính đậm vừa: vẽ bằng bóng đổ TRONG từng ô (vạch trái + vạch đáy), không bằng viền — bảng gộp
              viền thì viền thuộc lưới của bảng, đầu bảng dính khi cuộn sẽ mất vạch; bóng đổ đi theo ô. Ô đầu hàng không có
              vạch trái. */}
          <thead style={{ "--hl": "color-mix(in oklch, var(--primary) 35%, transparent)" } as React.CSSProperties}
            className="bg-table-head sticky top-0 z-10 [&_th]:border-transparent [&_th]:font-semibold [&_th]:shadow-[inset_1px_0_0_var(--hl),inset_0_-1px_0_var(--hl)] [&_tr]:border-transparent [&_tr:first-child>th:first-child]:shadow-[inset_0_-1px_0_var(--hl)]">
            {/* Chữ tiêu đề màu đen hết (trưởng nhóm 24/11/2026): màu riêng chỉ ở số trong ô. */}
            <tr className="text-overline text-foreground border-b">
              <th rowSpan={2} className="w-12 border-e px-3 py-2 text-center align-middle">STT</th>
              <th rowSpan={2} className="border-e px-3 py-2 text-start align-middle">Thiết bị</th>
              {showSubject ? <th rowSpan={2} className="border-e px-3 py-2 text-start align-middle whitespace-nowrap">Môn</th> : null}
              <th rowSpan={2} className="px-3 py-2 text-start align-middle">ĐVT</th>
              <th colSpan={QTY.length} className="text-foreground border-s border-b px-3 py-1.5 text-center tracking-widest">Số lượng</th>
              {norm.length ? (
                <th colSpan={norm.length} className="text-foreground border-b px-3 py-1.5 text-center tracking-widest">
                  Chuẩn tối thiểu
                  <HelpHint className="ms-1">
                    Phải có: số lượng tối thiểu theo thông tư, cộng trên các trường đang xem (trường đã nhập thiết bị). Còn thiếu:
                    cộng phần thiếu của từng trường.
                  </HelpHint>
                </th>
              ) : null}
            </tr>
            <tr className="text-overline text-foreground border-b">
              {QTY.map((c) => (
                <th key={c.key} className={cn("border-s px-2 py-1.5 text-end whitespace-nowrap")}>
                  {c.label}
                  {c.hint ? <HelpHint className="ms-1">{c.hint}</HelpHint> : null}
                </th>
              ))}
              {norm.map((c) => (
                <th key={c.key} className={cn("px-2 py-1.5 text-end whitespace-nowrap")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (() => {
              // Chỉ lọc theo PHẠM VI (trường / cơ quan) mà vẫn trống = phạm vi đó chưa có thiết bị nào — không phải do
              // bộ lọc; chỉ lối vào sổ: ghi tăng hoặc nhập dữ liệu đầu vào.
              const filtered = !!term || filters.some((f) => "field" in f && !SCOPE_FIELDS.has(f.field));
              return (
                <TableEmpty colSpan={cols} loading={isFetching} filtered={filtered}
                  title={filtered ? "Không có thiết bị nào khớp bộ lọc." : filters.some((f) => "field" in f && f.field === "school.id") ? "Trường này chưa có thiết bị nào." : "Chưa có thiết bị nào trong hệ thống."}
                  description={filtered ? undefined : (
                    <span className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                      <CrossLink to="/equipment-intakes/create" resource="equipment_intakes" action="create" plain className="text-primary hover:underline">Lập phiếu ghi tăng</CrossLink>
                      <CrossLink to="/data-imports" resource="data_imports" action="list" plain className="text-primary hover:underline">Nhập dữ liệu đầu vào</CrossLink>
                    </span>
                  )} />
              );
            })() : null}
            {pageGroups.map((g, gi) => {
              // Tổng hợp: số thứ tự chạy tiếp qua các trang. Theo phòng: đếm lại trong từng phòng.
              let stt = by === "room" ? 0 : offset;
              const school = (g as { school?: string }).school;
              const newSchool = by === "room" && multiSchool && (gi === 0 || (pageGroups[gi - 1] as { school?: string }).school !== school);
              const totals = schoolTotals.get(school ?? "");
              return (
                <Fragment key={g.key}>
                  {newSchool ? (
                    <tr className="bg-surface-subtle border-b">
                      <td colSpan={cols} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <SchoolIcon className="text-muted-foreground size-4 shrink-0" />
                          <span className="font-semibold">{school}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {totals ? `${totals.rooms} kho/phòng · ${totals.records.toLocaleString("vi-VN", { useGrouping: false })} thiết bị` : ""}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {g.title ? (() => {
                    // Dòng một kho/phòng là dòng TỔNG của nó: các cột số cộng các dòng bên dưới. Chỉ cộng thiết bị
                    // quản lý theo từng cái (đơn vị là cái / bộ); vật tư tiêu hao tính theo kg, lít… không cộng
                    // lẫn vào được, chúng vẫn hiện đủ ở dòng riêng.
                    const counted = g.rows.filter((r) => r.tracking_type !== "BULK");
                    const bulk = g.rows.length - counted.length;
                    const expanded = !collapsed.includes(g.key);
                    return (
                      <tr className={cn("hover:bg-muted/60 cursor-pointer border-b select-none", expanded && "bg-muted hover:bg-muted/70",
                        // Chưa xếp phòng: tô đỏ cả dòng — việc còn dở, phải giao thiết bị về phòng.
                        g.roomId == null && "bg-destructive/10 hover:bg-destructive/15 text-destructive-text")} onClick={() => toggle(g.key)}
                        aria-expanded={expanded} title={expanded ? "Thu gọn" : "Mở danh sách"}>
                        <td colSpan={cols - QTY.length} className="px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform", expanded && "rotate-90")} />
                            <span className={cn("shrink-0 [&_svg]:size-4", g.roomId == null ? "text-destructive-text" : "text-primary")}>
                              {g.roomId == null ? <CircleDashed /> : /kho/i.test(g.room ?? "") ? <Warehouse /> : <DoorOpen />}
                            </span>
                            <span className="truncate text-[0.9375rem] font-semibold">{g.title}</span>
                            <span className="bg-card text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums">
                              {g.rows.length} loại thiết bị
                            </span>
                          </div>
                        </td>
                        {QTY.map((c, i) => {
                          const v = counted.reduce((sum, r) => sum + n(r[c.key] as number), 0);
                          return (
                            <td key={c.key} className={cn("px-2 py-2.5 text-end font-semibold tabular-nums", i === 0 && "border-s",
                              v === 0 ? "text-muted-foreground/40" : QTY_TONE[c.key as string]?.text)}
                              title={bulk ? `Không cộng ${bulk} loại vật tư tiêu hao (tính theo kg, lít…)` : undefined}>
                              {quantityFormat.format(v)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })() : null}
                  {(collapsed.includes(g.key) ? [] : g.rows).map((r) => {
                    stt += 1;
                    return (
                      <tr key={`${r.catalog_id}-${r.room_id ?? ""}-${r.school ?? ""}`} onClick={() => open(r)}
                        className={cn("cursor-pointer border-b last:border-b-0", LIFT_ROW)}
                        title={r.tracking_type === "BULK" ? "Mở các lô của thiết bị này" : "Mở danh sách từng cái của thiết bị này"}>
                        <td className="text-muted-foreground px-3 py-2.5 text-center tabular-nums">{stt}</td>
                        {/* Không có dòng mã dưới tên — mã nằm trong chú thích khi rê chuột và trong tệp xuất. */}
                        <td className="px-3 py-2.5" title={`${r.name} · ${r.code}${r.type ? ` · ${r.type}` : ""}${r.tracking_type === "BULK" ? " · vật tư tiêu hao" : ""}`}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{r.name}</span>
                            {perspective !== "school" && dupNames.has(r.name) && r.code ? (
                              <span className="text-muted-foreground shrink-0 rounded-md border px-1.5 py-px text-[0.6875rem] font-medium" title={r.code}>
                                {/^(TH|THCS|THPT|GDTX)-/.test(r.code) ? r.code.split("-")[0] : r.code}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {showSubject ? (
                          <td className="px-3 py-2" title={r.subject ?? undefined}>
                            {r.subject ? (
                              <span className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium align-middle"
                                style={hueChip(hueOf(r.subject))}>{r.subject}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        ) : null}
                        <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap">{readableUnit(n(r.total as number), r.unit).unit ?? "—"}</td>
                        {QTY.map((c, i) => {
                          // Cả dòng theo MỘT đơn vị, chọn theo cột Tổng: 15.750 gam hiện 15,75 kg.
                          const v = n(r[c.key] as number) / readableUnit(n(r.total as number), r.unit).factor;
                          return (
                            <td key={c.key} className={cn("px-2 py-2.5 text-end tabular-nums", i === 0 && "border-s",
                              v === 0 ? "text-muted-foreground/40" : QTY_TONE[c.key as string]?.text)}>
                              {quantityFormat.format(v)}
                            </td>
                          );
                        })}
                        {norm.length && r.required == null ? (
                          <td colSpan={norm.length} className="text-muted-foreground px-2 py-2.5 text-center text-xs italic">
                            Ngoài danh mục
                          </td>
                        ) : norm.map((c) => {
                          const factor = readableUnit(n(r.total as number), r.unit).factor;
                          const v = n(r[c.key] as number) / factor;
                          const short = c.key === "shortage";
                          return (
                            <td key={c.key} className={cn("px-2 py-2.5 text-end tabular-nums",
                              short && v === 0 ? "text-success-text font-medium" : QTY_TONE[c.key]?.text)}
                              title={short && v > 0 ? `${r.short_schools ?? 0} trường còn thiếu` : undefined}>
                              {short && v === 0 ? "Đủ" : quantityFormat.format(v)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {unitCount > 0 ? (
        <div data-print="hide" className="shrink-0 border-t px-3 py-1.5">
          <DataTablePagination
            currentPage={current}
            pageCount={pageCount}
            setCurrentPage={setPage}
            pageSize={pageSize}
            setPageSize={(size) => { setPageSize(size); setPage(1); }}
            total={unitCount}
            pageSizeLabel={by === "room" ? "Số kho/phòng mỗi trang" : "Số thiết bị mỗi trang"}
          />
        </div>
      ) : null}
    </section>
  );
}
