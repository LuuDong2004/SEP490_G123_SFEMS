import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Link, Outlet } from "react-router";
import React, { Suspense } from "react";

import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { ListToolbar, ListView } from "@/shared/components/views/list-view";
import { CreateButton } from "@/shared/components/buttons/create";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { Badge } from "@/shared/ui/badge";
import { SchoolViewSwitch } from "@/features/organization/schools/school-view-switch";
import { SchoolScopeHeader } from "@/features/organization/explorer/scope-header";
import type { School } from "@/domains/school/types";
import { STATUS_LABELS } from "@/domains/school/types";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";

export const SchoolList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<School>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        header: "Mã trường",
        enableSorting: true,
        // Cỡ cột theo nội dung: mã, cấp học, trạng thái giữ cỡ vừa đủ, phần rộng dư chia cho tên trường và cơ quan quản lý.
        size: 130,
        meta: { fixed: true },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên trường",
        enableSorting: true,
        size: 260,
        meta: { fill: true },
        // Một dòng tên, không dòng phụ phường / xã: cột Cơ quan quản lý ngay bên cạnh đã nói trường thuộc
        // phường nào, và hai dòng làm bảng cao gấp đôi.
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      }),
      columnHelper.display({
        id: "departmentOfEducation",
        enableResizing: true,
        header: "Cơ quan quản lý",
        size: 380,
        meta: { fill: true },
        // Không sắp xếp được: API sắp theo thuộc tính của chính trường, không
        // theo tên của bảng liên kết. Bật cờ này lên sẽ cho một cột trông như
        // sắp được mà thật ra bị bỏ qua.
        enableSorting: false,
        cell: ({ row }) => {
          const department = row.original.departmentOfEducation;
          if (!department) return <span className="text-muted-foreground">—</span>;
          return (
            <Link
              to={`/departments-of-education/show/${department.id}`}
              className="text-sm hover:underline"
            >
              {department.name}
            </Link>
          );
        },
      }),
      columnHelper.display({
        id: "educationLevel",
        header: "Cấp học",
        enableSorting: false,
        size: 110,
        meta: { fixed: true },
        cell: ({ row }) => {
          const level = row.original.educationLevel;
          if (!level) return <span className="text-muted-foreground">—</span>;
          return <Badge variant="info">{level.shortName ?? level.name}</Badge>;
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Trạng thái",
        enableSorting: true,
        size: 170,
        meta: { fixed: true },
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
      {/* Cùng bố cục với Tổng quan các trường (không tiêu đề to, thẻ đầu, nút cách xem rồi Thêm trường ở hàng công cụ):
          đây là cách xem "Danh sách" của nhóm đó, chuyển qua lại không xô lệch. */}
      <h1 className="sr-only">Trường học</h1>
      <SchoolScopeHeader />
      <DataTable
        table={table}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={<DataTableQuickFilter table={table} />}
              actions={
                <div className="flex items-center gap-2">
                  <SchoolViewSwitch current="list" />
                  <CreateButton size="sm">Thêm trường</CreateButton>
                </div>
              }
            />
          </>
        }
      />
      {/* Chỗ hộp thoại Thêm / Sửa trường mở ra: danh sách ở lại sau lớp phủ, đóng là về đúng bộ lọc / trang. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ListView>
  );
};
