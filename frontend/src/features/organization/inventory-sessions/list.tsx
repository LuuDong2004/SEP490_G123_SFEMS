import { useNavigation } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { CreateButton } from "@/shared/components/buttons/create";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { SchoolFilter } from "@/shared/components/data-table/ref-filter";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { AwaitingMeToggle } from "@/shared/components/voucher/awaiting-me-toggle";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { DEFAULT_PAGE_SIZE, formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { InventorySession } from "@/domains/inventory/types";
import { CampaignStrip } from "./campaign-strip";
import { autoVisible, useColumnsKey } from "@/shared/components/data-table/column-prefs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Tiến độ kiểm đếm: thanh mảnh + "đã kiểm / tổng". Xong hết thì thanh xanh. */
function Progress({ checked, total }: { checked: number; total: number }) {
  const pct = total ? Math.round((checked / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {checked}/{total}
      </span>
    </div>
  );
}

/**
 * Danh sách phiếu kiểm kê — cùng kiểu bảng với Ghi tăng: cao vừa khung màn hình và cuộn bên trong,
 * có STT, số phiếu chữ đơn cách, tiến độ kiểm đếm dạng thanh, chênh lệch gộp một số (rê chuột xem
 * từng loại); nhấp đúp một dòng mở biên bản.
 */
export const InventorySessionList = () => {
  const { show } = useNavigation();
  const offset = useRef(0);
  const fillBox = useFillHeight();

  const columns = useMemo(() => {
    const h = createColumnHelper<InventorySession>();
    return [
      h.display({
        id: "stt", header: "STT", size: 56, minSize: 48, enableResizing: false,
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{offset.current + row.index + 1}</span>,
      }),
      h.accessor("code", {
        id: "code", header: "Số phiếu", size: 150, enableSorting: true,
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="font-mono text-[0.8125rem] font-medium tabular-nums">{getValue()}</span>
          ) : (
            <span className="text-muted-foreground text-xs italic">chưa cấp số</span>
          ),
      }),
      h.accessor("inventoryDate", {
        id: "inventoryDate", header: "Ngày kiểm kê", size: 140, enableSorting: true,
        cell: ({ getValue }) => <span className="tabular-nums">{formatPlainDate(getValue())}</span>,
      }),
      h.accessor("title", {
        id: "title", header: "Tên đợt", size: 220, meta: { fill: true },
        cell: ({ getValue }) => <span className="block truncate font-medium">{getValue()}</span>,
      }),
      h.display({
        id: "scope", header: "Phạm vi", size: 140,
        cell: ({ row }) => <span className="block truncate">{row.original.room?.name ?? "Cả trường"}</span>,
      }),
      h.display({
        id: "progress", header: "Tiến độ", size: 190,
        cell: ({ row }) => <Progress checked={row.original.summary.checked} total={row.original.summary.total} />,
      }),
      h.display({
        id: "diff", header: "Chênh lệch", size: 110,
        cell: ({ row }) => {
          const s = row.original.summary;
          const parts = [
            s.missing ? `Thiếu ${s.missing}` : null,
            s.wrongRoom ? `Sai vị trí ${s.wrongRoom}` : null,
            s.wrongCondition ? `Sai tình trạng ${s.wrongCondition}` : null,
            s.surplus ? `Thừa ${s.surplus}` : null,
          ].filter(Boolean);
          // Đếm số dòng chênh lệch theo từng loại (một dòng vừa sai vị trí vừa sai tình trạng tính ở cả hai).
          const n = s.missing + s.wrongRoom + s.wrongCondition + s.surplus;
          return n > 0 ? (
            <Badge variant="warning" title={parts.join(" · ")}>{n}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      }),
      h.accessor("status", {
        id: "status", header: "Trạng thái", size: 160, enableSorting: false,
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

  const table = useTable<InventorySession>({
    columns: columns as any,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: { syncWithLocation: true, pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });
  offset.current = (table.refineCore.currentPage - 1) * table.refineCore.pageSize;

  // Cột Trường chỉ có nghĩa với cơ quan quản lý và quản trị viên — theo TÀI KHOẢN, không theo các dòng đang
  // hiện: lọc còn một trường thì cột vẫn phải ở đó.
  const { perspective } = usePerspective();
  const many = perspective !== "school";
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
      {/* Đợt kiểm kê cấp trên đang mở nằm ngay trên danh sách phiếu — trường không cần một tab riêng cho nó. */}
      <CampaignStrip />
      <div ref={fillBox.ref} style={{ height: fillBox.height }} className="flex min-h-0 flex-col">
        <DataTable
          table={table as any}
          fill
          onRowDoubleClick={(r: InventorySession) => show("inventory_sessions", r.id)}
          toolbar={
            <>
              <ListToolbar
                table={table as any}
                search={<DataTableQuickFilter table={table as any} />}
                filters={
                  <>
                    <SchoolFilter table={table as any} />
                    <AwaitingMeToggle table={table as any} resource="inventory_sessions" />
                  </>
                }
              />
            </>
          }
        />
      </div>
    </ListView>
  );
};
