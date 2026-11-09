import type { AssetCategory, FundingSource } from "@/domains/equipment-intake/types";

/**
 * Hồ sơ thiết bị (TS-01). Khớp với `EquipmentResponse` ở backend (`module/school/equipment`).
 */

export type PhysicalDigitalType = "PHYSICAL" | "DIGITAL" | "LEARNING_SUPPORT";

export type AssetStatus =
  | "IN_STOCK"
  | "IN_USE"
  | "BROKEN"
  | "REPAIRING"
  | "MISSING"
  | "PENDING_LIQUIDATION"
  | "LIQUIDATED"
  | "LOST";

export type EquipmentCondition = "TOT" | "KHA" | "TRUNG_BINH" | "KEM" | "HONG" | "KHONG_SU_DUNG";

/** Tham chiếu gọn: id và tên để hiển thị. */
export type EquipmentRef = { id: number; name: string };

export type Equipment = {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  active: boolean;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  school: EquipmentRef | null;
  catalog: EquipmentRef | null;
  physicalOrDigital: PhysicalDigitalType;
  assetCategory: AssetCategory | null;
  legacyCode: string | null;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  unit: EquipmentRef | null;
  quantity: number;
  originSource: EquipmentRef | null;
  acquisitionMethod: EquipmentRef | null;
  fundingSource: FundingSource | null;
  originNote: string | null;
  fundingNote: string | null;
  acquisitionNote: string | null;
  productionYear: number | null;
  usageStartYear: number | null;
  receivedDate: string | null;
  purchaseDate: string | null;
  originalValue: number | null;
  remainingValue: number | null;
  warrantyExpiry: string | null;
  room: EquipmentRef | null;
  status: AssetStatus;
  condition: EquipmentCondition | null;
  intakeLineId: number | null;
  specs: Record<string, string>;
  /** Hồ sơ còn thiếu gì — tính ở máy chủ. Rỗng là hồ sơ chuẩn. */
  missingProfile: string[];
  _can?: { write?: boolean; delete?: boolean };
};

/** Một dòng lịch sử (TS-04), mới nhất trước. */
export type EquipmentHistoryRow = {
  id: number;
  action: EquipmentHistoryAction;
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

export type EquipmentHistoryAction =
  | "GHI_TANG"
  | "CAP_NHAT"
  | "DIEU_CHUYEN"
  | "KIEM_KE"
  | "BAO_HONG"
  | "SUA_CHUA"
  | "THANH_LY"
  | "MAT";

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  IN_STOCK: "Trong kho",
  IN_USE: "Đang sử dụng",
  BROKEN: "Hỏng, chờ xử lý",
  REPAIRING: "Đang sửa chữa",
  MISSING: "Chờ ghi giảm do mất",
  PENDING_LIQUIDATION: "Chờ thanh lý",
  LIQUIDATED: "Đã thanh lý",
  LOST: "Mất",
};

export const ASSET_STATUS_OPTIONS = (Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((value) => ({
  value,
  label: ASSET_STATUS_LABELS[value],
}));

export const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  TOT: "Tốt",
  KHA: "Khá",
  TRUNG_BINH: "Trung bình",
  KEM: "Kém",
  HONG: "Hỏng",
  KHONG_SU_DUNG: "Không sử dụng được",
};

export const CONDITION_OPTIONS = (Object.keys(CONDITION_LABELS) as EquipmentCondition[]).map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

export const PHYSICAL_DIGITAL_LABELS: Record<PhysicalDigitalType, string> = {
  PHYSICAL: "Vật lý",
  DIGITAL: "Phần mềm",
  LEARNING_SUPPORT: "Hệ thống hỗ trợ học tập",
};

export const PHYSICAL_DIGITAL_OPTIONS = (Object.keys(PHYSICAL_DIGITAL_LABELS) as PhysicalDigitalType[]).map(
  (value) => ({ value, label: PHYSICAL_DIGITAL_LABELS[value] }),
);

/** Trạng thái đã ra khỏi sổ: chỉ những trạng thái này được xoá hồ sơ (khớp `EquipmentService.OFF_BOOK`). */
export const OFF_BOOK_STATUSES: AssetStatus[] = ["LIQUIDATED", "LOST"];

export const HISTORY_ACTION_LABELS: Record<EquipmentHistoryAction, string> = {
  GHI_TANG: "Ghi tăng",
  CAP_NHAT: "Cập nhật",
  DIEU_CHUYEN: "Điều chuyển",
  KIEM_KE: "Kiểm kê",
  BAO_HONG: "Báo hỏng",
  SUA_CHUA: "Sửa chữa",
  THANH_LY: "Thanh lý",
  MAT: "Mất",
};

/** Tên trường trong dòng lịch sử, theo tên trường ở backend. */
export const HISTORY_FIELD_LABELS: Record<string, string> = {
  status: "Trạng thái",
  condition: "Tình trạng",
  serialNumber: "Số serial",
  model: "Model",
  manufacturer: "Hãng sản xuất",
  legacyCode: "Mã cũ",
  originalValue: "Nguyên giá",
  warrantyExpiry: "Hết bảo hành",
};

/**
 * Một dòng của `/api/equipment/summary` — một nhóm thiết bị (hoặc một nhóm thiết bị trong một kho/phòng)
 * với số lượng tách theo trạng thái. Chỉ đếm tài sản còn trên sổ. Cột đếm rỗng là 0.
 */
export type EquipmentSummaryRow = {
  catalog_id: number;
  code: string;
  name: string;
  tracking_type: "SERIAL" | "BULK";
  minimum_required: boolean | null;
  unit: string | null;
  subject_id: number | null;
  subject: string | null;
  type_id: number | null;
  type: string | null;
  /** Chỉ có ở chế độ Theo kho/phòng; `room_id` rỗng là kho (chưa xếp phòng). */
  school_id?: number;
  school?: string;
  room_id?: number | null;
  room?: string;
  schools: number;
  total: number | null;
  /** Số HỒ SƠ thiết bị — cộng được qua các nhóm khác đơn vị tính, khác với `total` là số lượng. */
  records: number;
  usable: number | null;
  in_use: number | null;
  in_stock: number | null;
  broken: number | null;
  pending: number | null;
};

export type EquipmentSummaryResponse = {
  rows: EquipmentSummaryRow[];
  maxSchools: number;
  /** Theo kho/phòng: tổng số cặp trường × kho/phòng (phân trang ở máy chủ). */
  total?: number;
  /** Theo kho/phòng: số kho/phòng và số hồ sơ của mỗi trường, đếm trên cả danh sách. */
  schoolTotals?: { schoolId: number; school: string | null; rooms: number; records: number }[];
};
