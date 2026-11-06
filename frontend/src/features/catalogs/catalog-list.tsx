import { useMemo } from "react";
import { Link } from "react-router";
import { useTable } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { OptionFilter } from "@/shared/components/data-table/ref-filter";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { ACTIVE_LABELS } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogRecord } from "@/features/catalogs/catalog-config";
import { ActiveBadge } from "@/features/catalogs/active-badge";
import { Button } from "@/shared/ui/button";

const ACTIVE_FILTER_OPTIONS = [
  { value: "true", label: ACTIVE_LABELS.true },
  { value: "false", label: ACTIVE_LABELS.false },
];

/**
 * Danh sách của một danh mục: mã, tên, các cột riêng, trạng thái và nút thao tác. Tìm theo mã hoặc
 * tên, lọc đang dùng / ngừng dùng. Nút Thêm, Sửa, Xoá tự ẩn khi tài khoản chỉ có quyền xem.
 */
export function CatalogList({ config }: { config: CatalogConfig }) {
  const columns = useMemo<ColumnDef<CatalogRecord>[]>(
    () => [
      {
        id: "index",
        header: "STT",
        size: 60,
        enableSorting: false,
        enableHiding: false,
        // Số thứ tự liên tục qua các trang: trang 2 bắt đầu từ 21 chứ không quay về 1.
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination;
          return <span className="text-muted-foreground tabular-nums">{pageIndex * pageSize + row.index + 1}</span>;
        },
      },
      {
        id: "code",
        accessorKey: "code",
        header: config.codeLabel ?? "Mã",
        size: 140,
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Tên",
        enableSorting: false,
        meta: { fill: true },
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      ...(config.extraColumns ?? []),
      ...(!config.hideActive ? [{
        id: "active",
        accessorKey: "active",
        header: "Trạng thái",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.active} />,
      } as ColumnDef<CatalogRecord>] : []),
      {
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {(!config.canModify || config.canModify(row.original)) ? <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" /> : null}
            {(!config.canModify || config.canModify(row.original)) ? <DeleteButton
              recordItemId={row.original.id}
              record={row.original}
              noun={config.noun}
              iconOnly
              size="icon-sm"
            /> : null}
          </RowActions>
        ),
      },
    ],
    [config],
  );

  const table = useTable<CatalogRecord>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: {
      resource: config.resource,
      // Không ghi bộ lọc lên URL: hộp thoại thêm/sửa/xem cũng nằm trên màn này, đường dẫn của chúng
      // không nên mang theo tham số của danh sách.
      syncWithLocation: false,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    },
  });

  const { ExtraFilters } = config;

  return (
    <ListView>
      <ListViewHeader actions={config.listLink ? <Button variant="outline" asChild><Link to={config.listLink.to}>{config.listLink.label}</Link></Button> : undefined} />
      <DataTable
        table={table}
        toolbar={
          <ListToolbar
            table={table}
            search={<DataTableQuickFilter table={table} placeholder="Tìm theo mã hoặc tên" />}
            filters={
              <>
                {!config.hideActive ? <OptionFilter table={table} field="active" all="Mọi trạng thái" options={ACTIVE_FILTER_OPTIONS} /> : null}
                {ExtraFilters ? <ExtraFilters table={table} /> : null}
              </>
            }
          />
        }
      />
    </ListView>
  );
}
