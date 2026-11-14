/** Thiết bị của trường: nhãn các giá trị cố định (mã giữ như backend). */

export const PHYSICAL_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Thiết bị vật lý",
  DIGITAL: "Thiết bị số / phần mềm",
  LEARNING_SUPPORT: "Hệ thống hỗ trợ học tập",
};

export const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  TOT: "Tốt",
  TRUNG_BINH: "Trung bình",
  KEM: "Kém",
  HONG: "Hỏng",
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "Trong kho",
  IN_USE: "Đang sử dụng",
  BORROWED: "Đang cho mượn",
  BROKEN: "Hỏng, chờ xử lý",
  UNREPAIRABLE: "Hỏng, không sửa được",
  REPAIRING: "Đang sửa chữa",
  WARRANTY: "Đang bảo hành",
  MAINTAINING: "Đang bảo trì",
  TRANSFERRING: "Đang điều chuyển",
  PENDING_LIQUIDATION: "Chờ thanh lý",
  LIQUIDATED: "Đã thanh lý",
  PENDING_DESTRUCTION: "Chờ tiêu huỷ",
  DESTROYED: "Đã tiêu huỷ",
  MISSING: "Chờ ghi giảm do mất",
  LOST: "Mất",
  NOT_DELIVERED: "Thiếu khi điều chuyển",
  USED_UP: "Đã dùng hết",
};

/**
 * Trạng thái gộp thành 7 nhóm để HIỆN trên danh sách (chip): 17 trạng thái chi tiết vẫn lưu và vẫn quyết định
 * phiếu nào chọn được thiết bị nào; nhãn chi tiết hiện khi rê chuột và ở trang thiết bị.
 */
export const ASSET_STATUS_GROUP_OF: Record<string, string> = {
  IN_STOCK: "stock",
  IN_USE: "use",
  BORROWED: "moving",
  TRANSFERRING: "moving",
  REPAIRING: "repair",
  WARRANTY: "repair",
  MAINTAINING: "repair",
  BROKEN: "broken",
  UNREPAIRABLE: "broken",
  PENDING_LIQUIDATION: "leaving",
  PENDING_DESTRUCTION: "leaving",
  MISSING: "leaving",
  LIQUIDATED: "gone",
  DESTROYED: "gone",
  LOST: "gone",
  NOT_DELIVERED: "gone",
  USED_UP: "gone",
};

export const ASSET_STATUS_GROUP_LABELS: Record<string, string> = {
  stock: "Trong kho",
  use: "Đang sử dụng",
  moving: "Mượn, điều chuyển",
  repair: "Đang sửa chữa",
  broken: "Hỏng",
  leaving: "Chờ ghi giảm",
  gone: "Đã ghi giảm",
};

/**
 * Trạng thái của hồ sơ ĐÃ RA KHỎI SỔ: thanh lý / tiêu huỷ, ghi giảm do mất, vật tư đã dùng hết. Mọi
 * con số "thiết bị của trường" (cột trái, bảng tổng hợp, bảng Chi tiết, huy hiệu ở hồ sơ trường)
 * đều bỏ các hồ sơ này — cùng danh sách với `OFF_BOOK` ở máy chủ.
 */
export const OFF_BOOK_STATUSES = ["LIQUIDATED", "DESTROYED", "LOST", "USED_UP", "NOT_DELIVERED"];

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  FIXED_ASSET: "Tài sản cố định (TSCĐ)",
  DURABLE_TOOL: "Đồ dùng / Dụng cụ lâu bền (CCDC)",
  SUPPLY: "Vật tư",
  CHEMICAL: "Hóa chất / Vật liệu",
};

/**
 * Nguồn kinh phí — đúng các giá trị của `FundingSource` ở máy chủ. Năm nguồn chuẩn do nghiệp vụ chốt
 * (changelog 109); "Chưa xác định nguồn" chỉ do hệ thống ghi, không phải một lựa chọn.
 */
export const FUNDING_LABELS: Record<string, string> = {
  STATE_BUDGET: "Ngân sách",
  TUITION: "Học phí",
  REVENUE: "Nguồn thu sự nghiệp",
  DEVELOPMENT_FUND: "Quỹ phát triển sự nghiệp",
  SPONSORSHIP: "Tài trợ",
  OTHER: "Nguồn khác",
  UNDETERMINED: "Chưa xác định nguồn",
};

/** Các nguồn kinh phí người dùng chọn được, theo thứ tự hiển thị. */
export const FUNDING_OPTIONS = ["STATE_BUDGET", "TUITION", "REVENUE", "DEVELOPMENT_FUND", "SPONSORSHIP", "OTHER"];

/** Mã của hình thức mua sắm "Khác" — mục duy nhất phải ghi rõ là hình thức gì. */
export const OTHER_ACQUISITION_CODE = "KHAC";

/**
 * Luật của một NGUỒN HÌNH THÀNH (`GET /origin_sources/rules`): nguồn kinh phí nào chọn được, khi nào
 * bắt buộc, có phải ghi rõ không, có hình thức mua sắm không. Bảng luật nằm ở máy chủ (`OriginRule`) —
 * màn hình chỉ ĐỌC, không chép lại, để ô chọn và câu từ chối không lệch nhau.
 */
export type OriginRule = {
  /** Mã của dòng danh mục `origin_sources` mà luật này áp cho. */
  code: string;
  name: string;
  fundingSources: string[];
  fundingRequired: "ALWAYS" | "WHEN_COST" | "NEVER";
  noteRequired: boolean;
  acquisitionMethod: boolean;
};

/** Nguồn kinh phí này có đi với nguồn hình thành này không — cùng phép với `OriginRule.allows` ở máy chủ. */
export function fundingAllowed(rule: OriginRule | undefined, funding: unknown) {
  if (!rule || funding == null || funding === "") return true;
  return rule.fundingSources.includes(String(funding)) || (funding === "UNDETERMINED" && rule.fundingRequired !== "ALWAYS");
}

/** Dòng có đơn giá này thì có phải khai nguồn kinh phí không — cùng phép với `OriginRule.requiresFunding`. */
export function fundingRequired(rule: OriginRule | undefined, unitPrice: unknown) {
  if (!rule) return true;
  if (rule.fundingRequired === "ALWAYS") return true;
  return rule.fundingRequired === "WHEN_COST" && Number(unitPrice ?? 0) > 0;
}

/** Một dòng lịch sử tài sản (`GET /equipment/{id}/history`). */
export type EquipmentHistoryRow = {
  id: number;
  action: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  voucherResource: string | null;
  voucherId: number | null;
  voucherCode: string | null;
  note: string | null;
  actorName: string | null;
  createdAt: string;
};

export const EQUIPMENT_HISTORY_ACTION_LABELS: Record<string, string> = {
  GHI_TANG: "Ghi tăng",
  CAP_NHAT: "Cập nhật hồ sơ",
  CAP_PHAT: "Cấp phát",
  THU_HOI: "Thu hồi",
  DIEU_CHUYEN: "Điều chuyển",
  MUON: "Cho mượn",
  TRA: "Trả",
  BAO_HONG: "Báo hỏng",
  SUA_CHUA: "Sửa chữa",
  BAO_HANH: "Bảo hành",
  BAO_TRI: "Bảo trì",
  KIEM_KE: "Kiểm kê",
  CHO_THANH_LY: "Chờ thanh lý",
  THANH_LY: "Thanh lý",
  CHO_TIEU_HUY: "Chờ tiêu huỷ",
  TIEU_HUY: "Tiêu huỷ",
  MAT: "Mất",
  KHAU_HAO: "Tính hao mòn",
  LUU_KHO: "Lưu kho",
  XUAT_KHO: "Xuất kho",
  TIEU_HAO: "Tiêu hao",
  DAT_PHONG: "Dùng theo mượn phòng",
};

export const EQUIPMENT_HISTORY_FIELD_LABELS: Record<string, string> = {
  room: "Phòng",
  manager: "Người quản lý",
  status: "Trạng thái",
  condition: "Tình trạng",
  school: "Trường",
  code: "Mã thiết bị",
  remainingValue: "Giá trị còn lại",
};

/**
 * Tiêu đề một mục lịch sử đã gộp theo phiếu: nói việc của CẢ phiếu, không nói bước cuối — "Ghi giảm do mất"
 * chứ không phải "Mất", "Mượn – trả" chứ không phải "Trả". `actions` là hành động của các dòng trong mục, cũ trước.
 */
export function historyEntryTitle(actions: string[]): string {
  const has = (...codes: string[]) => codes.some((c) => actions.includes(c));
  if (has("MUON", "TRA")) return has("TRA") ? "Mượn – trả" : "Mượn – trả (đang mượn)";
  if (has("MAT")) return "Ghi giảm do mất";
  if (has("THANH_LY", "CHO_THANH_LY")) return "Thanh lý";
  if (has("TIEU_HUY", "CHO_TIEU_HUY")) return "Tiêu huỷ";
  const last = actions[actions.length - 1];
  return EQUIPMENT_HISTORY_ACTION_LABELS[last] ?? last;
}

/** Đường dẫn màn phiếu theo tên tài nguyên — để lịch sử và thông báo mở được phiếu gốc. */
export const VOUCHER_ROUTES: Record<string, string> = {
  equipment_intakes: "/equipment-intakes",
  equipment_allocations: "/equipment-allocations",
  equipment_transfers: "/equipment-transfers",
  equipment_loans: "/equipment-loans",
  damage_reports: "/damage-reports",
  inventory_sessions: "/inventory-sessions",
  disposals: "/disposals",
  purchase_proposals: "/purchase-proposals",
  repair_orders: "/repair-orders",
  warranty_claims: "/warranty-claims",
  maintenance_orders: "/maintenance-orders",
  consumption_records: "/consumption-records",
  room_bookings: "/room-bookings",
};
