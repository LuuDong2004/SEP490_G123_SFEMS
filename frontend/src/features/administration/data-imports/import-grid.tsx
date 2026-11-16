import "@glideapps/glide-data-grid/dist/index.css";
import "./import-grid.css";

import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type EditListItem,
  type GridCell,
  type GridColumn,
  type GridMouseEventArgs,
  type GridSelection,
  type Item,
  type ProvideEditorCallback,
  type ProvideEditorComponent,
  type TextCell,
  type DataEditorRef,
  type DrawCellCallback,
  type DrawHeaderCallback,
  type Theme,
} from "@glideapps/glide-data-grid";
import { Columns3, Eye, EyeOff, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useTheme } from "@/shared/components/theme/theme-provider";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { Button } from "@/shared/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import {
  CATALOG_MATCH,
  IMPORT_ROW_STATUS,
  type ImportMessage,
  type ImportRow,
  type ImportRowStatus,
  type ImportSheetInfo,
} from "@/domains/data-import/types";

import { choiceEditor } from "./choice-editor";
import { EDIT_SOURCE } from "./edit-history";
import type { SortState } from "./view";

/** Một lần sửa gửi lên máy chủ: các ô đổi của một dòng, hoặc bỏ / dùng lại dòng. */
export type RowEdit = { rowId: number; data?: Record<string, string>; skipped?: boolean; source?: "rule" | "ai" };

/**
 * Lưới kiểu Excel của vùng chờ (Glide Data Grid, vẽ bằng canvas): gõ thẳng vào ô, dán cả khối từ Excel,
 * kéo góc ô để điền xuống, Delete xoá ô; chuột phải để thêm / xoá / bỏ dòng. Ô lỗi tô đỏ, ô có lưu ý tô vàng; rê chuột vào ô là
 * hiện lời nhắn. Mọi lần sửa (một ô hay cả khối dán) đi lên máy chủ thành MỘT lần gọi — máy chủ kiểm lại cả lô
 * một lần.
 */
export function ImportGrid({ sheet, rows, editable, isEquipment, toolbar, filters, onEdit, onAddRow, onDeleteRows, viewKey, sort, onSort, search, onSearch, onVisibleChange, choices, focus }: {
  sheet: ImportSheetInfo;
  /** Đến một dòng (theo số dòng trên tệp) — bấm toast lỗi: cuộn tới và chọn ô lỗi đầu tiên của dòng. `n` đổi mỗi lần bấm. */
  focus?: { rowNo: number; n: number } | null;
  rows: ImportRow[];
  editable: boolean;
  isEquipment: boolean;
  toolbar?: ReactNode;
  /** Bộ lọc trạng thái — đứng ngay sau ô tìm, tách khỏi các nút việc làm bên phải. */
  filters?: ReactNode;
  /** Báo vùng dòng đang hiện (dòng đầu, số dòng) — màn ngoài vẽ "1–21 / 171 dòng" ở chân trang. */
  onVisibleChange?: (first: number, count: number) => void;
  onEdit: (edits: RowEdit[]) => void;
  /** Thêm một dòng trống ở cuối (nút Thêm dòng, menu chuột phải). */
  onAddRow: () => Promise<void>;
  /** Xoá hẳn các dòng khỏi lô. */
  onDeleteRows: (rowIds: number[]) => void;
  /** Đổi khi lọc / tìm / sắp xếp lại — chọn dòng cũ không còn đúng chỗ. */
  viewKey: string;
  sort: SortState;
  /** Bấm tiêu đề cột: A→Z, Z→A, bỏ xếp. */
  onSort: (key: string) => void;
  search: string;
  onSearch: (value: string) => void;
  /** Giá trị chọn được theo cột của trang: cột có ở đây mở danh sách chọn thay cho gõ tay. */
  choices?: Record<string, string[]>;
}) {
  const theme = useGridTheme();
  const [widths, setWidths] = useState<Record<string, number>>(() => readWidths(sheet.key));
  const [selection, setSelection] = useState<GridSelection>(EMPTY_SELECTION);
  // Ô đang mở để sửa là ô đang chọn: `provideEditor` chỉ nhận ô, không nhận cột.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const gridRef = useRef<DataEditorRef>(null);
  /** Các dòng menu chuột phải sẽ tác động: dòng vừa bấm, hoặc cả các dòng đang chọn nếu bấm vào một trong số đó. */
  const [menuRows, setMenuRows] = useState<number[]>([]);
  /** Vừa thêm dòng trống: dòng mới hiện ở cuối thì cuộn tới và chọn ô đầu để gõ luôn. */
  const jumpToEnd = useRef(false);
  const [tip, setTip] = useState<Tip | null>(null);
  // Lưới cao vừa phần còn lại của cửa sổ: thanh trượt ngang ở đáy lưới luôn trong tầm mắt, trang không phải cuộn
  // thêm một lớp. Chừa chỗ cho dòng chân "Đang xem …" và lề dưới của thẻ.
  // Chừa chỗ cho hàng tab trang tính dưới chân bảng (batch.tsx) và lề dưới.
  const fill = useFillHeight(56, 1024, 360);
  /** Dòng đang thấy trên màn hình — thay cho phân trang: lưới chỉ vẽ phần đang thấy, nghìn dòng vẫn nhẹ. */
  const [visible, setVisible] = useState({ first: 0, count: 0 });
  useEffect(() => { onVisibleChange?.(visible.first, visible.count); }, [visible, onVisibleChange]);
  /** Giá trị vừa gõ, hiện ngay trong lúc chờ máy chủ kiểm lại — tránh ô nháy về giá trị cũ. */
  const [pending, setPending] = useState<Record<number, Record<string, string>>>({});

  useEffect(() => setSelection(EMPTY_SELECTION), [viewKey]);

  // Dữ liệu mới từ máy chủ: bỏ những giá trị chờ đã khớp; dòng đã đổi chỗ nên khung lời nhắn cũ không còn đúng.
  useEffect(() => {
    setTip(null);
    setPending((p) => {
      const next: typeof p = {};
      for (const r of rows) {
        const left = Object.entries(p[r.id] ?? {}).filter(([k, v]) => (r.data[k] ?? "") !== v);
        if (left.length) next[r.id] = Object.fromEntries(left);
      }
      return next;
    });
  }, [rows]);

  const allColumns = useMemo<Col[]>(() => { const sample = rows.slice(0, 300); return [
    { id: "_row", title: "Dòng", width: 64 },
    ...sheet.columns.map((c) => ({
      id: c.key,
      key: c.key,
      title: c.label,
      required: c.required,
      hint: c.hint,
      width: fitWidth(c.label, sample.map((r) => r.data[c.key] ?? ""), 440),
    })),
    // Phần hệ thống hiểu được nằm SAU dữ liệu của trường, như cột ghi chú cuối bảng Excel: các cột đầu đúng thứ tự tệp mẫu.
    ...(isEquipment ? [{ id: "_catalog", title: "Thiết bị trong danh mục", width: 280 }] : []),
    // Lô danh mục: so dòng với dữ liệu đang có — thêm mới, cập nhật những gì, không đổi.
    ...(sheet.key === "schools" || sheet.key === "wards"
      ? [{ id: "_change", title: "So với hệ thống", width: fitWidth("So với hệ thống", sample.map((r) => String(r.resolved.change ?? "")), 360),
        hint: "Dòng này khác gì dữ liệu đang có trên hệ thống: Thêm mới (chưa có), Cập nhật + các trường đổi, Không đổi (giống hệt)." }] : []),
    // Kết quả: đủ rộng cho nhãn dài nhất có thể hiện, không chỉ nhãn đang có trên trang.
    { id: "_status", title: "Kết quả", width: fitWidth("Kết quả", Object.values(IMPORT_ROW_STATUS), 240, 1) },
    { id: "_messages", title: "Lỗi / lưu ý", width: fitWidth("Lỗi / lưu ý", sample.map(messageText), 560, 0.9, 240) },
    // Độ rộng chỉ tính lúc đổi trang / bộ lọc, không theo từng lần sửa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]; }, [sheet, isEquipment, rows.length > 0]);
  // Ẩn / hiện cột, nhớ theo từng trang của tệp (chỉ là tiện cho người xem — đọc / ghi hỏng thì hiện đủ cột).
  const [hidden, setHidden] = useState<string[]>(() => readHidden(sheet.key));
  const toggleColumn = (id: string, show: boolean) => {
    const next = show ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    writeHidden(sheet.key, next);
  };
  const columns = useMemo(() => allColumns.filter((c) => c.id === "_row" || !hidden.includes(c.id)), [allColumns, hidden]);

  const gridColumns = useMemo<GridColumn[]>(
    () => columns.map((c) => ({
      id: c.id,
      // Chừa chỗ cho dấu * đỏ (vẽ ở `drawHeader`) trước mũi tên sắp xếp.
      title: c.title + (c.required ? "    " : "") + (sort?.key === c.id ? (sort.dir === "asc" ? "  ▲" : "  ▼") : ""),
      width: widths[c.id] ?? c.width,
    })),
    [columns, widths, sort],
  );

  // Mỗi cột một editor, giữ nguyên giữa các lần vẽ (tạo lại là hộp chọn mất trạng thái đang tìm).
  const editors = useRef(new Map<string, ProvideEditorComponent<TextCell>>());
  useEffect(() => { editors.current.clear(); }, [choices]);
  const provideEditor = useCallback<ProvideEditorCallback<GridCell>>((cell) => {
    if (cell.kind !== GridCellKind.Text || cell.readonly) return undefined;
    const key = columns[selectionRef.current.current?.cell[0] ?? -1]?.key;
    const options = key ? choices?.[key] : undefined;
    if (!key || !options?.length) return undefined;
    let editor = editors.current.get(key);
    if (!editor) {
      editor = choiceEditor(options);
      editors.current.set(key, editor);
    }
    return { editor: editor as unknown as ProvideEditorComponent<GridCell>, disablePadding: true, disableStyling: true };
  }, [columns, choices]);

  const valueOf = useCallback((r: ImportRow, key: string) => pending[r.id]?.[key] ?? r.data[key] ?? "", [pending]);

  const getCellContent = useCallback(([col, row]: Item): GridCell => {
    const r = rows[row];
    const c = columns[col];
    // Cột chỉ xem nền xám nhẹ như ô bị khoá của Excel — tô theo ô, không theo cột: theme của cột làm Glide
    // vẽ tiêu đề cột đó theo kiểu mặc định, lệch với các cột khác.
    const readonlyText = (text: string, o?: Partial<Theme>) => plainText(text, { bgCell: theme.bgCellMedium, ...o });
    if (!r || !c) return readonlyText("");
    switch (c.id) {
      case "_row":
        // Dòng đã được sửa (tay, sửa nhanh hay AI): ô số dòng tô xanh chủ đạo để nhận ra ngay.
        return readonlyText(String(r.rowNo), r.editSource ? theme.editAi : undefined);
      case "_status":
        return readonlyText(IMPORT_ROW_STATUS[r.status], theme.statusCell[r.status]);
      case "_messages":
        // Lỗi trước lưu ý, mỗi câu ghi rõ là Lỗi hay Lưu ý: dòng vừa có lưu ý vừa có lỗi không còn nhìn như chỉ có lưu ý.
        return readonlyText(messageText(r), r.messages.length ? theme.statusCell[r.status] : undefined);
      case "_change":
        return readonlyText(String(r.resolved.change ?? ""));
      case "_catalog":
        // Thiết bị đã ghép được với danh mục: chữ xanh gạch chân, bấm mở hồ sơ thiết bị (`drawCell`, `onCellClicked`).
        return r.resolved.catalogId
          ? { ...readonlyText(catalogText(r), { textDark: theme.link }), cursor: "pointer" }
          : readonlyText(catalogText(r), r.resolved.match === "new" ? { textDark: theme.warningText } : undefined);
    }
    const key = c.key!;
    const value = valueOf(r, key);
    const level = levelOf(r.messages, key);
    // Ô đã sửa: nền xanh nhạt + nhãn nói ai sửa (Sửa tay / Sửa nhanh / AI) ở góc (`drawCell`);
    // lỗi vẫn ưu tiên đỏ. Nguồn chi tiết (AI / sửa nhanh) xem ở tab Lịch sử.
    const edited = r.editedCells?.[key];
    return {
      kind: GridCellKind.Text,
      data: value,
      displayData: value,
      allowOverlay: true,
      readonly: !editable,
      themeOverride: level === "error" ? { bgCell: theme.errorBg, textDark: theme.errorText }
        : level === "warning" ? { bgCell: theme.warningBg }
          : edited ? { bgCell: theme.editAi.bgCell, textDark: theme.editAi.textDark } : undefined,
    };
  }, [rows, columns, editable, theme, valueOf]);

  /** Ô "Thiết bị trong danh mục" có liên kết: vẽ như thường rồi kẻ gạch chân dưới chữ. */
  const drawCell = useCallback<DrawCellCallback>((args, drawContent) => {
    drawContent();
    const c = columns[args.col];
    const r = rows[args.row];
    // Ô đã sửa: nhãn nhỏ ở góc trên phải nói ai sửa. Chỉ nhãn AI mang màu chủ đạo, để nhận ra ô máy đổi.
    const editedBy = c?.key ? r?.editedCells?.[c.key] : undefined;
    if (editedBy) {
      const { ctx, rect } = args;
      const label = EDIT_SOURCE[editedBy].label;
      ctx.save();
      ctx.font = `700 9px ${args.theme.fontFamily}`;
      const w = ctx.measureText(label).width + 6;
      const x = rect.x + rect.width - w - 2;
      const y = rect.y + 2;
      ctx.fillStyle = (editedBy === "ai" ? theme.editAi.textDark : theme.textLight) as string;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 12, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 3, y + 6.5);
      ctx.restore();
    }
    if (c?.id !== "_catalog" || !r?.resolved.catalogId || args.cell.kind !== GridCellKind.Text) return;
    const { ctx, rect, theme: t } = args;
    ctx.save();
    ctx.font = `${t.baseFontStyle} ${t.fontFamily}`;
    const x = rect.x + t.cellHorizontalPadding;
    const width = Math.min(ctx.measureText(args.cell.displayData).width, rect.width - 2 * t.cellHorizontalPadding);
    const y = Math.round(rect.y + rect.height / 2 + 7) + 0.5;
    ctx.strokeStyle = theme.link;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
    ctx.restore();
  }, [columns, rows, theme.link, theme.editAi, theme.textLight]);

  /** Tiêu đề cột bắt buộc: dấu * màu đỏ ngay sau tên cột. */
  const drawHeader = useCallback<DrawHeaderCallback>((args, drawContent) => {
    drawContent();
    const c = columns[args.columnIndex];
    if (!c?.required) return;
    const { ctx, rect, theme: t } = args;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.font = `${t.headerFontStyle} ${t.fontFamily}`;
    const x = rect.x + t.cellHorizontalPadding + ctx.measureText(c.title).width + 3;
    ctx.fillStyle = theme.errorText;
    ctx.textBaseline = "middle";
    ctx.fillText("*", x, rect.y + rect.height / 2 + 1);
    ctx.restore();
  }, [columns, theme.errorText]);

  const onCellsEdited = useCallback((items: readonly EditListItem[]) => {
    const byRow = new Map<number, Record<string, string>>();
    for (const { location: [col, row], value } of items) {
      const r = rows[row];
      const key = columns[col]?.key;
      if (!r || !key || value.kind !== GridCellKind.Text) continue;
      const v = (value.data ?? "").trim();
      if (v === valueOf(r, key).trim()) continue;
      byRow.set(r.id, { ...byRow.get(r.id), [key]: v });
    }
    setTip(null);
    if (byRow.size) {
      setPending((p) => {
        const next = { ...p };
        byRow.forEach((data, id) => { next[id] = { ...next[id], ...data }; });
        return next;
      });
      onEdit([...byRow].map(([rowId, data]) => ({ rowId, data })));
    }
    return true;
  }, [rows, columns, valueOf, onEdit]);

  const onItemHovered = useCallback((a: GridMouseEventArgs) => {
    if (a.kind !== "cell" && a.kind !== "header") { setTip(null); return; }
    const [col, row] = a.location;
    const c = columns[col];
    const at = { x: a.bounds.x, y: a.bounds.y + a.bounds.height + 4 };
    if (a.kind === "header") {
      setTip(c?.hint ? { ...at, lines: [{ level: "hint", text: c.hint }] } : null);
      return;
    }
    const r = rows[row];
    if (!r || !c) { setTip(null); return; }
    const lines = c.key ? r.messages.filter((m) => m.field === c.key)
      : c.id === "_messages" || c.id === "_status" ? r.messages : [];
    setTip(lines.length ? { ...at, lines } : null);
  }, [rows, columns]);

  useEffect(() => {
    if (!jumpToEnd.current || !rows.length) return;
    jumpToEnd.current = false;
    const last = rows.length - 1;
    gridRef.current?.scrollTo(1, last);
    setSelection({ ...EMPTY_SELECTION, current: { cell: [1, last], range: { x: 1, y: last, width: 1, height: 1 }, rangeStack: [] } });
  }, [rows.length]);

  // Bấm toast lỗi ("Trang Thiết bị, dòng 8: …"): chờ dòng về, cuộn tới, chọn ô của lỗi đầu tiên (không có thì ô đầu).
  const focused = useRef(0);
  useEffect(() => {
    if (!focus || focused.current === focus.n) return;
    const index = rows.findIndex((r) => r.rowNo === focus.rowNo);
    if (index < 0) return;
    focused.current = focus.n;
    const messages = rows[index].messages ?? [];
    const field = (messages.find((m) => m.level === "error") ?? messages[0])?.field;
    const found = field ? columns.findIndex((c) => c.key === field) : -1;
    const col = found > 0 ? found : 1;
    gridRef.current?.scrollTo(col, index);
    setSelection({ ...EMPTY_SELECTION, current: { cell: [col, index], range: { x: col, y: index, width: 1, height: 1 }, rangeStack: [] } });
  }, [focus, rows, columns]);

  const onCellContextMenu = ([col, row]: Item) => {
    if (selection.rows.hasIndex(row)) {
      setMenuRows(selection.rows.toArray());
      return;
    }
    setMenuRows([row]);
    setSelection({ ...EMPTY_SELECTION, current: { cell: [col, row], range: { x: col, y: row, width: 1, height: 1 }, rangeStack: [] } });
  };
  const menuTargets = menuRows.map((i) => rows[i]).filter(Boolean);
  const addRow = () => { jumpToEnd.current = true; void onAddRow(); };

  const selectedRows = selection.rows.toArray().map((i) => rows[i]).filter(Boolean);
  const skip = (skipped: boolean) => {
    const target = selectedRows.filter((r) => r.skipped !== skipped);
    if (target.length) onEdit(target.map((r) => ({ rowId: r.id, skipped })));
    setSelection(EMPTY_SELECTION);
  };

  return (
    <div className="grid gap-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        {/* Ô tìm bên trái; bộ lọc; bên phải: Thêm dòng, AI sửa lỗi, Lịch sử, Cột. */}
        <div className="relative w-full sm:w-84">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Tìm trong trang này"
            className="h-8 ps-8 pe-8" aria-label="Tìm trong trang này" />
          {search ? (
            <button type="button" aria-label="Xoá tìm kiếm" onClick={() => onSearch("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {filters}
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          {editable ? (
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus />
              Thêm dòng
            </Button>
          ) : null}
          {toolbar}
          {editable && selectedRows.length ? (
            <>
              <span className="text-muted-foreground text-xs tabular-nums">Đã chọn {selectedRows.length} dòng</span>
              <Button type="button" size="sm" variant="outline" onClick={() => skip(true)}>Bỏ các dòng này</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => skip(false)}>Dùng lại</Button>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="relative px-2"
                title={hidden.length ? `Ẩn / hiện cột · đang ẩn ${hidden.length}` : "Ẩn / hiện cột"} aria-label="Ẩn / hiện cột">
                <Columns3 />
                {hidden.length ? (
                  <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 rounded-full px-1 text-[0.625rem] leading-4 tabular-nums">
                    {hidden.length}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 w-64 overflow-y-auto">
              <DropdownMenuLabel>Cột hiển thị</DropdownMenuLabel>
              {allColumns.filter((c) => c.id !== "_row").map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={!hidden.includes(c.id)}
                  onCheckedChange={(v) => toggleColumn(c.id, v === true)} onSelect={(e) => e.preventDefault()}>
                  {c.title}
                </DropdownMenuCheckboxItem>
              ))}
              {hidden.length ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { setHidden([]); writeHidden(sheet.key, []); }}>Hiện tất cả</DropdownMenuItem>
                </>
              ) : null}
              {Object.keys(widths).length ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { setWidths({}); writeWidths(sheet.key, {}); }}>Đặt lại độ rộng cột</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {rows.length === 0 ? (
        // Giữ đúng chiều cao của vùng bảng: khung không co lại khi tìm không ra, các tab trang tính đứng yên chỗ cũ.
        <div ref={fill.ref} style={{ height: fill.height ?? "70vh" }}
          className="text-muted-foreground flex items-center justify-center text-sm">
          {search ? "Không có dòng nào khớp." : "Không có dòng nào."}
        </div>
      ) : (
        <ContextMenu modal={false} onOpenChange={(open) => { if (open) setTip(null); }}>
        <ContextMenuTrigger asChild disabled={!editable}>
        <div ref={fill.ref} className="import-grid relative" onMouseLeave={() => setTip(null)}
          // Bấm chuột phải ngoài ô (tiêu đề, vùng trống) thì menu chỉ còn "Thêm dòng".
          onContextMenuCapture={() => setMenuRows([])}>
          <DataEditor
            ref={gridRef}
            onCellContextMenu={editable ? onCellContextMenu : undefined}
            columns={gridColumns}
            rows={rows.length}
            getCellContent={getCellContent}
            provideEditor={editable ? provideEditor : undefined}
            onCellsEdited={editable ? onCellsEdited : undefined}
            getCellsForSelection
            onPaste={editable}
            fillHandle={editable}
            rangeSelect="multi-rect"
            rowSelect="multi"
            columnSelect="none"
            onHeaderClicked={(col) => { const c = columns[col]; if (c) onSort(c.id); }}
            drawCell={drawCell}
            drawHeader={drawHeader}
            onCellClicked={([col, row]) => {
              const id = columns[col]?.id === "_catalog" ? rows[row]?.resolved.catalogId : null;
              if (id) window.open(`/equipment-catalogs/show/${id}`, "_blank", "noopener");
            }}
            rowMarkers={editable ? "checkbox" : "none"}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            getRowThemeOverride={(i) => (rows[i]?.skipped ? { textDark: theme.textLight } : undefined)}
            freezeColumns={1}
            rowHeight={32}
            headerHeight={36}
            smoothScrollX
            smoothScrollY
            width="100%"
            height={fill.height ?? "70vh"}
            onVisibleRegionChanged={(r) => setVisible((v) => (v.first === r.y && v.count === r.height ? v : { first: r.y, count: r.height }))}
            theme={theme.grid}
            onItemHovered={onItemHovered}
            onColumnResize={(col, size) => setWidths((w) => { const next = { ...w, [String(col.id)]: size }; writeWidths(sheet.key, next); return next; })}
          />
        </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={addRow}>
            <Plus />
            Thêm dòng mới
          </ContextMenuItem>
          {menuTargets.length ? (
            <>
              <ContextMenuSeparator />
              {menuTargets.some((r) => !r.skipped) ? (
                <ContextMenuItem onSelect={() => { onEdit(menuTargets.filter((r) => !r.skipped).map((r) => ({ rowId: r.id, skipped: true }))); setSelection(EMPTY_SELECTION); }}>
                  <EyeOff />
                  Bỏ {menuTargets.length > 1 ? `${menuTargets.length} dòng` : "dòng này"} (không ghi)
                </ContextMenuItem>
              ) : null}
              {menuTargets.some((r) => r.skipped) ? (
                <ContextMenuItem onSelect={() => { onEdit(menuTargets.filter((r) => r.skipped).map((r) => ({ rowId: r.id, skipped: false }))); setSelection(EMPTY_SELECTION); }}>
                  <Eye />
                  Dùng lại {menuTargets.length > 1 ? `${menuTargets.length} dòng` : "dòng này"}
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem variant="destructive" onSelect={() => { onDeleteRows(menuTargets.map((r) => r.id)); setSelection(EMPTY_SELECTION); }}>
                <Trash2 />
                Xoá {menuTargets.length > 1 ? `${menuTargets.length} dòng` : "dòng này"}
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
        </ContextMenu>
      )}
      {tip ? (
        <div role="tooltip" style={{ left: tip.x, top: tip.y }}
          className="bg-popover text-popover-foreground pointer-events-none fixed z-50 max-w-sm rounded-md border px-3 py-2 text-xs shadow-e3">
          <ul className="space-y-1">
            {tip.lines.map((l, i) => (
              <li key={i} className={l.level === "error" ? "text-destructive-text" : l.level === "warning" ? "text-warning-text" : undefined}>
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Col = { id: string; title: string; width: number; key?: string; hint?: string; required?: boolean };
type Tip = { x: number; y: number; lines: { level: ImportMessage["level"] | "hint"; text: string }[] };

const EMPTY_SELECTION: GridSelection = { columns: CompactSelection.empty(), rows: CompactSelection.empty() };

function plainText(text: string, themeOverride?: Partial<Theme>): GridCell {
  return { kind: GridCellKind.Text, data: text, displayData: text, allowOverlay: true, readonly: true, themeOverride };
}

/** Rộng vừa tiêu đề và chữ dài nhất (lấy 90% dòng — vài ô dài bất thường không kéo cả cột ra). */
function messageText(r: ImportRow) {
  return [...r.messages].sort((a, b) => Number(b.level === "error") - Number(a.level === "error"))
    .map((m) => `${m.level === "error" ? "Lỗi" : "Lưu ý"}: ${m.text}`).join(" · ");
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Bề rộng chữ thật theo phông của lưới (13px thân, 700 12px tiêu đề); không đo được thì ước theo số ký tự. */
function textWidth(text: string, header = false) {
  if (measureCtx === undefined) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * (header ? 8 : 7.2);
  measureCtx.font = `${header ? "700 12px" : "13px"} ${getComputedStyle(document.body).fontFamily}`;
  return measureCtx.measureText(text).width;
}

/**
 * Cột vừa chữ: đủ cho tiêu đề (chừa dấu * và mũi tên sắp) và cho phần lớn giá trị (`share` — mặc định 90%: vài ô
 * dài bất thường không kéo cả cột ra), kẹp trong [min, max]. Ô dài hơn vẫn cắt "…", kéo mép cột để xem hết.
 */
function fitWidth(label: string, values: string[], max: number, share = 0.9, min = 72) {
  const ws = values.filter(Boolean).map((v) => textWidth(v)).sort((a, b) => a - b);
  const typical = ws.length ? ws[Math.min(ws.length - 1, Math.floor(ws.length * share))] : 0;
  return Math.round(Math.max(min, Math.min(max, Math.max(textWidth(label, true) + 44, typical + 28))));
}

const HIDDEN_KEY = (sheet: string) => `data-imports.hidden-columns.${sheet}`;

function readHidden(sheet: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY(sheet)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeHidden(sheet: string, ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY(sheet), JSON.stringify(ids));
  } catch {
    // Không lưu được (trình duyệt chặn) thì chỉ mất phần nhớ — cột vẫn ẩn / hiện trong phiên này.
  }
}

function levelOf(messages: ImportMessage[], key: string) {
  if (messages.some((m) => m.field === key && m.level === "error")) return "error" as const;
  if (messages.some((m) => m.field === key)) return "warning" as const;
  return undefined;
}

/** Mã · tên thiết bị đã ghép; chưa ghép được thì nói cách hệ thống xử lý (vd. thiết bị ngoài danh mục). */
function catalogText(r: ImportRow) {
  if (r.resolved.catalogCode) return `${r.resolved.catalogCode} · ${r.resolved.catalogName ?? ""}`;
  return r.resolved.match ? CATALOG_MATCH[String(r.resolved.match)] ?? String(r.resolved.match) : "";
}

// Ô sửa của Glide mở trong `#portal` — phải có, và nằm trên mọi thứ.
if (typeof document !== "undefined" && !document.getElementById("portal")) {
  const portal = document.createElement("div");
  portal.id = "portal";
  portal.style.cssText = "position: fixed; left: 0; top: 0; z-index: 60;";
  document.body.appendChild(portal);
}

/**
 * Lưới vẽ bằng canvas nên không đọc được biến CSS: đổi các token của theme (oklch) ra mã màu hex một lần
 * mỗi khi đổi sáng / tối hay bộ màu.
 */
function useGridTheme() {
  const { resolvedMode, colorPreset } = useTheme();
  const [version, setVersion] = useState(0);
  // Thuộc tính của <html> đổi trong effect của ThemeProvider — đọc lại ở khung hình sau.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVersion((v) => v + 1));
    return () => cancelAnimationFrame(id);
  }, [resolvedMode, colorPreset]);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);

  return useMemo(() => {
    void version;
    ctx.current ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const css = getComputedStyle(document.documentElement);
    const bg = toHex(ctx.current, css.getPropertyValue("--card").trim(), "#ffffff",
      resolvedMode === "dark" ? "#000000" : "#ffffff");
    // Token có độ trong suốt (đường kẻ ở nền tối) được trộn lên nền thẻ — đúng màu mắt thấy.
    const token = (name: string, fallback: string) => toHex(ctx.current, css.getPropertyValue(name).trim(), fallback, bg);
    const t = {
      bg,
      subtle: token("--surface-subtle", "#f6f7f9"),
      text: token("--foreground", "#111827"),
      muted: token("--muted-foreground", "#6b7280"),
      border: token("--border", "#e5e7eb"),
      primary: token("--primary", "#2563eb"),
      primaryFg: token("--primary-foreground", "#ffffff"),
    };
    const errorText = token("--destructive-text", "#b91c1c");
    const warningText = token("--warning-text", "#b45309");
    const grid: Partial<Theme> = {
      accentColor: t.primary,
      accentFg: t.primaryFg,
      accentLight: t.primary + "22",
      textDark: t.text,
      textMedium: t.muted,
      textLight: t.muted,
      // Tiêu đề cột nổi như đầu bảng của app: nền xanh nhạt, chữ xanh đậm.
      textHeader: token("--table-head-text", "#1d4ed8"),
      textHeaderSelected: t.primaryFg,
      bgCell: t.bg,
      bgCellMedium: t.subtle,
      bgHeader: token("--table-head", "#e8f0fe"),
      bgHeaderHasFocus: t.border,
      bgHeaderHovered: t.border,
      bgSearchResult: token("--warning-subtle", "#fef3c7"),
      borderColor: t.border,
      horizontalBorderColor: t.border,
      headerBottomBorderColor: t.border,
      bgIconHeader: t.muted,
      fgIconHeader: t.bg,
      fontFamily: getComputedStyle(document.body).fontFamily,
      baseFontStyle: "13px",
      headerFontStyle: "700 12px",
      editorFontSize: "13px",
    };
    // Ô "Kết quả" và "Lỗi / lưu ý" tô nền theo trạng thái, như tô màu ô trong Excel.
    const cell = (bg: string, text: string): Partial<Theme> => ({ bgCell: bg, textDark: text });
    const statusCell: Record<ImportRowStatus, Partial<Theme>> = {
      OK: cell(token("--success-subtle", "#ecfdf5"), token("--success-text", "#047857")),
      WARNING: cell(token("--warning-subtle", "#fffbeb"), warningText),
      ERROR: cell(token("--destructive-subtle", "#fef2f2"), errorText),
      EXISTS: cell(token("--info-subtle", "#f0f9ff"), token("--info-text", "#0369a1")),
      SKIPPED: cell(t.subtle, t.muted),
    };
    return {
      grid,
      statusCell,
      // Ô đã sửa = xanh chủ đạo của hệ thống (nền pha nhạt từ --primary).
      editAi: { bgCell: mixHex(t.primary, bg, 0.14), textDark: t.primary, baseFontStyle: "700 13px" },
      errorText,
      warningText,
      errorBg: token("--destructive-subtle", "#fef2f2"),
      warningBg: token("--warning-subtle", "#fffbeb"),
      bgCellMedium: t.subtle,
      textLight: t.muted,
      link: token("--info-text", "#0369a1"),
    };
  }, [version, resolvedMode]);
}

/** Pha màu `a` lên nền `b` với tỉ lệ `t` (0–1) — nền nhạt cho ô từ màu chủ đạo, vẽ được trên canvas. */
function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("");
}

function toHex(ctx: CanvasRenderingContext2D | null, value: string, fallback: string, base: string) {
  if (!ctx || !value) return fallback;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = fallback;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** Độ rộng cột người dùng kéo — nhớ theo từng trang tính, F5 vẫn giữ. */
const WIDTHS_KEY = (sheet: string) => `data-imports.column-widths.${sheet}`;

function readWidths(sheet: string): Record<string, number> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(WIDTHS_KEY(sheet)) ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0));
  } catch {
    return {};
  }
}

function writeWidths(sheet: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(WIDTHS_KEY(sheet), JSON.stringify(widths));
  } catch {
    // Không lưu được thì độ rộng chỉ giữ trong phiên này.
  }
}

