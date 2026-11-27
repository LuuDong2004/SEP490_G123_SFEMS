/** Thiết bị của trường: nhãn các giá trị cố định (mã giữ như backend). */

export const PHYSICAL_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Thiết bị vật lý",
  DIGITAL: "Thiết bị số / phần mềm",
  LEARNING_SUPPORT: "Hệ thống hỗ trợ học tập",
};

/** Không có tình trạng hỏng: báo hỏng phải có phiếu, ngoài phạm vi đồ án (trưởng nhóm 24/11/2026). */
export const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  TOT: "Tốt",
  TRUNG_BINH: "Trung bình",
  KEM: "Kém",
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "Trong kho",
  IN_USE: "Đang sử dụng",
  LOST: "Mất",
};

/** Hồ sơ ĐÃ RA KHỎI SỔ (kiểm kê xác nhận mất): mọi con số "thiết bị của trường" đều bỏ — cùng luật với máy chủ. */
export const OFF_BOOK_STATUSES = ["LOST"];

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
/** Khoá hệ thống (312) của hình thức mua sắm "Khác" — mã hiển thị là HTM…, so khoá chứ không so mã. */
export const OTHER_ACQUISITION_KEY = "KHAC";

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
  /** Mã hình thức mua sắm không đi với nguồn này (trường tự mua: không "Mua sắm tập trung"). */
  excludedAcquisitionMethods?: string[];
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
  KIEM_KE: "Kiểm kê",
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

/** Đường dẫn màn phiếu theo tên tài nguyên — để lịch sử và thông báo mở được phiếu gốc. */
export const VOUCHER_ROUTES: Record<string, string> = {
  equipment_intakes: "/equipment-intakes",
  inventory_sessions: "/inventory-sessions",
  purchase_proposals: "/purchase-proposals",
};
