import { useMemo } from "react";
import { useTable } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DEFAULT_PAGE_SIZE, formatPlainDate } from "@/shared/lib/format";
import type { InventoryCampaign } from "@/domains/inventory/types";
import { CampaignStateBadge } from "@/features/organization/inventory-campaigns/campaign-state-badge";

/** Danh sách đợt kiểm kê (KK-01): tên, cơ quan phát động, ngày chốt, hạn nộp, tình trạng. */
export function CampaignList() {
  const columns = useMemo<ColumnDef<InventoryCampaign>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: "Đợt kiểm kê",
        meta: { fill: true },
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: "body",
        header: "Cơ quan phát động",
        size: 260,
        enableSorting: false,
        cell: ({ row }) => row.original.managingBody.name,
      },
      {
        id: "cutoffDate",
        accessorKey: "cutoffDate",
        header: "Chốt số liệu",
        size: 130,
        cell: ({ row }) => formatPlainDate(row.original.cutoffDate),
      },
      {
        id: "deadline",
        accessorKey: "deadline",
        header: "Hạn nộp",
        size: 130,
        // Đợt còn mở mà quá hạn thì tô đỏ để Sở thấy ngay.
        cell: ({ row }) => (
          <span className={row.original.overdue ? "text-destructive" : undefined}>
            {formatPlainDate(row.original.deadline)}
          </span>
        ),
      },
      {
        id: "state",
        header: "Tình trạng",
        size: 120,
        enableSorting: false,
        cell: ({ row }) => <CampaignStateBadge closed={row.original.closed} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            {row.original._can?.write ? <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" /> : null}
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {row.original._can?.delete ? (
              <DeleteButton recordItemId={row.original.id} record={row.original} noun="đợt kiểm kê" iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
      },
    ],
    [],
  );

  const table = useTable<InventoryCampaign>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: {
      resource: "inventory_campaigns",
      // Hộp thoại phát động / sửa nằm trên màn này; đường dẫn của nó không mang tham số danh sách.
      syncWithLocation: false,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    },
  });

  return (
    <ListView>
      <ListViewHeader />
      <DataTable
        table={table}
        toolbar={<ListToolbar table={table} search={<DataTableQuickFilter table={table} placeholder="Tìm theo tên đợt" />} />}
      />
    </ListView>
  );
}
