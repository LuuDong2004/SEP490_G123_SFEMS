import { Suspense } from "react";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";
import { Outlet } from "react-router";

import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
} from "@/shared/components/views/list-view";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { Badge } from "@/shared/ui/badge";
import type { User } from "@/domains/user/types";
import { STATUS_LABELS } from "@/domains/user/types";
import { USER_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { formatDate, DEFAULT_PAGE_SIZE } from "@/shared/lib/format";

export const UserList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<User>();

    return [
      columnHelper.accessor("username", {
        id: "username",
        enableResizing: true,
        header: "Tên đăng nhập",
        enableSorting: true,
        // Một dòng: email trùng tên đăng nhập ở gần hết tài khoản và có ở trang chi tiết.
        cell: ({ row }) => <span className="font-medium">{row.original.username}</span>,
      }),
      columnHelper.accessor("fullName", {
        id: "fullName",
        enableResizing: true,
        header: "Họ tên",
        enableSorting: true,
      }),
      columnHelper.display({
        id: "school",
        enableResizing: true,
        header: "Trường công tác",
        // Không sắp xếp được: `_sort=school` không phải thuộc tính API nhận, và
        // để header bấm được sẽ cho một phép sắp lặng lẽ không làm gì. Dùng ô
        // lọc theo trường thay vào đó.
        enableSorting: false,
        cell: ({ row }) => {
          const school = row.original.school;
          if (!school) {
            return (
              <span className="text-muted-foreground text-sm">
                Không thuộc trường nào
              </span>
            );
          }
          // Không dòng mã trường bên dưới: mã nội bộ không giúp nhận ra trường, tên đã đủ.
          return <span className="text-sm">{school.name}</span>;
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Trạng thái",
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "roles",
        header: "Vai trò",
        // Not sortable: the value is a collection, and sorting a row by "its
        // roles" has no meaning the API could implement.
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.name}
              </Badge>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor("lastLoginAt", {
        id: "lastLoginAt",
        header: "Đăng nhập lần cuối",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
          </RowActions>
        ),
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
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
      {/* Hộp thoại Thêm người dùng (`/users/create`) mở ở đây, danh sách vẫn đứng sau. */}
      {/* Hộp thoại lập / sửa là chunk tải sau: chờ tại chỗ, không che cả danh sách. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ListView>
  );
};
