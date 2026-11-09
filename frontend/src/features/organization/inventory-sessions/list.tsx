import type { ColumnDef } from "@tanstack/react-table";

import { VoucherList } from "@/shared/components/voucher/voucher-list";
import { formatPlainDate } from "@/shared/lib/format";
import type { InventorySession } from "@/domains/inventory/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLUMNS: ColumnDef<InventorySession, any>[] = [
  {
    id: "inventoryDate",
    accessorKey: "inventoryDate",
    header: "Ngày kiểm kê",
    size: 140,
    enableSorting: true,
    cell: ({ row }) => <span className="tabular-nums">{formatPlainDate(row.original.inventoryDate)}</span>,
  },
  {
    id: "title",
    accessorKey: "title",
    header: "Tên đợt",
    size: 220,
    meta: { fill: true },
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    id: "scope",
    header: "Phạm vi",
    size: 140,
    enableSorting: false,
    cell: ({ row }) => row.original.room?.name ?? "Cả trường",
  },
  {
    id: "progress",
    header: "Tiến độ",
    size: 160,
    enableSorting: false,
    cell: ({ row }) => {
      const { checked, total } = row.original.summary;
      return <span className="tabular-nums">Đã kiểm {checked}/{total}</span>;
    },
  },
];

/** Danh sách phiếu kiểm kê (KK-03). */
export const InventorySessionList = () => (
  <VoucherList<InventorySession> resource="inventory_sessions" columns={COLUMNS} createLabel="Lập phiếu kiểm kê" />
);
