"use client";

import type { HttpError, BaseRecord } from "@refinedev/core";
import { useNavigation, useResourceParams, useTranslate } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Column, RowData } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import {
  Inbox,
  Loader2,
  SearchX,
  ShieldOff,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { Skeleton } from "@/shared/ui/skeleton";
import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { isScopedResource } from "@/shared/api/session";
import { readColumnPrefs, useColumnsKey } from "@/shared/components/data-table/column-prefs";

/**
 * `defaultColumn` for a table that opts into column resizing.
 *
 * TanStack treats resizing as opt-out — `getCanResize()` is
 * `(columnDef.enableResizing ?? true) && (options.enableColumnResizing ?? true)`
 * — so turning the table option on hands a drag handle to every column,
 * including the ones where dragging achieves nothing. This flips the column
 * half of that expression, which makes resizing opt-in: a column becomes
 * draggable by declaring `enableResizing: true`, and only that column does.
 *
 * Pair it with `enableColumnResizing: true` on the table. Without the table
 * option the per-column flag is ANDed away and nothing resizes.
 *
 *     const table = useTable({
 *       columns,
 *       enableColumnResizing: true,
 *       columnResizeMode: "onChange",
 *       defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
 *     });
 */
export const RESIZABLE_COLUMN_DEFAULTS = {
  enableResizing: false,
  minSize: 80,
  maxSize: 900,
};

/**
 * Width for an action column holding `buttons` icon-only `icon-sm` buttons in a
 * `gap-1` row — the minimum that fits them, and nothing more.
 *
 * The arithmetic, so the number is checkable rather than guessed. Every spacing
 * utility here compiles to `calc(var(--spacing) * n)`, so all three terms scale
 * with the density setting:
 *
 *     TableCell `px-3` ->  3 units each side  ->  6 units
 *     `icon-sm`        ->  `size-8`           ->  8 units per button
 *     `gap-1`          ->  1 unit             ->  1 unit per gap
 *
 *     width = unit * (6 + 8n + (n - 1)) = unit * (9n + 5)
 *
 * A column's `size` is a plain number, so it cannot scale with density — and it
 * is the *exact* rendered width whenever the table overflows its card, which is
 * precisely when a column too narrow for its buttons would clip them. So the
 * unit used here is the largest of the three (`spacious`, `0.2875rem` = 4.6px):
 * a width that is safe at every density. Anything smaller clips Delete for
 * anyone who has not left the density on its default.
 *
 * `minSize` comes along because `RESIZABLE_COLUMN_DEFAULTS` floors columns at
 * 80px and `getSize()` clamps to it — without this, a one-button column asks
 * for 56 and silently renders at 80.
 */
export function actionsColumnWidth(buttons: number) {
  const SPACIOUS_UNIT = 4.6;
  // The `+ 1` is not padding for taste — it absorbs subpixel accumulation:
  // each flex item is laid out at a fraction of a pixel and the row rounds up
  // once. Being a pixel generous costs nothing; being a pixel short clips the
  // last button.
  const width = Math.ceil(SPACIOUS_UNIT * (9 * buttons + 5)) + 1;

  return { size: width, minSize: width };
}

type DataTableProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
  /**
   * The filter zone, rendered inside the panel above the header row —
   * `ListToolbar` and the active-filter chips.
   *
   * It is a prop rather than a sibling the page renders above `<DataTable>`
   * because the panel is drawn in here, and a toolbar outside it is a floating
   * control that belongs to nothing: the search narrows *this* table, so it
   * lives on the same sheet as the rows it narrows. One block, three zones
   * divided by hairlines — filters, rows, pager.
   */
  toolbar?: ReactNode;
  /**
   * Bảng đang bị thu hẹp bởi bộ lọc KHÔNG nằm trong `refineCore.filters` — lọc cố định do
   * trang tự thêm (cây lọc bên trái, "Đang xem: …"). Không báo thì một nhánh cây rỗng hiện
   * "không có dữ liệu trong phạm vi của bạn", như thể bị chặn quyền.
   */
  externallyFiltered?: boolean;
  /**
   * Lấp đầy chiều cao của khối cha: thân bảng cuộn BÊN TRONG (tiêu đề cột dính trên,
   * phân trang dính dưới), nên đổi 10 → 20 dòng mỗi trang không làm trang dài ra. Cha
   * phải có chiều cao xác định (xem `useFillHeight`).
   */
  fill?: boolean;
  /**
   * Câu của lúc bảng TRỐNG (không lọc, không bị thu hẹp phạm vi) khi câu chung "Chưa có dữ liệu" không nói
   * được gì — màn Thông báo: "Chưa có thông báo nào".
   */
  empty?: { title: string; description?: string };
  /**
   * Bấm đúp một dòng. Mặc định: mở trang chi tiết (`show`) của resource nếu có.
   * Màn nào xem chi tiết bằng hộp thoại thì truyền handler riêng.
   */
  onRowDoubleClick?: (record: TData) => void;
  /**
   * Vẽ phần THÂN bằng thứ khác thay cho bảng — dạng khối chẳng hạn.
   *
   * <p>Chỉ thân đổi; bộ lọc, khung thẻ, khung xương lúc tải và thanh phân
   * trang vẫn là của `DataTable`. Đó là lý do nó là một prop ở đây chứ không
   * phải một màn tự dựng lấy: tự dựng nghĩa là chép lại thanh phân trang, và
   * hai thanh phân trang sẽ lệch nhau ngay lần sửa đầu tiên.
   *
   * <p>Nhận sẵn các dòng của TRANG HIỆN TẠI, đã qua lọc và sắp xếp — cùng dữ
   * liệu mà bảng đang vẽ, nên đổi cách nhìn không đổi thứ được nhìn.
   */
  renderBody?: (rows: TData[]) => ReactNode;
  /**
   * Class thêm cho từng dòng theo bản ghi — làm nổi một loại dòng (phiếu nháp) hoặc làm mờ một loại khác
   * (phiếu đã huỷ). Màu lấy từ token, không tự đặt màu.
   */
  rowClassName?: (record: TData) => string | undefined;
};

export function DataTable<TData extends BaseRecord>({
  table,
  toolbar,
  onRowDoubleClick,
  renderBody,
  rowClassName,
  externallyFiltered,
  fill,
  empty,
}: DataTableProps<TData>) {
  const { resource: currentResource, identifier: currentIdentifier } = useResourceParams();
  const { show } = useNavigation();
  const openRecord = (record: TData) => {
    if (onRowDoubleClick) {
      onRowDoubleClick(record);
    } else if (currentResource?.show && record?.id != null) {
      show(currentIdentifier ?? currentResource.name, record.id);
    }
  };
  const {
    reactTable: { getHeaderGroups, getRowModel, getTotalSize },
    refineCore: {
      tableQuery,
      currentPage,
      setCurrentPage,
      pageCount,
      pageSize,
      setPageSize,
    },
  } = table;
  const t = useTranslate();

  // Visible, not all: a column hidden from the Columns menu must drop out of
  // the loading skeleton and out of the empty row's `colSpan` too, or the
  // skeleton renders more cells than the header has and the "no data" cell
  // spans past the last column.
  const leafColumns = table.reactTable.getVisibleLeafColumns();

  // Cột người dùng đã tắt / bật ở menu "Cột hiển thị" (xem `column-prefs.ts`): áp lại khi bảng mở, nên tải lại
  // trang vẫn giữ lựa chọn trước đó.
  const columnsKey = useColumnsKey(table);
  const restored = useRef<string | null>(null);
  const setColumnVisibility = table.reactTable.setColumnVisibility;
  useEffect(() => {
    if (restored.current === columnsKey) return;
    restored.current = columnsKey;
    const prefs = readColumnPrefs(columnsKey);
    if (Object.keys(prefs).length) setColumnVisibility((prev) => ({ ...prev, ...prefs }));
  }, [columnsKey, setColumnVisibility]);
  const isLoading = tableQuery.isLoading;

  // Opt-in per table: `column.getCanResize()` defaults to true in TanStack, so
  // gating on the table option is what keeps tables that never asked for
  // resizing free of drag handles.
  const canResizeColumns = table.reactTable.options.enableColumnResizing === true;
  const columnSizing = table.reactTable.getState().columnSizing;
  const isResizing = Boolean(
    table.reactTable.getState().columnSizingInfo.isResizingColumn
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isOverflowing, setIsOverflowing] = useState({
    horizontal: false,
    vertical: false,
  });

  useEffect(() => {
    const checkOverflow = () => {
      if (tableRef.current && tableContainerRef.current) {
        const table = tableRef.current;
        const container = tableContainerRef.current;

        const horizontalOverflow = table.offsetWidth > container.clientWidth;
        const verticalOverflow = table.offsetHeight > container.clientHeight;

        setIsOverflowing({
          horizontal: horizontalOverflow,
          vertical: verticalOverflow,
        });
      }
    };

    checkOverflow();

    // Check on window resize
    window.addEventListener("resize", checkOverflow);

    // Check when table data changes
    const timeoutId = setTimeout(checkOverflow, 100);

    return () => {
      window.removeEventListener("resize", checkOverflow);
      clearTimeout(timeoutId);
    };
    // `columnSizing` is in here so a drag that pushes the table past the
    // container re-runs the check — the pinned-column shadows read it.
  }, [tableQuery.data?.data, pageSize, columnSizing]);

  return (
    <div className={cn("flex", "flex-col", "flex-1", "gap-4", fill && "min-h-0")}>
      <div
        ref={tableContainerRef}
        className={cn(
          fill && "flex min-h-0 flex-1 flex-col",
          "overflow-hidden",
          "rounded-lg",
          "border",
          "border-border",
          "bg-card",
          "shadow-e1"
        )}
      >
        {toolbar && (
          // `px-3` is the table cell's own padding, so the search field starts
          // on the same vertical line as the first column rather than a few
          // pixels off it. `space-y-3` spaces whatever a screen adds under its
          // toolbar (a drill-down chip, a note).
          <div className="space-y-3 border-b border-border px-3 py-3">
            {toolbar}
          </div>
        )}

        {renderBody ? (
          isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            renderBody(getRowModel().rows.map((r) => r.original))
          )
        ) : (
        <div className={fill ? "scrollbar-fade min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible" : "contents"}>
        <Table
          ref={tableRef}
          // `minWidth` keeps the table filling the card while the columns add
          // up to less than the container; past that the sizes drive the width
          // and the wrapper scrolls horizontally.
          style={{
            tableLayout: "fixed",
            width: canResizeColumns ? getTotalSize() : "100%",
            minWidth: "100%",
          }}
          className={cn(isResizing && "select-none")}
        >
          <TableHeader sticky={fill}>
            {getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isPlaceholder = header.isPlaceholder;

                  // Tiêu đề cột KHÔNG sắp xếp được (bỏ theo trưởng nhóm, toàn ứng dụng): danh sách xếp theo thứ
                  // tự mặc định của màn. `enableSorting` trên cột vì thế không còn tác dụng ở giao diện.
                  // `meta.hint`: dấu "?" cạnh tiêu đề cột.
                  const hint = header.column.columnDef.meta?.hint;

                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        ...getCommonStyles({
                          column: header.column,
                          isOverflowing: isOverflowing,
                        }),
                      }}
                      className={getPinnedClasses({ column: header.column })}
                    >
                      <div className="flex max-w-full items-center gap-1">
                      {isPlaceholder ? null : (
                        <div className={cn("flex", "items-center", "gap-1")}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                      )}
                      {hint && !isPlaceholder ? <HelpHint>{hint}</HelpHint> : null}
                      </div>

                      {canResizeColumns && header.column.getCanResize() && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={t("table.resizeColumn", { column: header.column.id }, `Resize column ${header.column.id}`)}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          // The header may itself be clickable (sorting), and
                          // finishing a drag must not count as a click on it.
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={() => header.column.resetSize()}
                          className={cn(
                            "absolute inset-y-0 -right-1 z-20 flex w-2 touch-none",
                            "cursor-col-resize select-none items-center justify-center",
                            // Grab area is 8px wide for the pointer; the line
                            // that appears under it is 2px, so the header still
                            // reads as a header when nothing is happening.
                            "after:h-1/2 after:w-0.5 after:rounded-full",
                            "after:bg-transparent after:transition-colors",
                            "hover:after:bg-primary/60",
                            header.column.getIsResizing() &&
                              "after:bg-primary after:h-full"
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              <>
                {Array.from({ length: pageSize < 1 ? 1 : pageSize }).map(
                  (_, rowIndex) => (
                    <TableRow
                      key={`skeleton-row-${rowIndex}`}
                      aria-hidden="true"
                      className="group/row"
                    >
                      {leafColumns.map((column) => (
                        <TableCell
                          key={`skeleton-cell-${rowIndex}-${column.id}`}
                          style={{
                            ...getCommonStyles({
                              column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                          className={cn(
                            "truncate",
                            getPinnedClasses({ column })
                          )}
                        >
                          <div className="h-8" />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                )}
                <TableRow>
                  <TableCell
                    colSpan={leafColumns.length}
                    className={cn("absolute", "inset-0", "pointer-events-none")}
                  >
                    <Loader2
                      className={cn(
                        "absolute",
                        "top-1/2",
                        "left-1/2",
                        "animate-spin",
                        "text-primary",
                        "h-8",
                        "w-8",
                        "-translate-x-1/2",
                        "-translate-y-1/2"
                      )}
                    />
                  </TableCell>
                </TableRow>
              </>
            ) : getRowModel().rows?.length ? (
              getRowModel().rows.map((row) => {
                return (
                  <TableRow
                    key={row.original?.id ?? row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn("group/row cursor-default", rowClassName?.(row.original))}
                    onDoubleClick={(e) => {
                      // Bấm đúp lên nút / ô nhập trong dòng thì không mở chi tiết.
                      if ((e.target as HTMLElement).closest("button, a, input, [role=checkbox]")) return;
                      openRecord(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonStyles({
                              column: cell.column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                          className={getPinnedClasses({ column: cell.column })}
                        >
                          {/*
                            `truncate` on the wrapper alone only ellipsises
                            text that is a direct child of it. A cell that
                            stacks two lines — a title over a department, a
                            name over a code — puts its text inside a flex
                            column, and those children overflow the wrapper's
                            `overflow: hidden` and get cut mid-word with no
                            ellipsis to say so. Flex items are blockified, so
                            handing them the same treatment is enough.
                          */}
                          <div className="min-w-0 truncate [&>div]:min-w-0 [&>div>span]:truncate">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <DataTableNoData
                isOverflowing={isOverflowing}
                columnsLength={leafColumns.length}
                filtered={externallyFiltered || (table.refineCore.filters?.length ?? 0) > 0}
              empty={empty}
              />
            )}
          </TableBody>
        </Table>
        </div>
        )}

        {/*
          The pager lives inside the panel, on the panel's own footer surface,
          because it is part of the table rather than a control next to one:
          floating it underneath leaves the card ending in a hard edge and the
          page controls belonging to nothing in particular.
        */}
        {!isLoading && getRowModel().rows?.length > 0 && (
          <div
            data-print="hide"
            className={cn("border-t border-border px-3 py-1.5")}
          >
            <DataTablePagination
              currentPage={currentPage}
              pageCount={pageCount}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              total={tableQuery.data?.total}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DataTableNoData({
  isOverflowing,
  columnsLength,
  filtered,
  empty,
}: {
  empty?: { title: string; description?: string };
  isOverflowing: { horizontal: boolean; vertical: boolean };
  columnsLength: number;
  /** Đang có bộ lọc (ô tìm, lọc nâng cao, cây bên trái...). */
  filtered: boolean;
}) {
  // A narrowed account sees exactly what a system with no data looks like, and
  // has no way to tell the two apart. Saying which it is costs one sentence and
  // saves the support ticket that would otherwise be raised.
  const { resource } = useResourceParams();
  // Đang lọc mà rỗng thì lý do là BỘ LỌC, không phải phạm vi dữ liệu — nói phạm vi ở đây
  // là đổ lỗi nhầm chỗ, và người dùng đi hỏi quyền cho một thứ chỉ cần bỏ lọc.
  const scoped = !filtered && isScopedResource(resource?.name);
  const t = useTranslate();

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={columnsLength}
        className={cn("relative", "text-center")}
        style={{ height: "490px" }}
      >
        <div
          className={cn(
            "absolute",
            "inset-0",
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "gap-2",
            "bg-card"
          )}
          style={{
            position: isOverflowing.horizontal ? "sticky" : "absolute",
            left: isOverflowing.horizontal ? "50%" : "50%",
            transform: "translateX(-50%)",
            zIndex: isOverflowing.horizontal ? 2 : 1,
            width: isOverflowing.horizontal ? "fit-content" : "100%",
            minWidth: "300px",
          }}
        >
          {/*
            An empty table with nothing but a sentence in the middle of it
            reads as a page that failed to load. The medallion is what says
            "this rendered, and the answer is none" — and it costs one element.
          */}
          <span
            className={cn(
              "mb-1 flex size-14 items-center justify-center rounded-full",
              "bg-accent text-muted-foreground [&_svg]:size-6"
            )}
          >
            {filtered ? <SearchX /> : scoped ? <ShieldOff /> : <Inbox />}
          </span>
          <div className={cn("text-base", "font-semibold", "text-foreground")}>
            {filtered
              ? t("table.empty.filteredTitle", "Nothing matches the current filters")
              : scoped
                ? t("table.empty.scopedTitle", "Nothing in your data scope")
                : (empty?.title ?? t("table.empty.title", "No records yet"))}
          </div>
          <div className={cn("max-w-sm", "text-sm", "text-muted-foreground")}>
            {filtered
              ? t("table.empty.filteredDescription", "Clear or change the filters to see more rows.")
              : scoped
              ? t("table.empty.scopedDescription", "You can open this resource, but no rows fall within the scope your roles grant.")
              : empty ? empty.description : t("table.empty.description", "This table is empty for the time being.")}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function getCommonStyles<TData>({
  column,
  isOverflowing,
}: {
  column: Column<TData>;
  isOverflowing: {
    horizontal: boolean;
    vertical: boolean;
  };
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    // The shadow is the only part gated on the measurement: it says "there is
    // more table behind this", so it should appear only when there is.
    //
    // Không kẻ đường dọc (bảng không kẻ cột ở đâu cả); chỉ một bóng mờ khi có
    // phần bảng trượt bên dưới cột ghim.
    boxShadow:
      isOverflowing.horizontal && isLastLeftPinnedColumn
        ? "6px 0 8px -6px oklch(0 0 0 / 0.12)"
        : isOverflowing.horizontal && isFirstRightPinnedColumn
        ? "-6px 0 8px -6px oklch(0 0 0 / 0.12)"
        : undefined,
    // The anchoring itself is not gated, and that is deliberate.
    // `isOverflowing` is a manual measurement refreshed by a window `resize`
    // listener, the row data and `columnSizing` — so it goes stale on anything
    // that resizes the *container* without resizing the window, collapsing the
    // sidebar being the obvious one. Gating `position` on it means the column
    // silently stops being frozen exactly when the table just got narrower.
    //
    // Sticky positioning costs nothing when there is nothing to scroll: with no
    // overflow the cell never leaves its static position, so this is identical
    // to `relative` until the table is actually wider than its card.
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: 1,
    position: isPinned ? "sticky" : "relative",
    // The frozen cell's background is a class, not a style — see
    // `getPinnedClasses`. An inline background would win over the row's
    // `hover:` and `data-[state=selected]:` rules and leave the frozen column
    // as the one part of the row that does not respond to the pointer.
    borderTopRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderBottomRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderTopLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    borderBottomLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    // Bảng rộng hơn tổng kích thước cột thì trình duyệt chia phần dư theo tỷ
    // lệ cho MỌI cột có width — cột hẹp cố định (Thứ tự) cũng bị kéo giãn.
    // Cột đánh dấu `meta.fill` để width tự do nên nhận hết phần dư đó.
    width: column.columnDef.meta?.fill ? undefined : column.getSize(),
    zIndex: isPinned ? 1 : 0,
  };
}

/**
 * The classes a frozen cell needs in order to read as part of its row.
 *
 * A sticky cell slides over the ones behind it, so it has to be opaque. Two
 * things about *which* opaque, both of which only become visible once a column
 * is actually pinned:
 *
 * - It is `bg-card`, not `bg-background`. The table is drawn inside a `bg-card`
 *   panel and those are different tokens in both modes — `0.105` against `0.18`
 *   lightness in dark — so painting the frozen column in `--background` draws a
 *   stripe down the edge of the table rather than hiding it.
 * - The row's hover and selected colours have to be restated here through
 *   `group/row`. The row paints them on the `<tr>`, which an opaque cell covers,
 *   so without this the frozen column stays pale while the rest of the row
 *   lights up — and the actions are exactly what the pointer is travelling to.
 */
export function getPinnedClasses<TData>({
  column,
}: {
  column: Column<TData>;
}): string | undefined {
  if (!column.getIsPinned()) return undefined;

  return cn(
    "bg-card",
    // A pinned *header* cell has to stay on the header band, or the frozen
    // column shows a white stripe through an otherwise tinted strip.
    "[&[data-slot=table-head]]:bg-table-head",
    // Màu hover/chọn phải ĐỤC: `bg-accent/40` là màu trong suốt, nên lúc rê chuột
    // các ô cuộn bên dưới (nhãn trạng thái, chữ) lộ xuyên qua cột đang ghim. Pha
    // sẵn màu nhấn lên nền thẻ cho ra đúng màu hàng đang có, mà vẫn che kín.
    "group-hover/row:bg-[color-mix(in_srgb,var(--accent)_40%,var(--card))]",
    "group-data-[state=selected]/row:bg-[color-mix(in_srgb,var(--accent)_60%,var(--card))]"
  );
}

DataTable.displayName = "DataTable";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Cột nhận toàn bộ bề rộng dư của bảng. */
    fill?: boolean;
    /** Lời giải thích cột — hiện thành dấu "?" cạnh tiêu đề. */
    hint?: ReactNode;
    /** Giữ mở cho meta riêng của từng màn. */
    [key: string]: unknown;
  }
}
