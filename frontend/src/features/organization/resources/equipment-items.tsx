import { useNavigation, type CrudFilter } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Archive, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { CrossLink } from "@/shared/components/cross-link";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { ROW_ACTIONS_COLUMN, RowActions } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ToolbarExtrasProvider, useToolbarExtras } from "@/shared/components/views/list-view";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { DEFAULT_PAGE_SIZE, quantityFormat } from "@/shared/lib/format";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { ASSET_STATUS_LABELS, CONDITION_LABELS, OFF_BOOK_STATUSES, type Equipment } from "@/domains/equipment/types";

/** Hồ sơ đã ra khỏi sổ (thanh lý, mất): còn để tra, không sửa; là thứ duy nhất được xoá. */
export const offBook = (record: Pick<Equipment, "status">) => OFF_BOOK_STATUSES.includes(record.status);

/**
 * Chế độ Theo tài sản của màn Thiết bị: mỗi dòng một hồ sơ thiết bị, mang mã tài sản, vị trí, trạng thái,
 * tình trạng và hồ sơ đã chuẩn hay chưa.
 *
 * Liệt kê CẢ hồ sơ đã ra khỏi sổ (thanh lý, mất) vì lịch sử và phiếu còn trỏ tới chúng; chỉ phép ĐẾM (cột
 * trái, bảng tổng hợp) bỏ chúng. Mục "Chỉ xem thiết bị đã ra khỏi sổ" trong menu bánh răng lọc riêng chúng.
 *
 * Không xoá thẳng thiết bị đang trên sổ — ra khỏi sổ phải qua nghiệp vụ ghi giảm. Hồ sơ đã ra khỏi sổ cũng
 * không sửa nữa.
 */
export function EquipmentItems({
  filters,
  fill,
  externallyFiltered,
}: {
  filters: CrudFilter[];
  fill: boolean;
  externallyFiltered: boolean;
}) {
  const { show } = useNavigation();
  const extras = useToolbarExtras();
  const offset = useRef(0);
  const [onlyOffBook, setOnlyOffBook] = useState(false);
  const permanent = useMemo<CrudFilter[]>(
    () =>
      onlyOffBook ? [...filters, { field: "status", operator: "eq", value: OFF_BOOK_STATUSES.join(",") }] : filters,
    [filters, onlyOffBook],
  );

  const columns = useMemo(() => {
    const h = createColumnHelper<Equipment>();
    return [
      h.display({
        id: "stt",
        header: "STT",
        size: 56,
        minSize: 48,
        enableResizing: false,
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{offset.current + row.index + 1}</span>,
      }),
      h.accessor("code", {
        id: "code",
        header: "Mã tài sản",
        size: 172,
        enableSorting: true,
        cell: ({ getValue }) => <span className="font-mono text-[0.8125rem] font-medium tabular-nums">{getValue()}</span>,
      }),
      h.accessor("name", {
        id: "name",
        header: "Tên thiết bị",
        size: 240,
        enableSorting: true,
        meta: { fill: true },
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      }),
      h.accessor("serialNumber", {
        id: "serialNumber",
        header: "Số serial",
        size: 140,
        enableSorting: false,
        cell: ({ getValue }) => (getValue() ? <span className="font-mono text-[0.8125rem]">{getValue()}</span> : null),
      }),
      h.display({
        id: "room",
        header: "Vị trí",
        size: 150,
        cell: ({ row }) =>
          row.original.room ? (
            <span className="text-sm">{row.original.room.name}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Kho</span>
          ),
      }),
      h.accessor("quantity", {
        id: "quantity",
        header: "SL",
        size: 84,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {quantityFormat.format(Number(row.original.quantity ?? 0))}
            {row.original.unit ? <span className="text-muted-foreground"> {row.original.unit.name}</span> : null}
          </span>
        ),
      }),
      h.accessor("status", {
        id: "status",
        header: "Trạng thái",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => (
          <Badge variant={ASSET_STATUS_VARIANTS[getValue()] ?? "secondary"}>{ASSET_STATUS_LABELS[getValue()] ?? getValue()}</Badge>
        ),
      }),
      h.accessor("condition", {
        id: "condition",
        header: "Tình trạng",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => {
          const value = getValue();
          return value ? <span className="text-sm">{CONDITION_LABELS[value]}</span> : <span className="text-muted-foreground">—</span>;
        },
      }),
      h.display({
        id: "profile",
        header: "Hồ sơ",
        size: 100,
        cell: ({ row }) =>
          row.original.missingProfile?.length ? (
            // Hồ sơ chưa chuẩn thì phiếu nghiệp vụ không nhận — bấm để mở trang Sửa bổ sung.
            <CrossLink
              to={`/equipment/edit/${row.original.id}`}
              resource="equipment"
              title={`Thiếu: ${row.original.missingProfile.join(", ")}. Mở hồ sơ để bổ sung.`}
            >
              <Badge variant="warning">Chưa chuẩn</Badge>
            </CrossLink>
          ) : (
            <Badge variant="success">Chuẩn</Badge>
          ),
      }),
      h.display({
        id: "school",
        header: "Trường",
        size: 180,
        cell: ({ row }) => row.original.school?.name ?? "—",
      }),
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            <ShowButton resource="equipment" recordItemId={row.original.id} iconOnly size="icon-sm" />
            {offBook(row.original) ? null : (
              <EditButton resource="equipment" recordItemId={row.original.id} iconOnly size="icon-sm" />
            )}
            {offBook(row.original) ? (
              <DeleteButton resource="equipment" recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
      }),
    ];
  }, []);

  const table = useTable<Equipment>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: {
      columnPinning: { right: ["actions"] },
      // Số serial ít khi cần khi lướt — bật lại ở "Cột hiển thị".
      columnVisibility: { serialNumber: false },
    },
    refineCoreProps: {
      resource: "equipment",
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
      filters: { permanent },
    },
  });
  offset.current = (table.refineCore.currentPage - 1) * table.refineCore.pageSize;

  // Đổi bộ lọc bên trái / chip "Đang xem" thì về trang 1 — trừ lần dựng đầu, kẻo mất trang khôi phục từ URL.
  const key = JSON.stringify(permanent);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    table.refineCore.setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Cột Trường chỉ có nghĩa với tài khoản thấy nhiều trường — theo TÀI KHOẢN, không theo các dòng đang hiện.
  const { perspective } = usePerspective();
  useEffect(() => {
    table.reactTable.getColumn("school")?.toggleVisibility(perspective !== "school");
  }, [perspective, table.reactTable]);

  return (
    <ToolbarExtrasProvider
      {...extras}
      menu={
        <>
          {extras.menu}
          <DropdownMenuItem onSelect={() => setOnlyOffBook((v) => !v)}>
            <Archive />
            {onlyOffBook ? "Xem mọi thiết bị" : "Chỉ xem thiết bị đã ra khỏi sổ"}
          </DropdownMenuItem>
        </>
      }
    >
      <DataTable
        table={table}
        fill={fill}
        externallyFiltered={externallyFiltered || onlyOffBook}
        onRowDoubleClick={(r) => show("equipment", r.id)}
        toolbar={
          <ListToolbar
            table={table}
            search={<DataTableQuickFilter table={table} placeholder="Tìm theo mã hoặc tên" />}
            searchClassName="sm:max-w-sm"
            filters={
              onlyOffBook ? (
                // Đang xem một tập con thì phải thấy được — chip gỡ được ngay trên hàng công cụ.
                <Badge variant="info" className="h-8 gap-1.5 px-3 text-sm" title="Đã thanh lý hoặc mất">
                  <span className="truncate">Đang xem: đã ra khỏi sổ</span>
                  <button
                    type="button"
                    onClick={() => setOnlyOffBook(false)}
                    aria-label="Xem mọi thiết bị"
                    className="hover:text-foreground -me-1 shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </Badge>
              ) : null
            }
          />
        }
      />
    </ToolbarExtrasProvider>
  );
}
