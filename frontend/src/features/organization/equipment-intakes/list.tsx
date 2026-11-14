import { useNavigation } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { CircleDot, FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { CreateButton } from "@/shared/components/buttons/create";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { FilterField, FilterPopover, OptionChoices } from "@/shared/components/data-table/filter-popover";
import { VOUCHER_STATUS_LABELS } from "@/domains/voucher/types";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { AwaitingMeToggle } from "@/shared/components/voucher/awaiting-me-toggle";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { DEFAULT_PAGE_SIZE, formatPlainDate } from "@/shared/lib/format";
import type { EquipmentIntake } from "@/domains/equipment-intake/types";
import { autoVisible, useColumnsKey } from "@/shared/components/data-table/column-prefs";

const STATUS_OPTIONS = Object.entries(VOUCHER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const money = new Intl.NumberFormat("vi-VN");

/**
 * Danh sách phiếu nhập — cùng kiểu bảng với màn Thiết bị: cao đúng phần còn lại của cửa sổ và
 * cuộn bên trong, có STT, số phiếu chữ đơn cách; nhấp đúp một dòng mở hồ sơ phiếu.
 */
export const EquipmentIntakeList = () => {
  const { show } = useNavigation();
  const offset = useRef(0);
  const fillBox = useFillHeight();

  const columns = useMemo(() => {
    const h = createColumnHelper<EquipmentIntake>();
    return [
      h.display({
        id: "stt", header: "STT", size: 56, minSize: 48, enableResizing: false,
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{offset.current + row.index + 1}</span>,
      }),
      h.accessor("code", {
        id: "code", header: "Số phiếu", size: 150, enableSorting: true,
        cell: ({ getValue, row }) => {
          const code = getValue();
          return code ? (
            <span className="font-mono text-[0.8125rem] font-medium tabular-nums">{code}</span>
          ) : row.original.status !== "DRAFT" ? (
            // Cùng chữ, cùng màu với mọi danh sách phiếu khác (VoucherList) — huỷ từ lúc còn nháp thì không bao giờ có số.
            <span className="text-muted-foreground text-xs">Không cấp số</span>
          ) : (
            // Phiếu nháp chưa có số — số chỉ cấp lúc duyệt, để dãy số không nhảy cách quãng.
            <span className="text-warning-text text-xs">Chưa cấp số</span>
          );
        },
      }),
      h.accessor("intakeDate", {
        id: "intakeDate", header: "Ngày nhập", size: 112, enableSorting: true,
        cell: ({ getValue }) => <span className="tabular-nums">{formatPlainDate(getValue())}</span>,
      }),
      h.display({
        id: "supplier", header: "Nhà cung cấp / nội dung", size: 220, meta: { fill: true },
        // Phiếu lập tự động (từ đề xuất mua sắm, từ biên bản kiểm kê) chưa có nhà cung cấp — khi
        // đó nội dung phiếu là thứ phân biệt nó; hiện "—" thì mọi phiếu nháp trông như một.
        cell: ({ row }) => {
          const { note } = row.original;
          // Chứng từ đi theo dòng: nhà cung cấp của phiếu là các nhà cung cấp trên các dòng.
          const bySupplier = [...new Set((row.original.lines ?? []).map((l) => l.supplier).filter(Boolean))];
          const supplier =
            row.original.supplier ?? (bySupplier.length > 1 ? `${bySupplier[0]} +${bySupplier.length - 1}` : bySupplier[0] ?? null);
          // Một dòng chữ, không dòng phụ — hàng nào cũng cao bằng nhau; ghi chú đầy đủ khi rê chuột.
          return (
            <span
              className={supplier ? "block truncate font-medium" : "text-muted-foreground block truncate"}
              title={note ?? undefined}
            >
              {supplier ?? note ?? "—"}
            </span>
          );
        },
      }),
      h.display({
        id: "lines", header: "Số dòng", size: 96,
        cell: ({ row }) => <span className="tabular-nums">{row.original.lineCount}</span>,
      }),
      h.display({
        id: "received", header: "SL thực nhận", size: 110,
        cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.totalReceived}</span>,
      }),
      h.display({
        id: "totalAmount", header: "Tổng tiền", size: 140,
        cell: ({ row }) =>
          row.original.totalAmount ? (
            <span className="tabular-nums">{money.format(row.original.totalAmount)} đ</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      h.accessor("status", {
        id: "status", header: "Trạng thái", size: 150, enableSorting: false,
        cell: ({ row }) => <VoucherStatusBadge status={row.original.status} step={row.original.approvalStep} returned={!!row.original.returnNote} short />,
      }),
      h.display({
        id: "school", header: "Trường", size: 160,
        cell: ({ row }) => row.original.school?.name ?? "—",
      }),
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {/* Nút chỉ hiện ở nơi nó làm được việc — server nói qua `_actions`, không hiện rồi trả 422. */}
            {row.original._actions?.includes("edit") ? (
              <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            ) : null}
            {row.original._actions?.includes("delete") ? (
              <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
      }),
    ];
  }, []);

  const table = useTable<EquipmentIntake>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: columns as any,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    },
  });
  offset.current = (table.refineCore.currentPage - 1) * table.refineCore.pageSize;

  // Cột Trường chỉ có nghĩa khi tài khoản thấy nhiều trường.
  const rows = table.refineCore.tableQuery.data?.data ?? [];
  const many = new Set(rows.map((r) => r.school?.id)).size > 1;
  // Trừ khi người dùng đã tự tắt cột ở "Cột hiển thị" — lựa chọn đó được nhớ, màn không bật đè lại.
  const columnsKey = useColumnsKey(table);
  useEffect(() => {
    table.reactTable.getColumn("school")?.toggleVisibility(autoVisible(columnsKey, "school", many));
  }, [many, table.reactTable, columnsKey]);

  return (
    <ListView>
      <ListViewHeader
        canCreate={false}
        actions={
          <CreateButton>
            <FilePlus2 />
            Lập phiếu
          </CreateButton>
        }
      />
      <div ref={fillBox.ref} style={{ height: fillBox.height }} className="flex min-h-0 flex-col">
          <DataTable
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            table={table as any}
            fill
            onRowDoubleClick={(r: EquipmentIntake) => show("equipment_intakes", r.id)}
            toolbar={
              <>
                <ListToolbar
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  table={table as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  search={<DataTableQuickFilter table={table as any} />}
                  filters={
                    <>
                      {/* Lọc trạng thái như mọi danh sách phiếu khác — danh sách ghi tăng nhiều phiếu nháp (E2E-27). */}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <FilterPopover table={table as any} fields={["status"]}>
                        <FilterField label="Trạng thái" icon={CircleDot}
                          active={(table.reactTable.getState().columnFilters as { id: string; value: unknown }[]).some((f) => f.id === "status" && f.value != null && f.value !== "")}>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <OptionChoices table={table as any} field="status" options={STATUS_OPTIONS} />
                        </FilterField>
                      </FilterPopover>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <AwaitingMeToggle table={table as any} resource="equipment_intakes" />
                    </>
                  }
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              </>
            }
          />
      </div>
    </ListView>
  );
};
