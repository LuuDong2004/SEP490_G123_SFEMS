/* eslint-disable @typescript-eslint/no-explicit-any -- dòng của /api/equipment_items là bản đồ tự do từ SQL gộp. */
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { AssetCode, EquipmentCodeExplain } from "@/shared/components/asset-code";
import { useNavigation, type CrudFilter } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
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
import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";
import { EquipmentExportDialog } from "./equipment-export-dialog";
import { DEFAULT_PAGE_SIZE, formatPlainDate, quantityFormat, readableUnit } from "@/shared/lib/format";
import { ExpiryBadge, daysToExpiry } from "./expiry";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ASSET_STATUS_LABELS, EQUIPMENT_CONDITION_LABELS, OFF_BOOK_STATUSES as OFF_BOOK } from "@/domains/equipment/types";
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
 * Liệt kê CẢ hồ sơ đã ra khỏi sổ (Mất) — xếp cuối, mang đúng trạng
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
  const permanent = filters;
  const columns = useMemo(() => {
    const h = createColumnHelper<ItemRow>();
    return [
      h.display({
        id: "stt", header: "STT", size: 56, minSize: 48, enableResizing: false,
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{offset.current + row.index + 1}</span>,
      }),
      h.accessor("code", {
        // Dấu "?" đặt qua `meta.hint` (ngoài phần chữ tiêu đề): đặt trong tiêu đề thì ô chữ bị coi là tràn và bật thêm
        // một tooltip nhắc lại tên cột.
        id: "code", header: "Mã thiết bị", size: 150, enableSorting: false, meta: { hint: <EquipmentCodeExplain /> },
        cell: ({ row }) => <AssetCode code={row.original.code} />,
      }),
      h.accessor("name", {
        id: "name", header: "Thiết bị", size: 200, enableSorting: false, meta: { fill: true },
        cell: ({ row }) => <span className="block truncate font-medium">{row.original.name}</span>,
      }),
      h.accessor("serialNumber", {
        id: "serialNumber", header: "Số serial", size: 120, enableSorting: false,
        cell: ({ row }) => row.original.serialNumber
          ? <span className="font-mono text-[0.8125rem]">{row.original.serialNumber}</span> : null,
      }),
      h.accessor((r) => r.room?.name ?? "", {
        id: "room", header: "Vị trí", size: 110, enableSorting: false,
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
        meta: { exportValue: (r: ItemRow) => r.campus?.name },
        cell: ({ row }) => <CampusName campus={row.original.campus} />,
      }),
      h.accessor("quantity", {
        // Đủ chỗ cho "1.500 Gam", "9,75 kg" — 72px cắt mất đơn vị thành "200 G..." (trưởng nhóm 15/11/2026).
        id: "quantity", header: "SL", size: 108, minSize: 96, enableSorting: false,
        cell: ({ row }) => (
          <span className={cn("tabular-nums", row.original.kind === "bulk" && "font-semibold")}>
            {/* 9.750 gam hiện 9,75 kg — chỉ cách hiện, số lưu vẫn theo gam. */}
            {quantityFormat.format(row.original.quantity / readableUnit(row.original.quantity, row.original.unit).factor)}
            {row.original.unit ? <span className="text-muted-foreground font-normal"> {readableUnit(row.original.quantity, row.original.unit).unit}</span> : null}
          </span>
        ),
      }),
      h.accessor("status", {
        id: "status", header: "Trạng thái", size: 132, enableSorting: false,
        meta: { exportValue: (r: ItemRow) => ASSET_STATUS_LABELS[r.status as keyof typeof ASSET_STATUS_LABELS] ?? r.status },
        cell: ({ row }) => (
          <Badge variant={ASSET_STATUS_VARIANTS[row.original.status] ?? "neutral"}>
            {ASSET_STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      }),
      // Hạn sử dụng: chỉ lô vật tư, hoá chất có.
      h.accessor((r) => r.expiryDate ?? "", {
        id: "expiryDate", header: "Hạn sử dụng", size: 120, enableSorting: false,
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
        id: "intake", header: "Phiếu ghi tăng", size: 140, enableSorting: false,
        cell: ({ row }) =>
          row.original.intake ? (
            <CrossLink to={`/equipment-intakes/show/${row.original.intake.id}`} resource="equipment_intakes" action="list" plain title="Mở phiếu ghi tăng" className="text-primary text-xs tabular-nums">
              {row.original.intake.code ?? "Phiếu nháp"}
            </CrossLink>
          )
            : <span className="text-muted-foreground text-xs">khai đầu kỳ</span>,
      }),
      h.display({
        // Đủ rộng cho cả nhãn "Chưa chuẩn" (100 thì nhãn bị cắt).
        id: "profileComplete", header: "Hồ sơ", size: 124,
        meta: { exportValue: (r: ItemRow) => (r.profileComplete === false ? "Chưa chuẩn" : "Chuẩn") },
        cell: ({ row }) =>
          row.original.profileComplete === false ? (
              <CrossLink to={`/equipment/edit/${row.original.equipmentId}`} resource="equipment" title={`Thiếu: ${(row.original.missingProfile ?? []).join(", ")}. Mở hồ sơ để bổ sung.`}>
                <Badge variant="warning">Chưa chuẩn</Badge>
              </CrossLink>
            ) : <Badge variant="success">Chuẩn</Badge>,
      }),
      h.display({
        id: "originSource", header: "Nguồn hình thành", size: 150,
        meta: { exportValue: (r: ItemRow) => r.originSource?.name },
        cell: ({ row }) => row.original.originSource?.name ?? null,
      }),
      h.accessor((r) => r.inUseYear ?? 0, {
        id: "inUseYear", header: "Năm sử dụng", size: 116, enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.inUseYear ?? ""}</span>,
      }),
      h.display({
        id: "school", header: "Trường", size: 150,
        meta: { exportValue: (r: ItemRow) => r.school?.name },
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
            {/* Xoá chỉ có với hồ sơ đã ra khỏi sổ (kiểm kê xác nhận mất). */}
            {OFF_BOOK.includes(row.original.status) ? (
              <DeleteButton resource="equipment" recordItemId={row.original.equipmentId} record={row.original} iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
      }),
    ];
  }, []);

  // Cơ quan quản lý: Xuất Excel mở cùng hộp với Tổng hợp / Theo kho-phòng (mọi trường hay chọn trường, mỗi trường một
  // trang tính). Tài khoản của một trường thì tải thẳng.
  const [exportOpen, setExportOpen] = useState(false);
  const wide = usePerspective().perspective !== "school";
  const table = useTable<ItemRow>({
    columns: columns as any,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    // Hạn sử dụng chỉ lô vật tư, hoá chất có — mặc định ẩn, bật lại ở "Cột hiển thị" (lựa chọn được nhớ).
    getRowId: (r: ItemRow) => String(r.id),
    initialState: {
      columnPinning: { right: ["actions"] },
      columnVisibility: { expiryDate: false, serialNumber: false, originSource: false, inUseYear: false },
    },
    meta: { exportResource: "equipment_items", ...(wide ? { openExport: () => setExportOpen(true) } : {}) },
    refineCoreProps: {
      resource: "equipment_items",
      // Trang cha (bảng `equipment`, đang tắt) đã giữ URL; bảng này không ghi đè lên nó.
      syncWithLocation: false,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
      filters: { permanent },
    },
  });
  offset.current = (table.refineCore.currentPage - 1) * table.refineCore.pageSize;

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

  /**
   * Tra cứu theo mã (TS-02) gộp vào ô tìm: gõ xong bấm Enter, khớp ĐÚNG một mã thiết bị (mã chuẩn hoặc mã cũ của
   * trường) thì mở thẳng hồ sơ; không khớp thì ô tìm vẫn lọc danh sách như thường.
   */
  async function openByCode(code: string) {
    type Hit = { id: number; code: string | null; legacyCode?: string | null };
    const get = (params: Record<string, string>) => kyInstance
      .get("equipment", { searchParams: { ...params, _start: "0", _end: "5" } })
      .json<Hit[]>()
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .catch(() => [] as Hit[]);
    const [byText, byLegacy] = await Promise.all([get({ q: code }), get({ legacyCode: code })]);
    const same = (a: string | null | undefined) => (a ?? "").toLowerCase() === code.toLowerCase();
    const hit = [...byLegacy, ...byText].find((r) => same(r.code) || same(r.legacyCode));
    if (hit) show("equipment", hit.id);
  }

  /**
   * Xuất Excel dạng LUỒNG (máy chủ đọc và ghi từng khúc, trình duyệt không gom dữ liệu): cùng bộ lọc của bảng trừ lọc trường
   * (mọi trường, hoặc các trường đã chọn), đúng các cột đang hiện.
   */
  const exportStream = async (schoolIds: number[] | null) => {
    const searchParams: Record<string, string> = {};
    for (const f of table.refineCore.filters ?? []) {
      if (!("field" in f) || f.value == null || f.value === "" || f.field === "school.id" || f.field === "schoolBody") continue;
      searchParams[f.field] = String(f.value);
    }
    if (schoolIds) searchParams.schools = schoolIds.join(",");
    searchParams.cols = table.reactTable.getVisibleLeafColumns().map((c) => c.id).filter((id) => id !== "actions" && id !== "stt").join(",");
    const blob = await kyInstance.get("equipment_items/export.xlsx", { searchParams, timeout: DOWNLOAD_TIMEOUT }).blob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "Danh sách thiết bị.xlsx" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <ToolbarExtrasProvider {...extras}>
      <EquipmentExportDialog open={exportOpen} onOpenChange={setExportOpen} params={{}} filename="Danh sách thiết bị.xlsx"
        perSchoolOption={false} run={(schoolIds) => exportStream(schoolIds)} />
      <div className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <DataTable
        table={table as any}
        empty={{ title: "Chưa có thiết bị nào", ...emptyWhenFiltered(permanent, table.refineCore.filters) }}
        fill={fill || undefined}
        externallyFiltered={externallyFiltered}
        onRowDoubleClick={(r: any) => show("equipment", r.equipmentId)}
        toolbar={
          <ListToolbar
            table={table as any}
            search={<DataTableQuickFilter table={table as any} onEnter={openByCode}
              placeholder="Tìm theo mã, tên…" />}
            filters={<CampusTableFilter table={table as any} />}
            searchClassName="sm:max-w-sm"
          />
        }
      />
      </div>
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
    raw ? [...new Set(raw.split(",").map((v) => map[v] ?? v))].join(", ") : null;
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
