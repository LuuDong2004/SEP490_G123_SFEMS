"use client";

import { useState, type ReactNode } from "react";
import type { BaseRecord, CrudFilter, HttpError } from "@refinedev/core";
import {
  useCan,
  useDataProvider,
  useGo,
  useResourceParams,
  useTranslate,
} from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Column } from "@tanstack/react-table";
import {
  Columns3Icon,
  DatabaseIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  RefreshCwIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";

import { describeFilters } from "@/shared/api/export-log";
import { downloadXlsx } from "@/shared/api/xlsx-export";
import { Button } from "@/shared/ui/button";
import { useColumnsKey, writeColumnPrefs } from "@/shared/components/data-table/column-prefs";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { safeDownloadName } from "@/shared/lib/download-filename";

/* --------------------------------------------------------------------------
   Refresh
   -------------------------------------------------------------------------- */

/**
 * Re-read the current page.
 *
 * Deliberately not the `RefreshButton` the detail screens use: that one is
 * built on `useRefreshButton`, which invalidates a *record* and needs an id. A
 * list has no id — what it has is a query with the current filters, sorters and
 * page already in it, so refetching that query is the whole operation.
 *
 * It spins on `isFetching` rather than `isLoading`, because `isLoading` is only
 * true on the very first fetch: a refresh of data already on screen would
 * otherwise give no sign it had happened at all.
 */
export function DataTableRefresh<TData extends BaseRecord>({
  table,
  className,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
}) {
  const { tableQuery } = table.refineCore;
  const t = useTranslate();
  const isFetching = tableQuery.isFetching;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("buttons.refresh", "Refresh")}
          disabled={isFetching}
          onClick={() => void tableQuery.refetch()}
          className={className}
        >
          <RefreshCwIcon className={cn(isFetching && "animate-spin")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("buttons.refresh", "Refresh")}</TooltipContent>
    </Tooltip>
  );
}

/* --------------------------------------------------------------------------
   Column visibility
   -------------------------------------------------------------------------- */

/** The header text, when it is a plain string — otherwise the column's id. */
function columnLabel<TData>(column: Column<TData, unknown>) {
  const header = column.columnDef.header;
  if (typeof header === "string" && header.trim()) return header;
  const label = (column.columnDef.meta as { label?: string } | undefined)?.label;
  return label ?? column.id;
}

/**
 * Show and hide columns.
 *
 * The actions column is excluded on purpose. It is not data — it is how a row
 * is opened and deleted — so hiding it takes the screen's controls away and
 * leaves nothing to say where they went.
 */
export function DataTableColumnToggle<TData extends BaseRecord>({
  table,
  className,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
}) {
  const t = useTranslate();
  const columnsKey = useColumnsKey(table);
  const columns = table.reactTable
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && column.id !== "actions" && column.id !== "select");

  if (columns.length === 0) return null;

  const hidden = columns.filter((column) => !column.getIsVisible()).length;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size={hidden > 0 ? "default" : "icon"}
              aria-label={t("buttons.columns", "Columns")}
              className={className}
            >
              <Columns3Icon />
              {hidden > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {columns.length - hidden}/{columns.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("buttons.columns", "Columns")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="max-h-80 w-52 overflow-y-auto">
        <DropdownMenuLabel>{t("buttons.columnsShown", "Columns shown")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            // Radix closes on select by default, which would mean reopening the
            // menu for every column somebody wants to turn off.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(value) => { column.toggleVisibility(!!value); writeColumnPrefs(columnsKey, { [column.id]: !!value }); }}
          >
            <span className="truncate">{columnLabel(column)}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {hidden > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                columns.forEach((column) => column.toggleVisibility(true));
                writeColumnPrefs(columnsKey, Object.fromEntries(columns.map((column) => [column.id, true])));
              }}
            >
              {t("buttons.showAll", "Show all")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------------------
   Export
   -------------------------------------------------------------------------- */

/**
 * A cell as one CSV field.
 *
 * A list cell is often an object — an assignee, a department, a category — and
 * `String(value)` on one of those writes `[object Object]` into the file, which
 * is worse than leaving the column out. So a summary object is reduced to the
 * one field a person would have read on screen, and anything genuinely
 * structured falls back to JSON rather than to nonsense.
 */
function toField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["fullName", "name", "title", "code", "username"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
    if (Array.isArray(value)) return value.map(toField).join("; ");
    return "";
  }
  return String(value);
}

/**
 * Chặn chèn công thức: ô bắt đầu bằng = + - @ (hoặc tab, xuống dòng) Excel đọc thành công thức —
 * một tên "=HYPERLINK(…)" ai đó gõ vào sẽ chạy trên máy người mở tệp. Thêm dấu ' phía trước để
 * nó là chữ. Số âm ("-5", "-1.5") giữ nguyên.
 */
function neutralize(field: string): string {
  return /^[=+\-@\t\r]/.test(field) && !/^-\d+([.,]\d+)?$/.test(field) ? `'${field}` : field;
}

/**
 * Export the table.
 *
 * Two items, because they answer different questions and only one of them is
 * cheap. **This page** is the rows already in the browser and needs no request:
 * the columns are the ones currently shown, in the order they are shown, so
 * hiding a column from the Columns menu takes it out of the file too. **All
 * rows** goes back to the API through refine's `useExport`, page by page,
 * carrying the current filters and sorters so the file matches the table
 * rather than the whole resource.
 *
 * Both write a real Excel file (.xlsx) with only the columns on screen — see `build`.
 *
 * A row-level scope still applies to the second one: the export reads through
 * the same endpoint, so it can only ever contain rows the caller may read.
 */
export function useTableExport<TData extends BaseRecord>(
  table: UseTableReturnType<TData, HttpError>,
) {
  const { resource, identifier } = useResourceParams();
  // Bảng đọc một tài nguyên KHÁC tài nguyên của trang (vd. bảng chi tiết `equipment_items`
  // trên màn `equipment`) khai nó ở `meta.exportResource` của useTable — không thì "xuất tất
  // cả" đi đọc tài nguyên của trang với bộ lọc của bảng kia.
  const override = (table.reactTable.options.meta as { exportResource?: string } | undefined)?.exportResource;
  const name = override ?? identifier ?? resource?.name ?? "export";
  const title = override === "equipment_items" ? "Danh sách thiết bị" : String(resource?.meta?.label ?? "Dữ liệu");
  const filename = safeDownloadName(title);
  const { filters, sorters } = table.refineCore;
  const dataProvider = useDataProvider();
  const [isLoading, setLoading] = useState(false);

  /**
   * Tệp Excel = ĐÚNG bảng trên màn (trưởng nhóm 24/11/2026: trước đây "mọi dòng" đổ nguyên bản ghi API — mã nội bộ, cờ,
   * đối tượng lồng nhau thành "[object Object]"): chỉ các cột đang hiện, đúng tên cột, giá trị đọc được (`meta.exportValue`
   * của cột, không thì accessor; đối tượng lấy tên). Cột không có giá trị (STT, thao tác, ô chọn) không vào tệp.
   */
  const build = (records: TData[]) => {
    const columns = table.reactTable.getVisibleLeafColumns().filter((c) => {
      const meta = c.columnDef.meta as { exportValue?: unknown } | undefined;
      return c.id !== "actions" && c.id !== "select" && (c.accessorFn || meta?.exportValue);
    });
    const valueOf = (c: (typeof columns)[number], r: TData) => {
      const meta = c.columnDef.meta as { exportValue?: (row: TData) => unknown } | undefined;
      const v = meta?.exportValue ? meta.exportValue(r) : c.accessorFn?.(r, 0);
      if (v == null || v === "") return null;
      if (typeof v === "number") return v;
      if (typeof v === "boolean") return v ? "Có" : "Không";
      return neutralize(toField(v)) || null;
    };
    const cells = records.map((r) => columns.map((c) => valueOf(c, r)));
    return {
      columns: columns.map((c, i) => ({
        key: `c${i}`,
        label: columnLabel(c),
        type: cells.some((row) => typeof row[i] === "number") ? ("number" as const) : ("text" as const),
      })),
      rows: cells.map((row) => Object.fromEntries(row.map((v, i) => [`c${i}`, v]))),
    };
  };
  const describe = (what: string) => [what, describeFilters(filters)].filter(Boolean).join(" · ");
  const save = async (records: TData[], what: string, suffix: string, groupBy?: (r: TData) => string | null | undefined) => {
    const { columns, rows } = build(records);
    // Mỗi nhóm (trường) một trang tính, theo tên; trang đầu là tổng hợp.
    const parts = groupBy ? [...new Set(records.map((r) => groupBy(r) ?? "Không rõ"))].sort((a, b) => a.localeCompare(b, "vi"))
      .map((g) => ({ name: g, title: `${title} · ${g}`, rows: rows.filter((_, i) => (groupBy(records[i]) ?? "Không rõ") === g) })) : undefined;
    await downloadXlsx({ resource: name, filename: `${filename}${suffix}.xlsx`, title, subtitle: describe(what), columns, rows, parts, detail: describe(what) });
  };
  /** Đọc lại MỌI dòng qua API theo trang (cùng bộ lọc, cùng thứ tự, cộng `extra`), tối đa 50.000 dòng. */
  const fetchAll = async (extra: CrudFilter[] = []) => {
    const source = override ?? resource?.name;
    if (!source) return [] as TData[];
    const provider = dataProvider();
    const all: TData[] = [];
    for (let page = 1; all.length < 50_000; page++) {
      const res = await provider.getList<TData>({
        resource: source, filters: [...filters, ...extra], sorters, pagination: { currentPage: page, pageSize: 500, mode: "server" },
      });
      all.push(...res.data);
      if (res.data.length < 500 || all.length >= res.total) break;
    }
    return all;
  };
  /** Cho hộp xuất riêng của màn (vd. Thiết bị: chọn trường, mỗi trường một trang tính). */
  const exportWith = async (o: { extra?: CrudFilter[]; groupBy?: (r: TData) => string | null | undefined }) => {
    setLoading(true);
    try {
      await save(await fetchAll(o.extra), "Mọi dòng khớp bộ lọc", "", o.groupBy);
    } finally {
      setLoading(false);
    }
  };
  // Màn có hộp xuất riêng (`meta.openExport`): hai mục xuất mở hộp đó thay vì tải ngay.
  const openExport = (table.reactTable.options.meta as { openExport?: () => void } | undefined)?.openExport;

  const exportPage = () => {
    if (openExport) return openExport();
    setLoading(true);
    void save(table.reactTable.getRowModel().rows.map((r) => r.original), "Trang đang xem", " - trang đang xem")
      .catch(() => undefined).finally(() => setLoading(false));
  };
  /** Mọi dòng khớp bộ lọc: đọc lại qua API theo trang (cùng bộ lọc, cùng thứ tự), tối đa 50.000 dòng. */
  const exportAll = () => {
    if (openExport) return openExport();
    setLoading(true);
    void fetchAll().then((all) => save(all, "Mọi dòng khớp bộ lọc", "")).catch(() => undefined).finally(() => setLoading(false));
  };

  return { exportPage, exportAll, exportWith, isLoading };
}

export function DataTableExport<TData extends BaseRecord>({
  table,
  className,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
}) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const { exportPage, exportAll, isLoading } = useTableExport(table);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("buttons.export.label", "Export")}
              className={className}
            >
              {isLoading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("buttons.export.label", "Export")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("buttons.export.title", "Tải về tệp Excel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={exportPage}>
          <span className="flex flex-col">
            <span>{t("buttons.export.page", "This page")}</span>
            <span className="text-muted-foreground text-xs">
              {t("buttons.export.pageHint", "The rows and columns on screen")}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoading}
          onSelect={exportAll}
        >
          <span className="flex flex-col">
            <span>{t("buttons.export.all", "All rows")}</span>
            <span className="text-muted-foreground text-xs">
              {t("buttons.export.allHint", "Every match for the current filters")}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------------------
   More actions
   -------------------------------------------------------------------------- */

/**
 * Nút "Thao tác khác" — cùng logic với `MoreActionsMenu` của bản Jmix: icon
 * bánh răng (quay một vòng mỗi lần bấm), mở menu Làm mới · Nhập Excel · Xuất
 * Excel. Nhập Excel chưa có nên báo "sắp có", như bản Jmix làm với màn chưa
 * triển khai.
 */
/** Dữ liệu nhập được qua màn Nhập dữ liệu đầu vào (dữ liệu của trường, danh sách trường, phường/xã). */
const IMPORTABLE = new Set(["equipment", "rooms", "buildings", "campuses", "staff", "school_classes", "schools", "wards"]);

export function DataTableMoreActions<TData extends BaseRecord>({
  table,
  className,
  extraItems,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
  /** Lối phụ của MÀN (Tra cứu, In tem…) — đứng đầu menu, trên các thao tác của bảng. */
  extraItems?: ReactNode;
}) {
  const t = useTranslate();
  const { tableQuery } = table.refineCore;
  // Nhập Excel đi qua MỘT chỗ — màn Nhập dữ liệu đầu vào (vùng chờ, sửa lỗi rồi mới ghi). Chỉ hiện ở màn có dữ liệu
  // nhập được qua đó, và khi tài khoản vào được màn đó.
  const go = useGo();
  const { resource } = useResourceParams();
  const mayImport = useCan({ resource: "data_imports", action: "list" }).data?.can ?? false;
  const importable = mayImport && IMPORTABLE.has(resource?.name ?? "");
  const { exportPage, exportAll, isLoading } = useTableExport(table);
  // Đổi key để trình duyệt chạy lại animation mỗi lần bấm.
  const [spin, setSpin] = useState(0);
  // Chọn cột hiển thị nằm TRONG menu này — không còn là một nút riêng trên hàng công cụ.
  const columns = table.reactTable.getAllLeafColumns().filter((column) => column.getCanHide() && column.id !== "actions" && column.id !== "select");
  const hidden = columns.filter((column) => !column.getIsVisible()).length;
  const columnsKey = useColumnsKey(table);

  return (
    <DropdownMenu onOpenChange={(open) => open && setSpin((n) => n + 1)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("buttons.moreActions", "Thao tác khác")}
              className={className}
            >
              {isLoading || tableQuery.isFetching ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SettingsIcon
                  key={spin}
                  className={cn(spin > 0 && "animate-[spin_0.6s_ease-in-out_1]")}
                />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("buttons.moreActions", "Thao tác khác")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        {extraItems ? (
          <>
            {extraItems}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={() => void tableQuery.refetch()}>
          <RefreshCwIcon />
          {t("buttons.refresh", "Làm mới")}
        </DropdownMenuItem>
        {columns.length ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
              <Columns3Icon />
              {t("buttons.columns", "Columns")}
              {hidden > 0 ? (
                <span className="text-muted-foreground ms-auto text-xs tabular-nums">{columns.length - hidden}/{columns.length}</span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 w-52 overflow-y-auto">
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  // Không đóng menu sau mỗi lần tích — tắt ba cột là ba lần mở lại.
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => { column.toggleVisibility(!!value); writeColumnPrefs(columnsKey, { [column.id]: !!value }); }}
                >
                  <span className="truncate">{columnLabel(column)}</span>
                </DropdownMenuCheckboxItem>
              ))}
              {hidden > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); columns.forEach((column) => column.toggleVisibility(true)); writeColumnPrefs(columnsKey, Object.fromEntries(columns.map((column) => [column.id, true]))); }}>
                    {t("buttons.showAll", "Show all")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {importable ? (
          <DropdownMenuItem onSelect={() => go({ to: "/data-imports" })}>
            <UploadIcon />
            {t("buttons.importExcel", "Nhập Excel")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
            <DatabaseIcon />
            {t("buttons.exportExcel", "Xuất Excel")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem onSelect={exportPage}>
              <FileSpreadsheetIcon />
              {t("buttons.export.page", "Trang này")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLoading} onSelect={exportAll}>
              <DownloadIcon />
              {t("buttons.export.all", "Tất cả")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

DataTableMoreActions.displayName = "DataTableMoreActions";
DataTableRefresh.displayName = "DataTableRefresh";
DataTableColumnToggle.displayName = "DataTableColumnToggle";
DataTableExport.displayName = "DataTableExport";
