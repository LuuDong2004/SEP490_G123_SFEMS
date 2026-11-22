import { Suspense } from "react";
import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
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
import type { DepartmentOfEducation } from "@/domains/department-of-education/types";
import {
  MANAGING_BODY_TYPE_SHORT_LABELS,
  STATUS_LABELS,
} from "@/domains/department-of-education/types";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";

export const DepartmentOfEducationList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<DepartmentOfEducation>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        header: "Mã",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên đơn vị",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.address ? (
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.address}
              </span>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("type", {
        id: "type",
        header: "Loại",
        enableSorting: true,
        // Nhãn ngắn: "UBND" đứng cạnh "Sở" trong một cột hẹp, và loại là thứ
        // người đọc quét mắt để biết cơ quan này quản trường cấp nào.
        cell: ({ getValue }) => (
          <Badge variant="neutral">
            {MANAGING_BODY_TYPE_SHORT_LABELS[getValue()] ?? getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("province", {
        id: "province",
        header: "Tỉnh/Thành phố",
        enableSorting: true,
        cell: ({ getValue }) => <span className="text-sm">{getValue() ?? "—"}</span>,
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
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: { syncWithLocation: true, pagination: { pageSize: DEFAULT_PAGE_SIZE } },
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
      {/* Chỗ hộp thoại Thêm / Sửa mở ra. Danh sách ở lại phía sau lớp phủ, nên
          đóng hộp thoại là về đúng bộ lọc và trang đang xem. */}
      {/* Hộp thoại lập / sửa là chunk tải sau: chờ tại chỗ, không che cả danh sách. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ListView>
  );
};
