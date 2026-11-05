import type { ColumnDef } from "@tanstack/react-table";

import { VoucherList } from "@/shared/components/voucher/voucher-list";
import { EMPTY, formatDate } from "@/shared/lib/format";
import { formatVnd } from "@/features/organization/equipment-intakes/money";
import type { EquipmentIntake } from "@/domains/equipment-intake/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLUMNS: ColumnDef<EquipmentIntake, any>[] = [
  {
    id: "intakeDate",
    accessorKey: "intakeDate",
    header: "Ngày nhập",
    enableSorting: true,
    cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.intakeDate)}</span>,
  },
  {
    id: "supplier",
    accessorKey: "supplier",
    header: "Nhà cung cấp",
    enableSorting: true,
    enableResizing: true,
    cell: ({ row }) => row.original.supplier ?? <span className="text-muted-foreground">{EMPTY}</span>,
  },
  {
    id: "lineCount",
    header: "Số dòng",
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{row.original.lineCount}</span>,
  },
  {
    id: "totalReceived",
    header: "Số lượng nhận",
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{row.original.totalReceived}</span>,
  },
  {
    id: "totalAmount",
    header: "Tổng tiền",
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.totalAmount)}</span>,
  },
];

/** Danh sách phiếu nhập thiết bị (PN-01). */
export const EquipmentIntakeList = () => (
  <VoucherList<EquipmentIntake> resource="equipment_intakes" columns={COLUMNS} createLabel="Lập phiếu nhập" />
);
