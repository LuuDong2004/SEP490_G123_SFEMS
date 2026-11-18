/* eslint-disable @typescript-eslint/no-explicit-any -- dòng của /api/equipment_items là bản đồ tự do từ SQL gộp. */
import { ASSET_STATUS_GROUP_VARIANTS } from "@/shared/lib/status-variants";
import { AssetCode } from "@/shared/components/asset-code";
import { useNavigation, type CrudFilter } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type RowSelectionState } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { CampusName, CampusTableFilter } from "@/shared/components/campus/campus";
import { useCampusScope } from "@/shared/components/campus/use-campus";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { CrossLink } from "@/shared/components/cross-link";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { ROW_ACTIONS_COLUMN, RowActions } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ToolbarExtrasProvider, useToolbarExtras } from "@/shared/components/views/list-view";
import { DEFAULT_PAGE_SIZE, formatPlainDate, quantityFormat, readableUnit } from "@/shared/lib/format";
import { ExpiryBadge, daysToExpiry } from "./expiry";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { EquipmentRowMenu } from "./equipment-row-menu";
import { ASSET_STATUS_GROUP_LABELS, ASSET_STATUS_GROUP_OF, ASSET_STATUS_LABELS, EQUIPMENT_CONDITION_LABELS, OFF_BOOK_STATUSES as OFF_BOOK } from "@/domains/equipment/types";
import { autoVisible, useColumnsKey } from "@/shared/components/data-table/column-prefs";

type ItemRow = {
  id: number;
  /** Cách quản lý của mặt hàng: từng cái (mỗi bản ghi một cái) hay theo số lượng (một bản ghi một lô vật tư). */
  kind: "serial" | "bulk";
  equipmentId: number;
  code: string | null;
  name: string;
  catalog: { id: number; code: string; name: string };
  room: { id: number; name: string } | null;
  school: { id: number; name: string };
  /** Cơ sở thực (phòng → khối nhà → cơ sở chính). */
  campus: { id: number; name: string; primary?: boolean; branch?: boolean } | null;
  quantity: number;
  unit: string | null;
  status: string;
  inStore: boolean;
  legacyCode: string | null;
  serialNumber: string | null;
  originSource: { id: number; name: string } | null;
  /** Năm đưa vào sử dụng — trên hồ sơ, không có thì năm tiếp nhận. */
  inUseYear: number | null;
  /** Hạn sử dụng của lô vật tư, hoá chất. */
  expiryDate: string | null;
  intake: { id: number; code?: string } | null;
  profileComplete?: boolean;
  missingProfile?: string[];
  /** Thiết bị ngoài danh mục của Sở (trường tự thêm). */
  outOfCatalog?: boolean;
};


/**
 * Bảng CHI TIẾT của màn Thiết bị: mọi bản ghi thiết bị — thiết bị mỗi bản ghi một cái, vật tư tiêu hao
 * mỗi bản ghi một lô có số lượng; cùng mã chuẩn, cùng hồ sơ, cùng menu Xem / Sửa
 * trong một danh sách (`/api/equipment_items`), để "trường có những gì, ở đâu" đọc ở một chỗ
 * thay vì hai tab. Tài sản mang mã, trạng thái, hồ sơ, phiếu nhập và nút Xem / Sửa / Xoá của
 * `equipment`; lô mang số lượng và tình trạng theo chỗ để (kho → trong kho, phòng → đang
 * dùng), không có nút sửa — con số lô là hệ quả của phiếu.
 *
 * Liệt kê CẢ hồ sơ đã ra khỏi sổ (Mất, Đã thanh lý, Đã tiêu huỷ, Đã dùng hết) — xếp cuối, mang đúng trạng
 * thái — vì lịch sử và phiếu còn trỏ tới chúng; chỉ phép ĐẾM (cột trái, bảng tổng hợp) bỏ chúng. Mục
 * "Chỉ xem thiết bị đã ra khỏi sổ" trong menu lọc riêng các hồ sơ đó.
 */
export function EquipmentItems({ filters, fill, externallyFiltered }: {
  filters: CrudFilter[];
  fill: boolean;
  externallyFiltered: boolean;
}) {
  const { show } = useNavigation();
  const extras = useToolbarExtras();
  const offset = useRef(0);
  // Chuột phải một dòng: hiện cột ô tích (chọn nhiều, bấm dòng là tích) và menu nghiệp vụ tại con trỏ, áp cho mọi
  // dòng đang tích. Lựa chọn giữ qua các trang (khoá theo id); `seen` nhớ dữ liệu của dòng đã tích ở trang khác.
  const [selecting, setSelecting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const seen = useRef(new Map<string, ItemRow>());
  const permanent = filters;
  const columns = useMemo(() => {
    const h = createColumnHelper<ItemRow>();
    return [
      h.display({
        id: "select", size: 40, minSize: 40, enableResizing: false,
        header: ({ table }) => (
          <Checkbox aria-label="Chọn cả trang"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)} />
        ),
        cell: ({ row }) => (
          <Checkbox aria-label="Chọn dòng" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(v === true)} />
        ),
      }),
      h.display({
        id: "stt", header: "STT", size: 56, minSize: 48, enableResizing: false,
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{offset.current + row.index + 1}</span>,
      }),
      h.accessor("code", {
        id: "code", header: "Mã thiết bị", size: 150, enableSorting: true,
        cell: ({ row }) => <AssetCode code={row.original.code} />,
      }),
      h.accessor("name", {
        id: "name", header: "Thiết bị", size: 200, enableSorting: true, meta: { fill: true },
        cell: ({ row }) => <span className="block truncate font-medium">{row.original.name}</span>,
      }),
      h.accessor("serialNumber", {
        id: "serialNumber", header: "Số serial", size: 120, enableSorting: true,
        cell: ({ row }) => row.original.serialNumber
          ? <span className="font-mono text-[0.8125rem]">{row.original.serialNumber}</span> : null,
      }),
      h.accessor((r) => r.room?.name ?? "", {
        id: "room", header: "Vị trí", size: 110, enableSorting: true,
        cell: ({ row }) => row.original.room?.name
          ?? (row.original.kind === "bulk" ? <span className="text-muted-foreground">Kho</span> : (
            // Xếp chỗ LẦN ĐẦU làm được ngay trên form Sửa của tài sản — đã có chỗ rồi mới phải qua phiếu.
            <CrossLink to={`/equipment/edit/${row.original.equipmentId}`} resource="equipment" title="Mở hồ sơ để xếp phòng" className="text-warning-text">
              Chưa xếp phòng
            </CrossLink>
          )),
      }),
      h.display({
        id: "campus", header: "Cơ sở", size: 150,
        cell: ({ row }) => <CampusName campus={row.original.campus} />,
      }),
      h.accessor("quantity", {
        // Đủ chỗ cho "1.500 Gam", "9,75 kg" — 72px cắt mất đơn vị thành "200 G..." (trưởng nhóm 15/11/2026).
        id: "quantity", header: "SL", size: 108, minSize: 96, enableSorting: true,
        cell: ({ row }) => (
          <span className={cn("tabular-nums", row.original.kind === "bulk" && "font-semibold")}>
            {/* 9.750 gam hiện 9,75 kg — chỉ cách hiện, số lưu vẫn theo gam. */}
            {quantityFormat.format(row.original.quantity / readableUnit(row.original.quantity, row.original.unit).factor)}
            {row.original.unit ? <span className="text-muted-foreground font-normal"> {readableUnit(row.original.quantity, row.original.unit).unit}</span> : null}
          </span>
        ),
      }),
      h.accessor("status", {
        id: "status", header: "Trạng thái", size: 132, enableSorting: true,
        cell: ({ row }) => (
          // Chip hiện NHÓM (7 nhóm); trạng thái chi tiết hiện khi rê chuột.
          <Badge variant={ASSET_STATUS_GROUP_VARIANTS[ASSET_STATUS_GROUP_OF[row.original.status]] ?? "neutral"}
            title={ASSET_STATUS_LABELS[row.original.status] ?? row.original.status}>
            {ASSET_STATUS_GROUP_LABELS[ASSET_STATUS_GROUP_OF[row.original.status]] ?? ASSET_STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      }),
      // Hạn sử dụng: chỉ lô vật tư, hoá chất có.
      h.accessor((r) => r.expiryDate ?? "", {
        id: "expiryDate", header: "Hạn sử dụng", size: 120, enableSorting: true,
        // Quá hạn: chỉ nhãn "Hết hạn" (ngày xem khi rê chuột) — đọc lướt cả cột là thấy lô nào phải huỷ.
        cell: ({ row }) => !row.original.expiryDate ? null : (daysToExpiry(row.original.expiryDate) ?? 0) < 0 ? (
          <Badge variant="destructive" title={`Hết hạn ngày ${formatPlainDate(row.original.expiryDate)}`}>Hết hạn</Badge>
        ) : (
          <span className="flex flex-col items-start gap-0.5">
            <span className="tabular-nums">{formatPlainDate(row.original.expiryDate)}</span>
            <ExpiryBadge date={row.original.expiryDate} />
          </span>
        ),
      }),
      h.accessor((r) => r.intake?.code ?? "", {
        id: "intake", header: "Phiếu ghi tăng", size: 140, enableSorting: true,
        cell: ({ row }) =>
          row.original.intake ? (
            <CrossLink to={`/equipment-intakes/show/${row.original.intake.id}`} resource="equipment_intakes" action="list" plain title="Mở phiếu ghi tăng" className="text-primary text-xs tabular-nums">
              {row.original.intake.code ?? "Phiếu nháp"}
            </CrossLink>
          )
            : <span className="text-muted-foreground text-xs">khai đầu kỳ</span>,
      }),
      h.display({
        id: "profileComplete", header: "Hồ sơ", size: 100,
        cell: ({ row }) =>
          row.original.profileComplete === false ? (
              <CrossLink to={`/equipment/edit/${row.original.equipmentId}`} resource="equipment" title={`Thiếu: ${(row.original.missingProfile ?? []).join(", ")}. Mở hồ sơ để bổ sung.`}>
                <Badge variant="warning">Chưa chuẩn</Badge>
              </CrossLink>
            ) : <Badge variant="success">Chuẩn</Badge>,
      }),
      h.display({
        id: "originSource", header: "Nguồn hình thành", size: 150,
        cell: ({ row }) => row.original.originSource?.name ?? null,
      }),
      h.accessor((r) => r.inUseYear ?? 0, {
        id: "inUseYear", header: "Năm sử dụng", size: 116, enableSorting: true,
        cell: ({ row }) => <span className="tabular-nums">{row.original.inUseYear ?? ""}</span>,
      }),
      h.display({
        id: "school", header: "Trường", size: 150,
        cell: ({ row }) => row.original.school?.name ?? "—",
      }),
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            <ShowButton resource="equipment" recordItemId={row.original.equipmentId} iconOnly size="icon-sm" />
            <EditButton resource="equipment" recordItemId={row.original.equipmentId} iconOnly size="icon-sm" />
            {/* Xoá chỉ có với hồ sơ đã ra khỏi sổ: thanh lý / tiêu huỷ, ghi giảm do mất, vật tư đã dùng hết. */}
            {OFF_BOOK.includes(row.original.status) ? (
              <DeleteButton resource="equipment" recordItemId={row.original.equipmentId} record={row.original} iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
      }),
    ];
  }, []);

  const table = useTable<ItemRow>({
    columns: columns as any,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    // Hạn sử dụng chỉ lô vật tư, hoá chất có — mặc định ẩn, bật lại ở "Cột hiển thị" (lựa chọn được nhớ).
    enableRowSelection: true,
    getRowId: (r: ItemRow) => String(r.id),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    initialState: {
      columnPinning: { right: ["actions"] },
      columnVisibility: { select: false, expiryDate: false, serialNumber: false, originSource: false, inUseYear: false },
    },
    meta: { exportResource: "equipment_items" },
    refineCoreProps: {
      resource: "equipment_items",
      // Trang cha (bảng `equipment`, đang tắt) đã giữ URL; bảng này không ghi đè lên nó.
      syncWithLocation: false,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
      filters: { permanent },
    },
  });
  offset.current = (table.refineCore.currentPage - 1) * table.refineCore.pageSize;

  for (const r of table.reactTable.getRowModel().rows) seen.current.set(r.id, r.original);
  const picked = Object.keys(rowSelection).filter((k) => rowSelection[k]).flatMap((k) => seen.current.get(k) ?? []);
  useEffect(() => {
    table.reactTable.getColumn("select")?.toggleVisibility(selecting);
  }, [selecting, table.reactTable]);
  // Bỏ tích hết thì thôi chế độ chọn — cột ô tích tắt.
  useEffect(() => {
    if (selecting && !menuAt && picked.length === 0) setSelecting(false);
  }, [selecting, menuAt, picked.length]);
  const stopSelecting = () => {
    setSelecting(false);
    setRowSelection({});
    setMenuAt(null);
  };
  // Bấm ra ngoài bảng là thôi chọn — không có chip "Đã chọn" nào phải tự tắt. Bấm trong bảng (tích thêm
  // dòng) và trong menu thì giữ.
  const tableBox = useRef<HTMLDivElement>(null);
  const menuOpen = useRef(false);
  menuOpen.current = !!menuAt;
  useEffect(() => {
    if (!selecting) return;
    const away = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // Bấm trong bảng (tích thêm dòng), trong menu, hoặc chỉ để đóng menu đang mở thì GIỮ lựa chọn.
      if (tableBox.current?.contains(t) || t.closest("[role=menu]") || menuOpen.current) return;
      stopSelecting();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [selecting]);

  // Đổi bộ lọc bên trái / chip "Đang xem" thì về trang 1.
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

  // Cột Trường chỉ có nghĩa khi tài khoản thấy nhiều trường.
  // Theo TÀI KHOẢN, không theo các dòng đang hiện: Sở / UBND lọc còn một trường thì cột Trường vẫn ở đó.
  const { perspective } = usePerspective();
  const many = perspective !== "school";
  // Trừ khi người dùng đã tự tắt cột ở "Cột hiển thị" — lựa chọn đó được nhớ, màn không bật đè lại.
  const columnsKey = useColumnsKey(table);
  useEffect(() => {
    table.reactTable.getColumn("school")?.toggleVisibility(autoVisible(columnsKey, "school", many));
  }, [many, table.reactTable, columnsKey]);
  // Cột Cơ sở: chỉ khi trường có nhiều cơ sở và tài khoản chưa bị giới hạn trong một cơ sở.
  const campusScope = useCampusScope();
  useEffect(() => {
    table.reactTable.getColumn("campus")?.toggleVisibility(autoVisible(columnsKey, "campus", campusScope.show));
  }, [campusScope.show, table.reactTable, columnsKey]);

  // Thiết bị đã ra khỏi hệ thống: lọc bằng nhóm "Đã ra khỏi hệ thống" trong Bộ lọc.
  return (
    <ToolbarExtrasProvider {...extras}>
      <div ref={tableBox} className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <DataTable
        table={table as any}
        empty={{ title: "Chưa có thiết bị nào", ...emptyWhenFiltered(permanent, table.refineCore.filters) }}
        fill={fill || undefined}
        externallyFiltered={externallyFiltered}
        onRowDoubleClick={(r: any) => show("equipment", r.equipmentId)}
        rowClickSelects={selecting}
        onRowContextMenu={(_r: any, e, row) => {
          setSelecting(true);
          if (!row.getIsSelected()) row.toggleSelected(true);
          setMenuAt({ x: e.clientX, y: e.clientY });
        }}
        toolbar={
          <ListToolbar
            table={table as any}
            search={<DataTableQuickFilter table={table as any} />}
            filters={<CampusTableFilter table={table as any} />}
            searchClassName="sm:max-w-sm"
          />
        }
      />
      </div>
      <EquipmentRowMenu at={menuAt && picked.length ? menuAt : null} assets={picked} onClose={() => setMenuAt(null)} />
    </ToolbarExtrasProvider>
  );
}

/**
 * Câu báo khi bảng trống vì đang lọc: nói đúng điều kiện đang bật (từ khoá, trạng thái, tình trạng, danh mục, mục ở
 * cột trái) thay cho câu chung "không khớp bộ lọc".
 */
function emptyWhenFiltered(permanent: CrudFilter[], tableFilters: CrudFilter[] | undefined) {
  const value = (field: string) => {
    const f = [...permanent, ...(tableFilters ?? [])].find((x) => "field" in x && x.field === field);
    return f && "value" in f && f.value != null && f.value !== "" ? String(f.value) : null;
  };
  const labels = (raw: string | null, map: Record<string, string>) =>
    raw ? raw.split(",").map((v) => map[v] ?? v).join(", ") : null;
  const parts: string[] = [];
  const q = value("q");
  if (q) parts.push(`khớp "${q}"`);
  const status = labels(value("assetStatus"), ASSET_STATUS_LABELS);
  if (status) parts.push(`ở trạng thái ${status}`);
  const condition = labels(value("condition"), EQUIPMENT_CONDITION_LABELS);
  if (condition) parts.push(`có tình trạng ${condition}`);
  const scope = value("catalogScope");
  if (scope) parts.push(scope === "out" ? "ngoài danh mục" : "trong danh mục");
  if (value("catalogType") || value("catalogTree")) parts.push("thuộc loại đang chọn ở cột trái");
  if (value("subject")) parts.push("thuộc môn đang chọn ở cột trái");
  if (!parts.length) return {};
  return {
    filteredTitle: `Không có thiết bị nào ${parts.join(", ")}`,
    filteredDescription: "Bỏ bớt điều kiện ở ô tìm, Bộ lọc hoặc cột trái để xem thêm.",
  };
}
