import { ArrowDown, ArrowUp, ChevronsUpDown, School, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { ChoiceList, FilterButton, FilterField } from "@/shared/components/data-table/filter-popover";
import { IconFilter, fold } from "@/shared/components/data-table/icon-filter";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DetailColumn = { key: string; label: string; numeric?: boolean };

/**
 * Một nút lọc tròn cạnh ô tìm. Mặc định lọc theo chữ của cột `key`; `values` cho phép lọc theo thứ không thành cột
 * (loại thiết bị) hoặc dòng mang nhiều giá trị (khối "6,7" khớp cả lớp 6 lẫn lớp 7).
 */
export type DetailFilter<T> = {
  key: string;
  /** Tên điều kiện, viết thường — "môn", "khối lớp". */
  label: string;
  icon?: LucideIcon;
  /** Các giá trị (khoá) của một dòng; vắng thì là chữ của cột `key`. */
  values?: (row: T) => string[];
  /** Thứ tự và nhãn cố định của các lựa chọn (tình trạng, khối); vắng thì lấy từ dữ liệu, nhiều dòng lên đầu. */
  options?: readonly { key: string; label: string }[];
  /** Giá trị chọn sẵn lúc mở. */
  initial?: string | null;
};

const PAGE_SIZE = 20;
/** Chiều cao cố định (rem) của dòng tiêu đề và dòng dữ liệu. */
const HEAD_REM = 2.5;
const ROW_REM = 3;
/** Đệm hai bên ô, chỗ cho mũi tên sắp ở tiêu đề, cột rộng nhất (rem) — chữ dài hơn thì cắt, rê chuột thấy đủ. */
const CELL_PAD_REM = 1.75;
const SORT_ICON_REM = 1.25;
const MAX_COL_REM = 22;

/** Đo chữ bằng đúng font của trang — ước lượng theo số ký tự thì cột thừa hoặc thiếu, chữ bị cắt oan. */
function textMeasurer() {
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const family = getComputedStyle(document.body).fontFamily;
  const ctx = document.createElement("canvas").getContext("2d");
  return {
    root,
    width: (value: string, rem: number, weight = 400) => {
      if (!ctx) return value.length * rem * root * 0.55;
      ctx.font = `${weight} ${rem * root}px ${family}`;
      return ctx.measureText(value).width;
    },
  };
}

/**
 * Bảng xem chi tiết trên dữ liệu đã có sẵn trong trình duyệt: phân trang, sắp theo cột, tìm không dấu. Đặt trong
 * `DialogContent size="wide"`: bảng lấp đầy hộp, ít dòng thì còn chỗ trống, phân trang luôn ở đáy.
 *
 * Cạnh ô tìm có ô lọc theo một cột (`filterKey`, thường là Trường) và các ô lọc khác (`filters`); bấm tiêu đề cột để sắp.
 *
 * Tự chọn cột cho gọn:
 * - chỉ bỏ cột trống hết, hoặc cột mọi dòng đều mang đúng giá trị của `context` (tiêu đề hộp đã nói); còn lại luôn hiện
 *   thành cột, kể cả cột mọi dòng giống nhau — đọc danh sách là thấy đủ;
 * - cột rộng theo nội dung thật (không chia đều), chữ quá dài cắt bớt và hiện đủ khi rê chuột.
 */
export function DetailTable<T extends Record<string, any>>({ columns, rows, text, cell, onRowClick, rowTitle, context, filterKey, filters, initialSearch, onView, searchPlaceholder = "Tìm trong danh sách…", compact, toolbarEnd }: {
  columns: DetailColumn[];
  rows: T[];
  /** Chữ của một ô — dùng để tìm, đo độ rộng cột và so giá trị trùng. */
  text: (row: T, column: DetailColumn) => string;
  /** Vẽ riêng một ô (vd. liên kết); vắng thì in `text`. */
  cell?: (row: T, column: DetailColumn) => ReactNode;
  /** Bấm dòng; trả `false` ở `clickable` thì dòng đó không bấm được. */
  onRowClick?: { clickable: (row: T) => boolean; open: (row: T, newTab: boolean) => void };
  rowTitle?: (row: T) => string | undefined;
  /** Các giá trị người đọc đã biết từ tiêu đề hộp — cột chỉ mang giá trị này thì bỏ hẳn. */
  context?: string[];
  /** Cột có ô lọc cạnh ô tìm — thường là cột Trường. */
  filterKey?: string;
  /** Các nút lọc khác, đứng sau nút của `filterKey`. Nên giữ cùng một mảng giữa các lần vẽ (`useMemo`). */
  filters?: DetailFilter<T>[];
  /** Từ khoá có sẵn lúc mở. */
  initialSearch?: string;
  /** Báo các dòng đang hiện (đã lọc, tìm, sắp) và giá trị của từng nút lọc mỗi khi chúng đổi — để in đúng thứ đang xem. */
  onView?: (rows: T[], picked: Record<string, string | null>) => void;
  searchPlaceholder?: string;
  /** Bảng nằm nửa hộp thoại: phân trang gọn (không ô số dòng mỗi trang), ô tìm kín bề ngang. */
  compact?: boolean;
  /** Nội dung đẩy về bên phải hàng ô tìm (vd. dòng số tổng) — cùng hàng với ô tìm, hẹp thì xuống dòng. */
  toolbarEnd?: ReactNode;
}) {
  const [q, setQ] = useState(initialSearch ?? "");
  const [picked, setPicked] = useState<Record<string, string | null>>(
    () => Object.fromEntries((filters ?? []).filter((f) => f.initial).map((f) => [f.key, f.initial!])),
  );
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Tính trên TOÀN BỘ dòng, không theo tìm kiếm: gõ tìm không được làm cột biến mất.
  const shown = useMemo(() => {
    if (rows.length < 2) return columns;
    const kept = columns.filter((c) => {
      const values = new Set(rows.map((r) => text(r, c)));
      if (values.size > 1) return true;
      const value = [...values][0];
      return !!value && !context?.includes(value);
    });
    return kept.length ? kept : columns;
  }, [columns, rows, text, context]);

  // Độ rộng theo chữ dài nhất của cột (tính trên mọi dòng để đổi trang cột không xê dịch). Bảng rộng hơn thì chia phần dư theo
  // tỷ lệ; hẹp hơn thì cuộn ngang.
  const widths = useMemo(() => {
    const m = textMeasurer();
    return shown.map((c) => {
      const body = [...new Set(rows.map((r) => text(r, c)))].reduce((max, v) => Math.max(max, m.width(v, 0.875)), 0);
      const head = m.width(c.label.toUpperCase(), 0.75, 600) * 1.1 + SORT_ICON_REM * m.root;
      return Math.min(Math.max(body, head) + CELL_PAD_REM * m.root, MAX_COL_REM * m.root);
    });
  }, [shown, rows, text]);
  const totalPx = widths.reduce((sum, w) => sum + w, 0);

  // Mọi nút lọc: nút theo cột `filterKey` (biểu tượng trường) rồi các nút của `filters`.
  const defs = useMemo(() => {
    const column = filterKey ? columns.find((c) => c.key === filterKey) : undefined;
    const all: (DetailFilter<T> & { own?: boolean })[] = column ? [{ key: column.key, label: column.label.toLowerCase(), icon: School, own: true }] : [];
    return all.concat(filters ?? []).map((f) => {
      const col = columns.find((c) => c.key === f.key);
      const values = f.values ?? ((r: T) => {
        const v = col ? text(r, col) : "";
        return v ? [v] : [];
      });
      return { ...f, values };
    });
  }, [filterKey, filters, columns, text]);

  // Lựa chọn của mỗi nút kèm số dòng: theo `options` nếu có, không thì nhiều dòng lên đầu. Mục không dòng nào thì bỏ.
  const filterOptions = useMemo(() => defs.map((f) => {
    const counts = new Map<string, number>();
    for (const r of rows) for (const v of new Set(f.values(r))) counts.set(v, (counts.get(v) ?? 0) + 1);
    const items = f.options
      ? f.options.filter((o) => counts.has(o.key)).map((o) => ({ key: o.key, label: o.label, count: counts.get(o.key)! }))
      : [...counts.entries()].map(([key, count]) => ({ key, label: key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "vi"));
    return { def: f, items };
  }), [defs, rows]);

  const filtered = useMemo(() => {
    const needle = fold(q.trim());
    const active = defs.filter((f) => picked[f.key]);
    return rows.filter((r) => active.every((f) => f.values(r).includes(picked[f.key]!))
      && (!needle || shown.some((c) => fold(text(r, c)).includes(needle))));
  }, [rows, shown, text, q, picked, defs]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = shown.find((c) => c.key === sort.key);
    if (!column) return filtered;
    const value = (r: T) => (column.numeric ? Number(r[column.key]) || 0 : text(r, column));
    const out = [...filtered].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true });
    });
    return sort.desc ? out.reverse() : out;
  }, [filtered, sort, shown, text]);

  // Hàm báo giữ trong ref: hàm mới mỗi lần vẽ của nơi gọi không được làm báo lại (báo lại → nơi gọi setState → vòng lặp).
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  useEffect(() => onViewRef.current?.(sorted, picked), [sorted, picked]);

  const choose = (key: string, v: string | null) => {
    setPicked((p) => ({ ...p, [key]: v }));
    setPage(1);
  };
  // Ô trong hộp "Bộ lọc": chỉ một giá trị thì không có gì để lọc (trừ khi đang chọn sẵn — vẫn bỏ chọn được).
  const extra = filterOptions.filter(({ def, items }) => !def.own && (items.length > 1 || picked[def.key]));

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);
  // Bấm lần 1 tăng dần, lần 2 giảm dần, lần 3 về thứ tự gốc.
  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) => (s?.key !== key ? { key, desc: false } : s.desc ? null : { key, desc: true }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className={cn("relative w-full", !compact && "sm:w-72")}>
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={q} placeholder={searchPlaceholder} aria-label="Tìm trong danh sách" className="rounded-full pr-9 pl-9"
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }} />
              {q ? (
                <button type="button" aria-label="Xoá" onClick={() => setQ("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2">
                  <X className="size-4" />
                </button>
              ) : null}
          </div>
          {/* Nút lọc theo cột `filterKey` (thường là Trường) ngay cạnh ô tìm; chỉ một giá trị thì không có gì để lọc. */}
          {filterOptions.filter(({ def }) => def.own).map(({ def, items }) => (items.length > 1 || picked[def.key] ? (
            <IconFilter key={def.key} icon={<School />} label={def.label} allLabel={`Mọi ${def.label}`}
              alwaysSearch total={rows.length} value={picked[def.key] ?? null}
              groups={[{ items }]}
              onChange={(v) => choose(def.key, v)} />
          ) : null))}
          {/* Các điều kiện của `filters` gom trong MỘT nút "Bộ lọc", mỗi điều kiện một ô trong hộp bật ra. */}
          {extra.length ? (
            <FilterButton modal count={extra.filter(({ def }) => picked[def.key]).length}
              contentClassName={extra.length > 1 ? "w-[36rem]" : undefined}
              onClear={() => {
                setPicked((p) => ({ ...p, ...Object.fromEntries(extra.map(({ def }) => [def.key, null])) }));
                setPage(1);
              }}>
              <div className={cn("grid items-start gap-x-6 gap-y-4", extra.length > 1 && "grid-cols-2")}>
                {extra.map(({ def, items }) => (
                  <FilterField key={def.key} label={def.label.charAt(0).toUpperCase() + def.label.slice(1)} icon={def.icon} active={!!picked[def.key]}>
                    {/* Ô nửa hộp chỉ đủ chỗ hai cột cho nhãn rất ngắn ("Lớp 6 (587)"); dài hơn thì một cột, khỏi bị cắt. */}
                    <ChoiceList value={picked[def.key] ?? null} onChange={(v) => choose(def.key, v)}
                      columns={extra.length > 1 && items.some((o) => `${o.label} (${o.count})`.length > 12) ? 1 : undefined}
                      options={items.map((o) => ({ value: o.key, label: `${o.label} (${o.count})` }))} />
                  </FilterField>
                ))}
              </div>
            </FilterButton>
          ) : null}
          {toolbarEnd ? <div className="ms-auto">{toolbarEnd}</div> : null}
      </div>

      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto [&_tbody_tr:last-child]:border-b">
          <Table className="table-fixed" style={{ minWidth: `${Math.ceil(totalPx)}px` }}>
            <colgroup>
              {shown.map((c, i) => <col key={c.key} style={{ width: `${(widths[i] / totalPx) * 100}%` }} />)}
            </colgroup>
            <TableHeader className="bg-surface-subtle sticky top-0 z-10">
              <TableRow>
                {shown.map((c) => {
                  const on = sort?.key === c.key;
                  const Icon = !on ? ChevronsUpDown : sort.desc ? ArrowDown : ArrowUp;
                  return (
                    <TableHead key={c.key} aria-sort={!on ? "none" : sort.desc ? "descending" : "ascending"} className="p-0">
                      <button type="button" onClick={() => toggleSort(c.key)} title={c.label}
                        style={{ height: `${HEAD_REM}rem` }}
                        className={cn("hover:text-foreground flex w-full items-center gap-1 px-3 font-[inherit] tracking-[inherit] uppercase",
                          c.numeric && "justify-end")}>
                        <span className="truncate">{c.label}</span>
                        <Icon className={cn("size-3.5 shrink-0", on ? "text-primary" : "opacity-40")} />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={shown.length} className="text-muted-foreground h-32 text-center">Không có dòng nào khớp.</TableCell>
                </TableRow>
              ) : visible.map((r, i) => {
                const clickable = onRowClick?.clickable(r) ?? false;
                return (
                  <TableRow key={i} title={rowTitle?.(r)} className={cn("group/row", LIFT_ROW, clickable && "cursor-pointer")}
                    onClick={clickable ? (ev) => onRowClick?.open(r, ev.ctrlKey || ev.metaKey) : undefined}>
                    {shown.map((c) => {
                      const value = text(r, c);
                      return (
                        <TableCell key={c.key} title={value || undefined} style={{ height: `${ROW_REM}rem` }}
                          className={cn("truncate py-0", c.numeric && "text-right tabular-nums", c.numeric && Number(r[c.key]) === 0 && "text-muted-foreground/60")}>
                          {cell ? cell(r, c) : value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="shrink-0 border-t px-3 py-1.5">
          <DataTablePagination compact={compact} currentPage={current} pageCount={pageCount} setCurrentPage={setPage} total={sorted.length}
            pageSize={pageSize} setPageSize={(s) => {
              setPageSize(s);
              setPage(1);
            }} />
        </div>
      </div>
    </div>
  );
}
