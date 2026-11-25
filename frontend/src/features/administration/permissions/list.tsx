import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";

import {
  actionsColumnWidth,
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
} from "@/shared/components/views/list-view";
import { ShowButton } from "@/shared/components/buttons/show";
import { Badge } from "@/shared/ui/badge";
import {
  ACTION_LABELS,
  ACTION_VARIANTS,
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/permission/types";

export const PermissionList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Permission>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        enableResizing: true,
        header: "Mã",
        enableSorting: true,
        // The whole point of the row: this exact string is what @PreAuthorize
        // matches and what the access control provider asks for, so it is
        // shown verbatim and in mono rather than prettified.
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "resource",
        header: "Tài nguyên",
        // Derived from the code rather than sent by the API, which is why it
        // does not sort: there is no column behind it to sort on. Sorting by
        // `code` groups by resource anyway, since the resource is its prefix.
        enableSorting: false,
        cell: ({ row }) => {
          const { resource, action } = splitPermissionCode(row.original.code);
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm">{humanizeResource(resource)}</span>
              <Badge
                variant={ACTION_VARIANTS[action] ?? "outline"}
                className="text-[0.625rem]"
              >
                {ACTION_LABELS[action] ?? action}
              </Badge>
            </div>
          );
        },
        size: 220,
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.systemPermission && (
              <Badge variant="secondary" className="text-[0.625rem]">
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
          <span className="text-muted-foreground text-sm">
            {getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Thao tác",
        // Show only. Edit and delete would be hidden by access control anyway
        // — no `permissions:write` or `permissions:delete` code exists to
        // grant — but the endpoints do not exist either, so they are not
        // offered at all rather than offered and then refused.
        cell: ({ row }) => (
          <div className="flex gap-1">
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          </div>
        ),
        enableSorting: false,
        ...actionsColumnWidth(1),
      }),
    ];
  }, []);

  const table = useTable({
    columns,
    // Drag the divider in the header to resize; double-click it to go back to
    // the column's default width.
    // Resizing is opt-in per column: `RESIZABLE_COLUMN_DEFAULTS` turns it off
    // by default and a column asks for a handle with `enableResizing: true`.
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    // The row's actions are the cell somebody scrolls sideways *in order to*
    // reach, so they are the one cell that must not be what scrolls away.
    // `getCommonStyles` in `data-table.tsx` renders a pinned column sticky, but
    // only ever reads pinning state and never sets it, so a column stays where
    // it was declared until a table asks for this.
    //
    // Sticky positioning costs nothing while the table fits its card — the cell
    // never leaves its static position — so this is unconditional rather than
    // switched on once the table is measured to overflow.
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
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={<DataTableQuickFilter table={table} />}
            />
          </>
        }
      />
    </ListView>
  );
};
