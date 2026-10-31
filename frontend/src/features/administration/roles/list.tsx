import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";

import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { Badge } from "@/shared/ui/badge";
import type { Role } from "@/domains/role/types";
import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";

/** Danh sách vai trò (HT-05): mã, tên, mô tả và số quyền đã cấp. */
export const RoleList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Role>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        header: "Mã",
        enableSorting: false,
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.systemRole && (
              <Badge variant="secondary" className="text-[10px]">
                Hệ thống
              </Badge>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("description", {
        id: "description",
        enableResizing: true,
        header: "Mô tả",
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">{getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.display({
        id: "permissions",
        header: "Quyền",
        enableSorting: false,
        // Số lượng thay vì liệt kê mã: một vai có thể cấp vài chục quyền, danh sách đầy đủ nằm ở
        // trang chi tiết.
        cell: ({ row }) => <Badge variant="outline">{row.original.permissions.length}</Badge>,
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {/* Vai hệ thống không xoá được (API trả 409), nên không đưa nút ra rồi từ chối. */}
            {!row.original.systemRole && (
              <DeleteButton
                recordItemId={row.original.id}
                record={row.original}
                iconOnly
                size="icon-sm"
              />
            )}
          </RowActions>
        ),
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
      }),
    ];
  }, []);

  const table = useTable({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    },
  });

  return (
    <ListView>
      <ListViewHeader />
      <DataTable
        table={table}
        toolbar={<ListToolbar table={table} search={<DataTableQuickFilter table={table} />} />}
      />
    </ListView>
  );
};
