import { AwaitingMeTag } from "@/shared/components/voucher/awaiting-me-tag";
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
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { VOUCHER_STATUS_LABELS } from "@/domains/voucher/types";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { AwaitingMeToggle } from "@/shared/components/voucher/awaiting-me-toggle";
import { PeriodSelect } from "@/shared/components/voucher/period-filter";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { DEFAULT_PAGE_SIZE, formatPlainDate } from "@/shared/lib/format";
import type { EquipmentIntake } from "@/domains/equipment-intake/types";
import { autoVisible, useColumnsKey } from "@/shared/components/data-table/column-prefs";
import { CampusesCell, CampusTableFilter } from "@/shared/components/campus/campus";
import { useCampusScope } from "@/shared/components/campus/use-campus";

// Phiếu ghi tăng duyệt xong là ghi tăng ngay trong cùng giao dịch (Chờ duyệt → Hoàn tất), không dừng ở "Đã duyệt" —
// Báo cáo 3: Nháp → Chờ duyệt → Hoàn tất, Bị từ chối, Đã huỷ.
const INTAKE_STATUSES = ["DRAFT", "PENDING", "COMPLETED", "REJECTED", "CANCELLED"] as const;
const STATUS_OPTIONS = INTAKE_STATUSES.map((value) => ({ value, label: VOUCHER_STATUS_LABELS[value] }));

const money = new Intl.NumberFormat("vi-VN");

/**
 * Danh sách phiếu nhập — cùng kiểu bảng với màn Thiết bị: cao đúng phần còn lại của cửa sổ và
 * cuộn bên trong, có STT, số phiếu chữ đơn cách; nhấp đúp một dòng mở hồ sơ phiếu.
 */
export const EquipmentIntakeList = () => {
  const { show, edit } = useNavigation();
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
        id: "code", header: "Số phiếu", size: 210, enableSorting: false,
        cell: ({ getValue, row }) => {
          const code = getValue();
          const number = code ? (
            <span className="font-mono text-[0.8125rem] font-medium tabular-nums">{code}</span>
          ) : row.original.status !== "DRAFT" ? (
            // Cùng chữ, cùng màu với mọi danh sách phiếu khác (VoucherList) — huỷ từ lúc còn nháp thì không bao giờ có số.
            <span className="text-muted-foreground text-xs">Không cấp số</span>
          ) : (
            // Phiếu nháp chưa có số — số chỉ cấp lúc duyệt, để dãy số không nhảy cách quãng.
            <span className="text-warning-text text-xs">Chưa cấp số</span>
          );
          return (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {number}
              <AwaitingMeTag voucher={row.original} />
            </span>
          );
        },
      }),
      h.accessor("intakeDate", {
        id: "intakeDate", header: "Ngày ghi tăng", size: 112, enableSorting: false,
        // Ngày ghi tăng = ngày duyệt; phiếu chưa duyệt chưa có (cùng kiểu "Chưa cấp số" của cột số phiếu).
        cell: ({ getValue, row }) => row.original.status === "COMPLETED"
          ? <span className="tabular-nums">{formatPlainDate(getValue())}</span>
          : <span className="text-muted-foreground text-xs">Chưa ghi tăng</span>,
      }),
      h.display({
        id: "supplier", header: "Nhà cung cấp / nội dung", size: 220, meta: { fill: true },
        // Phiếu lập tự động (từ đề xuất mua sắm, từ biên bản kiểm kê) chưa có nhà cung cấp — khi
        // đó nội dung phiếu là thứ phân biệt nó; hiện "—" thì mọi phiếu nháp trông như một.
        cell: ({ row }) => {
          const { note } = row.original;
          // Chứng từ đi theo dòng: nhà cung cấp của phiếu là các nhà cung cấp trên các dòng.
          // Phiếu theo hoá đơn (254): nhà cung cấp nằm ở từng hoá đơn; phiếu cũ thì ở dòng.
          const bySupplier = [...new Set([
            ...(row.original.documents ?? []).map((d) => d.supplier),
            ...(row.original.lines ?? []).map((l) => l.supplier),
          ].filter(Boolean))] as string[];
          const supplier =
            row.original.supplier ?? (bySupplier.length > 1 ? `${bySupplier[0]} +${bySupplier.length - 1}` : bySupplier[0] ?? null);
          // Một dòng chữ, không dòng phụ — hàng nào cũng cao bằng nhau; ghi chú đầy đủ khi rê chuột.
          return (
            <span
              className={supplier ? "block truncate font-medium" : "text-muted-foreground block truncate"}
              title={note ?? undefined}
            >
              {supplier ?? note ?? "Chưa khai nhà cung cấp"}
            </span>
          );
        },
      }),
      h.display({
        id: "lines", header: "Số loại thiết bị", size: 150, meta: { numeric: true },
        cell: ({ row }) => <span className="tabular-nums">{row.original.kindCount ?? row.original.lineCount}</span>,
      }),
      h.display({
        id: "received", header: "SL thực nhận", size: 150, meta: { numeric: true },
        // Một đơn vị tính: "20 cái". Nhiều đơn vị: chữ "Nhiều đơn vị tính", số từng đơn vị khi rê chuột — không hiện "—".
        cell: ({ row }) => {
          const byUnit = new Map<string, number>();
          for (const l of row.original.lines ?? []) {
            const u = l.unit?.name ?? "";
            byUnit.set(u, (byUnit.get(u) ?? 0) + Number(l.receivedQuantity ?? 0));
          }
          const parts = [...byUnit];
          if (!parts.length) return <span className="text-muted-foreground">0</span>;
          const detail = parts.map(([u, n]) => `${money.format(n)} ${u}`.trim()).join(", ");
          // Khác đơn vị tính (cái và gam) thì không cộng được thành một số: ghi chữ, số từng đơn vị khi rê chuột
          // (trưởng nhóm 15/11/2026: "hiện text … hợp lý hơn").
          if (parts.length > 1) {
            return <span className="text-muted-foreground cursor-help text-sm" title={detail}>Nhiều đơn vị tính</span>;
          }
          const [[u, n]] = parts;
          return (
            <span className="whitespace-nowrap tabular-nums" title={detail}>
              <span className="font-semibold">{money.format(n)}</span>
              {u ? <span className="text-muted-foreground ms-1 text-xs">{u.toLowerCase()}</span> : null}
            </span>
          );
        },
      }),
      h.display({
        id: "totalAmount", header: "Tổng tiền", size: 140, meta: { numeric: true },
        // Không để "—": phiếu chưa dòng nào có đơn giá (được tặng, kiểm kê thừa, chưa khai giá) ghi "Chưa có đơn giá";
        // có giá mà tổng bằng 0 thì "0 đ" (trưởng nhóm 15/11/2026).
        cell: ({ row }) => {
          const priced = (row.original.lines ?? []).some((l) => l.unitPrice != null);
          if (!priced && !row.original.totalAmount) {
            return <span className="text-muted-foreground text-sm">Chưa có đơn giá</span>;
          }
          return <span className="tabular-nums">{money.format(row.original.totalAmount ?? 0)} đ</span>;
        },
      }),
      h.accessor("status", {
        // Vừa chip "Chờ duyệt" — rộng hơn thì thành khoảng trống trước nút ⋯ (trưởng nhóm 15/11/2026).
        id: "status", header: "Trạng thái", size: 116, enableSorting: false,
        cell: ({ row }) => <VoucherStatusBadge status={row.original.status} step={row.original.approvalStep} returned={!!row.original.returnNote} short />,
      }),
      h.display({
        id: "campus", header: "Cơ sở", size: 150,
        cell: ({ row }) => <CampusesCell campuses={row.original.campuses} />,
      }),
      h.display({
        id: "school", header: "Trường", size: 160,
        cell: ({ row }) => row.original.school?.name ?? <span className="text-muted-foreground">Chưa gắn trường</span>,
      }),
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            {/* Phiếu nháp mở thẳng form sửa; phiếu đã trình thì xem chi tiết (trưởng nhóm 14/11/2026). Người không sửa được phiếu
                nháp (quản trị viên, Sở) cũng xem chi tiết. */}
            {row.original.status !== "DRAFT" || !row.original._actions?.includes("edit") ? <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" /> : null}
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
  // Cột Cơ sở: tài khoản cả trường của trường nhiều cơ sở.
  const campusScope = useCampusScope();
  useEffect(() => {
    table.reactTable.getColumn("campus")?.toggleVisibility(autoVisible(columnsKey, "campus", campusScope.show));
  }, [campusScope.show, table.reactTable, columnsKey]);

  const statusValue = (table.reactTable.getState().columnFilters as { id: string; value: unknown }[]).find((f) => f.id === "status")?.value;
  const statusFilter = statusValue != null && statusValue !== "" ? String(statusValue) : null;

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
            onRowDoubleClick={(r: EquipmentIntake) => (r.status === "DRAFT" && r._actions?.includes("edit") ? edit("equipment_intakes", r.id) : show("equipment_intakes", r.id))}
            toolbar={
              <>
                <ListToolbar
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  table={table as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  search={<DataTableQuickFilter table={table as any} />}
                  filters={
                    <>
                      {/* Chỉ một điều kiện lọc (trạng thái) nên là ô chọn ngay trên hàng công cụ, không giấu sau nút "Bộ lọc"
                          (trưởng nhóm 15/11/2026). Danh sách ghi tăng nhiều phiếu nháp (E2E-27). */}
                      <IconFilter labeled icon={null} label="trạng thái" prefix="Trạng thái" allLabel="Tất cả"
                        groups={[{ items: STATUS_OPTIONS.map((o) => ({ key: o.value, label: o.label })) }]}
                        value={statusFilter}
                        onChange={(v) => table.reactTable.setColumnFilters((prev) => {
                          const others = (prev as { id: string }[]).filter((f) => f.id !== "status");
                          return (v == null ? others : [...others, { id: "status", operator: "eq", value: v }]) as typeof prev;
                        })} />
                      {/* Lọc theo kỳ (tháng / quý / năm) của ngày phiếu. Phiếu chưa duyệt mang
                          ngày lập, phiếu đã duyệt mang ngày ghi tăng (`intakeDate`). */}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <PeriodSelect table={table as any} field="intakeDate" />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <CampusTableFilter table={table as any} />
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
