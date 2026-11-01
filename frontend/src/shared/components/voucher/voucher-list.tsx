import { useTable } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { FilePlus2 } from "lucide-react";
import type { ReactNode } from "react";

import { CreateButton } from "@/shared/components/buttons/create";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { OptionFilter, SchoolFilter } from "@/shared/components/data-table/ref-filter";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { AwaitingMeToggle } from "@/shared/components/voucher/awaiting-me-toggle";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { VOUCHER_STATUS_OPTIONS, type VoucherBase } from "@/domains/voucher/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Màn danh sách của một loại phiếu: số phiếu, trường (khi xem nhiều trường), các cột riêng, trạng
 * thái, thao tác. Bộ lọc luôn có ô tìm theo số phiếu, trường và trạng thái; nút "Chờ tôi duyệt" hiện
 * với người duyệt được.
 *
 * Nút Sửa / Xoá trên từng dòng hiện theo `_actions` của server — phiếu đã trình không có nút Sửa,
 * thay vì có nút rồi trả về lỗi.
 *
 * Cách dùng:
 * <pre>
 * <VoucherList<EquipmentIntake> resource="equipment_intakes" columns={[
 *   { id: "intakeDate", accessorKey: "intakeDate", header: "Ngày nhập", cell: ... },
 * ]} />
 * </pre>
 */
export function VoucherList<T extends VoucherBase>({
  resource,
  columns,
  toolbarExtra,
  statusCell,
  createLabel = "Lập phiếu",
  initialFilters,
}: {
  resource: string;
  columns: ColumnDef<T, any>[];
  /** Cột Trạng thái nói theo nghiệp vụ của loại phiếu; trả `null` là nhãn chung. */
  statusCell?: (row: T) => ReactNode;
  toolbarExtra?: ReactNode;
  createLabel?: string;
  initialFilters?: { field: string; operator: "eq"; value: string }[];
}) {
  // Tài khoản của một trường chỉ thấy phiếu của trường mình — cột Trường lặp một tên ở mọi dòng.
  const { perspective } = usePerspective();
  const allColumns: ColumnDef<T, any>[] = [
    {
      id: "code",
      accessorKey: "code",
      header: "Số phiếu",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.code ? (
          <span className="font-mono text-xs font-medium">{row.original.code}</span>
        ) : row.original.status !== "DRAFT" ? (
          <span className="text-muted-foreground text-xs">Không cấp số</span>
        ) : (
          <span className="text-warning-text text-xs">Chưa cấp số</span>
        ),
    },
    ...(perspective === "school"
      ? []
      : [{
          id: "school",
          header: "Trường",
          enableSorting: false,
          cell: ({ row }) => row.original.school?.name ?? "—",
        } satisfies ColumnDef<T, any>]),
    ...columns,
    {
      id: "status",
      accessorKey: "status",
      header: "Trạng thái",
      enableSorting: false,
      cell: ({ row }) =>
        statusCell?.(row.original) ?? (
          <VoucherStatusBadge status={row.original.status} step={row.original.approvalStep} returned={!!row.original.returnNote} short />
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Thao tác</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions>
          {row.original._actions?.includes("edit") ? (
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          ) : null}
          <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          {row.original._actions?.includes("delete") ? (
            <DeleteButton recordItemId={row.original.id} record={row.original} noun="phiếu" iconOnly size="icon-sm" />
          ) : null}
        </RowActions>
      ),
      ...ROW_ACTIONS_COLUMN,
    },
  ];

  const table = useTable<T>({
    columns: allColumns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
      filters: initialFilters ? { initial: initialFilters } : undefined,
    },
  });

  return (
    <ListView>
      {/* "Lập phiếu" chứ không "Thêm mới": việc ở đây là lập một chứng từ, không phải thêm một dòng danh mục. */}
      <ListViewHeader
        canCreate={false}
        actions={
          <CreateButton resource={resource}>
            <FilePlus2 />
            {createLabel}
          </CreateButton>
        }
      />
      <DataTable
        table={table}
        // Phiếu đã huỷ không còn tác dụng gì nên chữ nhạt đi.
        rowClassName={(row) => (row.status === "CANCELLED" ? "text-muted-foreground" : undefined)}
        toolbar={
          <ListToolbar
            table={table}
            search={<DataTableQuickFilter table={table} />}
            filters={
              <>
                <SchoolFilter table={table} />
                <OptionFilter table={table} field="status" all="Mọi trạng thái" options={VOUCHER_STATUS_OPTIONS} />
                <AwaitingMeToggle table={table} resource={resource} />
                {toolbarExtra}
              </>
            }
          />
        }
      />
    </ListView>
  );
}
