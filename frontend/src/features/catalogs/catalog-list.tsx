import { useMemo } from "react";
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
import type { CatalogConfig, CatalogRecord } from "@/features/catalogs/catalog-config";
import { ActiveBadge } from "@/features/catalogs/active-badge";

const ACTIVE_FILTER_OPTIONS = [
  { value: "true", label: "Đang dùng" },
  { value: "false", label: "Ngừng dùng" },
];

/**
 * Danh sách của một danh mục: mã, tên, các cột riêng, trạng thái và nút thao tác. Tìm theo mã hoặc
 * tên, lọc đang dùng / ngừng dùng. Nút Thêm, Sửa, Xoá tự ẩn khi tài khoản chỉ có quyền xem.
 */
export function CatalogList({ config }: { config: CatalogConfig }) {
  const columns = useMemo<ColumnDef<CatalogRecord>[]>(
    () => [
      {
        id: "code",
        accessorKey: "code",
        header: "Mã",
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
      {
        id: "active",
        accessorKey: "active",
        header: "Trạng thái",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.active} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <DeleteButton
              recordItemId={row.original.id}
              record={row.original}
              noun={config.noun}
              iconOnly
              size="icon-sm"
            />
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
      <ListViewHeader />
      <DataTable
        table={table}
        toolbar={
          <ListToolbar
            table={table}
            search={<DataTableQuickFilter table={table} placeholder="Tìm theo mã hoặc tên" />}
            filters={
              <>
                <OptionFilter table={table} field="active" all="Mọi trạng thái" options={ACTIVE_FILTER_OPTIONS} />
                {ExtraFilters ? <ExtraFilters table={table} /> : null}
              </>
            }
          />
        }
      />
    </ListView>
  );
}
