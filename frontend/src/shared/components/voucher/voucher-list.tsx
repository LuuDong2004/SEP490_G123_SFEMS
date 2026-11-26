import { useEffect, useState, type ReactNode } from "react";
import { useNavigation } from "@refinedev/core";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { DEFAULT_PAGE_SIZE, formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { useTable } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleDot, FilePlus2 } from "lucide-react";

import { CreateButton } from "@/shared/components/buttons/create";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { FilterField, FilterPopover, OptionChoices } from "@/shared/components/data-table/filter-popover";
import { SchoolFilter } from "@/shared/components/data-table/ref-filter";
import { CampusesCell, CampusTableFilter } from "@/shared/components/campus/campus";
import { useCampusScope } from "@/shared/components/campus/use-campus";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { AwaitingMeToggle } from "@/shared/components/voucher/awaiting-me-toggle";
import { AwaitingMeTag } from "@/shared/components/voucher/awaiting-me-tag";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { Checkbox } from "@/shared/ui/checkbox";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { InventoryFreezeNotice } from "@/shared/components/voucher/inventory-freeze-notice";
import { APPROVAL_STEP_LABELS, VOUCHER_STATUS_LABELS, type ApprovalStep, type VoucherBase } from "@/domains/voucher/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Trạng thái phiếu — câu hỏi đầu tiên ở một danh sách phiếu ("cái nào còn nháp", "cái nào đang chờ"). */
const STATUS_OPTIONS = Object.entries(VOUCHER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const role = (step: ApprovalStep) => APPROVAL_STEP_LABELS[step].charAt(0).toUpperCase() + APPROVAL_STEP_LABELS[step].slice(1);

/**
 * Cột "Người duyệt": VAI TRÒ duyệt, không phải tên người (tên xem ở quá trình duyệt của phiếu). Đang chờ: vai trò bước
 * đang chờ. Nháp / bị trả về: vai trò bước đầu, kèm "(khi trình)". Đã duyệt xong: vai trò bước CUỐI (người chốt). Bị từ
 * chối / đã huỷ: không còn ai duyệt.
 */
function ApproverRoleCell({ voucher, chain }: { voucher: VoucherBase; chain: ApprovalStep[] }) {
  if (voucher.status === "PENDING" && voucher.approvalStep) return <span className="font-medium">{role(voucher.approvalStep)}</span>;
  if (voucher.status === "DRAFT" && chain.length) {
    return <span>{role(chain[0])} <span className="text-muted-foreground text-xs">(khi trình)</span></span>;
  }
  if ((voucher.status === "APPROVED" || voucher.status === "COMPLETED") && chain.length) return <span>{role(chain[chain.length - 1])}</span>;
  return <span className="text-muted-foreground text-xs">Không còn chờ duyệt</span>;
}

/**
 * Màn danh sách của một loại phiếu: số phiếu, các cột riêng, trạng thái, trường,
 * thao tác. Bộ lọc luôn có số phiếu và trạng thái, cộng các ô riêng; nút "Chờ tôi
 * duyệt" hiện với người duyệt được.
 *
 * <p>Nút Sửa / Xoá trên từng dòng hiện theo {@code _actions} của server — phiếu
 * đã trình không có nút Sửa, thay vì có nút rồi trả về lỗi.
 */
export function VoucherList<T extends VoucherBase>({
  resource,
  columns,
  approvalChain,
  selection,
}: {
  resource: string;
  columns: ColumnDef<T, any>[];
  /** Các bước duyệt của loại phiếu (cố định) — có thì thêm cột "Người duyệt" sau cột trạng thái. */
  approvalChain?: ApprovalStep[];
  /**
   * Chọn nhiều phiếu để làm một việc chung (vd. đề xuất đã duyệt → lập kế hoạch): cột ô chọn đầu bảng, chỉ dòng
   * `selectable` mới có ô; `action` là nút trên hàng công cụ, nhận các id đang chọn.
   */
  selection?: {
    enabled: boolean;
    selectable: (row: T) => boolean;
    action: (ids: number[]) => ReactNode;
  };
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const selecting = !!selection?.enabled;
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Tài khoản của một trường chỉ thấy phiếu của trường mình — cột Trường lặp một tên ở mọi dòng.
  const { perspective } = usePerspective();
  const isMobile = useIsMobile();
  const { show } = useNavigation();
  // Cột nhận phần bề rộng dư: cột riêng của loại phiếu nếu nó tự khai `meta.fill`, không thì cột Trường.
  const ownFill = columns.some((c) => (c.meta as { fill?: boolean } | undefined)?.fill);
  const allColumns: ColumnDef<T, any>[] = [
    ...(selecting ? [{
      id: "select",
      size: 44,
      minSize: 44,
      enableResizing: false,
      enableSorting: false,
      header: ({ table: t }) => {
        const rows = t.getRowModel().rows.map((r) => r.original).filter((r) => selection!.selectable(r));
        const all = rows.length > 0 && rows.every((r) => selected.has(Number(r.id)));
        return (
          <Checkbox aria-label="Chọn mọi phiếu chọn được trên trang" disabled={!rows.length} checked={all}
            onCheckedChange={(v) => setSelected((prev) => {
              const next = new Set(prev);
              rows.forEach((r) => (v ? next.add(Number(r.id)) : next.delete(Number(r.id))));
              return next;
            })} />
        );
      },
      cell: ({ row }) => selection!.selectable(row.original) ? (
        <Checkbox aria-label="Chọn phiếu" checked={selected.has(Number(row.original.id))}
          onCheckedChange={() => toggle(Number(row.original.id))} onClick={(e) => e.stopPropagation()} />
      ) : null,
    } satisfies ColumnDef<T, any>] : []),
    {
      id: "code",
      accessorKey: "code",
      header: "Số phiếu",
      // Bề rộng theo nội dung: số phiếu / ngày / số đếm / trạng thái hẹp, cột tên nhận phần dư (`meta.fill`) —
      // không thì mọi cột 150px rồi giãn đều, cột ngắn thừa chỗ còn cột tên bị cắt.
      size: 210,
      enableSorting: true,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          {row.original.code ? (
            <span className="font-mono text-xs font-medium">{row.original.code}</span>
          ) : row.original.status !== "DRAFT" ? (
            // Huỷ từ lúc còn nháp: không bao giờ có số.
            <span className="text-muted-foreground text-xs">Không cấp số</span>
          ) : (
            <span className="text-warning-text text-xs">Chưa cấp số</span>
          )}
          <AwaitingMeTag voucher={row.original} />
        </span>
      ),
    },
    // Sở đọc phiếu của nhiều trường: "của trường nào" đứng ngay sau số phiếu.
    ...(perspective === "school"
      ? []
      : [{
          id: "school",
          header: "Trường",
          size: 220,
          meta: { fill: !ownFill },
          enableSorting: false,
          cell: ({ row }) => row.original.school?.name ?? <span className="text-muted-foreground">Chưa gắn trường</span>,
        } satisfies ColumnDef<T, any>]),
    ...columns,
    // Cơ sở mà phiếu chạm tới — chỉ hiện với tài khoản cả trường của trường nhiều cơ sở (bật / tắt ở dưới).
    {
      id: "campus",
      header: "Cơ sở",
      size: 150,
      enableSorting: false,
      cell: ({ row }) => <CampusesCell campuses={row.original.campuses} />,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Trạng thái",
      size: 150,
      // Lưu tên enum: sắp theo chữ cái, không theo thứ tự xử lý.
      enableSorting: false,
      cell: ({ row }) => <VoucherStatusBadge status={row.original.status} step={row.original.approvalStep} returned={!!row.original.returnNote} short />,
    },
    ...(approvalChain ? [{
      id: "approver",
      header: "Người duyệt",
      size: 190,
      enableSorting: false,
      cell: ({ row }) => <ApproverRoleCell voucher={row.original} chain={approvalChain} />,
    } satisfies ColumnDef<T, any>] : []),
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
            <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
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
    initialState: { columnPinning: { right: ["actions"] }, columnVisibility: { campus: false } },
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    },
  });
  const campusScope = useCampusScope();
  useEffect(() => {
    table.reactTable.getColumn("campus")?.toggleVisibility(campusScope.show);
  }, [campusScope.show, table.reactTable]);
  // Ô nào trong hộp "Bộ lọc" đang lọc — để tô viền xanh.
  const filterOn = (field: string) => (table.reactTable.getState().columnFilters as unknown as { id: string; value: unknown }[])
    .some((e) => e.id === field && e.value != null && e.value !== "");

  return (
    <ListView>
      {/* "Lập phiếu" chứ không "Thêm mới": việc ở đây là lập một chứng từ, không phải thêm một dòng danh mục. */}
      <ListViewHeader
        canCreate={false}
        actions={
          <CreateButton resource={resource}>
            <FilePlus2 />
            Lập phiếu
          </CreateButton>
        }
      />
      <InventoryFreezeNotice resource={resource} />
      <DataTable
        table={table}
        // Phiếu đã huỷ không còn tác dụng gì nên chữ nhạt đi; phiếu nháp nhận ra qua chữ "Chưa cấp số" ở cột đầu.
        rowClassName={(row) => (row.status === "CANCELLED" ? "text-muted-foreground" : undefined)}
        // Điện thoại: bảng rộng chỉ còn thấy hai cột đầu, phải kéo ngang mới tới trạng thái (E2E-26). Mỗi phiếu một
        // thẻ: số phiếu + trạng thái, trường, ngày lập, tài sản; bấm thẻ mở phiếu. Bộ lọc và phân trang vẫn của bảng.
        renderBody={isMobile ? (rows) => (
          <div className="divide-y">
            {rows.map((r) => (
              <button key={r.id} type="button" onClick={() => show(resource, r.id)}
                className={cn("hover:bg-muted/50 grid w-full gap-1 px-4 py-3 text-start", r.status === "CANCELLED" && "text-muted-foreground")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{r.code ?? (r.status === "DRAFT" ? "Chưa cấp số" : "Không cấp số")}</span>
                    <AwaitingMeTag voucher={r} />
                  </span>
                  <VoucherStatusBadge status={r.status} step={r.approvalStep} returned={!!r.returnNote} short />
                </span>
                <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                  {perspective === "school" ? null : <span>{r.school?.name}</span>}
                  {campusScope.show && r.campuses?.length ? <span>{r.campuses.map((c) => c.name).join(", ")}</span> : null}
                  <span>Lập {formatDateTime(r.createdAt)}</span>
                  {r.lineItems?.length ? <span className="text-foreground truncate">{r.lineItems[0].name}{(r.lineCount ?? 1) > 1 ? ` +${(r.lineCount ?? 1) - 1}` : ""}</span> : null}
                </span>
              </button>
            ))}
          </div>
        ) : undefined}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={<DataTableQuickFilter table={table} />}
              filters={
                <>
                  <SchoolFilter table={table} />
                  <CampusTableFilter table={table} />
                  {/* Ghi qua `columnFilters` (OptionChoices), không qua `refineCore.setFilters`: bộ lọc đặt thẳng vào lõi
                      bị `useTable` xoá ngay ở lần render sau — trước đây chọn trạng thái không lọc được gì. */}
                  <FilterPopover table={table} fields={["status"]}>
                    <FilterField label="Trạng thái" icon={CircleDot} active={filterOn("status")}>
                      <OptionChoices table={table} field="status" options={STATUS_OPTIONS} />
                    </FilterField>
                  </FilterPopover>
                  <AwaitingMeToggle table={table} resource={resource} />
                  {selecting ? selection!.action([...selected]) : null}
                </>
              }
            />
          </>
        }
      />
    </ListView>
  );
}
