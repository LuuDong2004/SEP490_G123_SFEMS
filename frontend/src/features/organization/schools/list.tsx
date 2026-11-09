import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "react-router";
import { LayoutGrid, Rows3 } from "lucide-react";
import React from "react";

import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { RefFilter } from "@/shared/components/data-table/ref-filter";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
} from "@/shared/components/views/list-view";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { Badge } from "@/shared/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { SchoolCards } from "@/features/organization/schools/school-cards";
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
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên trường",
        enableSorting: true,
        // Một dòng tên, không dòng phụ phường / xã: cột Cơ quan quản lý ngay bên cạnh đã nói trường thuộc
        // phường nào, và hai dòng làm bảng cao gấp đôi.
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      }),
      columnHelper.display({
        id: "departmentOfEducation",
        enableResizing: true,
        header: "Cơ quan quản lý",
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
        cell: ({ row }) => {
          const level = row.original.educationLevel;
          if (!level) return <span className="text-muted-foreground">—</span>;
          return <Badge variant="neutral">{level.shortName ?? level.name}</Badge>;
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

  // Bảng trả lời "so sánh và lọc", khối trả lời "lướt qua xem có gì". Hai câu
  // hỏi khác nhau trên cùng một tập dữ liệu, nên chúng dùng chung `useTable`:
  // đổi cách nhìn không được làm mất bộ lọc, thứ tự hay trang đang xem.
  const [view, setView] = React.useState<"table" | "grid">("table");

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
              filters={
                <>
                  <RefFilter table={table} field="departmentOfEducation.id" resource="departments_of_education" all="Mọi cơ quan quản lý" searchPlaceholder="Tìm cơ quan…" className="w-60" />
                  <RefFilter table={table} field="educationLevel.id" resource="education_levels" all="Mọi cấp học" className="w-44" />
                  <RefFilter table={table} field="schoolType.id" resource="school_types" all="Mọi loại hình" className="w-40" />
                </>
              }
              actions={
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={view}
                  onValueChange={(v) => v && setView(v as "table" | "grid")}
                >
                  <ToggleGroupItem value="table" aria-label="Dạng bảng">
                    <Rows3 />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="grid" aria-label="Dạng khối">
                    <LayoutGrid />
                  </ToggleGroupItem>
                </ToggleGroup>
              }
            />
          </>
        }
        renderBody={view === "grid" ? (rows) => <SchoolCards schools={rows} /> : undefined}
      />
    </ListView>
  );
};
