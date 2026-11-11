import type { VoucherBase } from "@/domains/voucher/types";

/**
 * Phiếu nhập thiết bị (PN-01..03). Khớp với `EquipmentIntakeResponse` ở backend
 * (`module/school/intake`).
 */

export type FundingSource =
  | "STATE_BUDGET"
  | "TUITION"
  | "REVENUE"
  | "DEVELOPMENT_FUND"
  | "SPONSORSHIP"
  | "OTHER"
  | "UNDETERMINED";

export const FUNDING_SOURCE_LABELS: Record<FundingSource, string> = {
  STATE_BUDGET: "Ngân sách nhà nước",
  TUITION: "Học phí",
  REVENUE: "Nguồn thu sự nghiệp",
  DEVELOPMENT_FUND: "Quỹ phát triển sự nghiệp",
  SPONSORSHIP: "Tài trợ",
  OTHER: "Nguồn hợp pháp khác",
  UNDETERMINED: "Chưa xác định nguồn",
};

export const FUNDING_SOURCE_OPTIONS = (Object.keys(FUNDING_SOURCE_LABELS) as FundingSource[]).map((value) => ({
  value,
  label: FUNDING_SOURCE_LABELS[value],
}));

export type AssetCategory = "FIXED_ASSET" | "DURABLE_TOOL" | "SUPPLY" | "CHEMICAL";

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  FIXED_ASSET: "Tài sản cố định",
  DURABLE_TOOL: "Dụng cụ lâu bền",
  SUPPLY: "Vật tư",
  CHEMICAL: "Hoá chất, vật liệu",
};

export const ASSET_CATEGORY_OPTIONS = (Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[]).map((value) => ({
  value,
  label: ASSET_CATEGORY_LABELS[value],
}));

/** Kết quả kiểm tra hàng lúc giao nhận (biên bản giao nhận). */
export type InspectionResult = "PASSED" | "PARTIAL" | "FAILED";

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  PASSED: "Đạt",
  PARTIAL: "Đạt một phần",
  FAILED: "Không đạt",
};

export const INSPECTION_RESULT_OPTIONS = (Object.keys(INSPECTION_RESULT_LABELS) as InspectionResult[]).map((value) => ({
  value,
  label: INSPECTION_RESULT_LABELS[value],
}));

/**
 * Cách quản lý của mặt hàng, quyết định một dòng phiếu sẽ sinh ra cái gì. Máy chủ gửi tên hằng (chữ hoa).
 */
export type TrackingType = "SERIAL" | "BULK";

export type Ref = { id: number; code: string | null; name: string };

export const TRACKING_LABELS: Record<string, string> = {
  SERIAL: "Theo từng cái",
  BULK: "Theo số lượng",
};

/** Một dòng phiếu sẽ sinh ra gì khi xác nhận — câu để hiện trên màn hình. */
export function intakeLineOutcome(trackingType: string | null | undefined, quantity: number, unitName?: string): string {
  if (quantity <= 0) return "Không ghi tăng (không nhận được cái nào)";
  return trackingType === "BULK"
    ? `Ghi tăng 1 lô vật tư, số lượng ${quantity.toLocaleString("vi-VN")}${unitName ? ` ${unitName}` : ""}, chung một mã`
    : `Ghi tăng ${quantity} tài sản, mỗi cái một mã`;
}

export type IntakeLine = {
  id: number | null;
  lineNo: number;
  catalog: { id: number; code: string | null; name: string } | null;
  name: string;
  trackingType: TrackingType | null;
  unit: { id: number; code: string | null; name: string } | null;
  physicalOrDigital: string;
  assetCategory: string | null;
  documentQuantity: number;
  receivedQuantity: number;
  varianceReason: string | null;
  unitPrice: number | null;
  amount: number | null;
  room: { id: number; code: string | null; name: string } | null;
  generatedCount: number;
  /** Khai riêng của dòng — null = theo đầu phiếu. */
  supplier: string | null;
  documentNo: string | null;
  documentDate: string | null;
  fundingSource: string | null;
  /** Ghi rõ khi nguồn kinh phí là "Nguồn hợp pháp khác". */
  fundingNote: string | null;
  /** Ghi rõ khi hình thức mua sắm là "Khác". */
  acquisitionNote?: string | null;
  acquisitionMethod: { id: number; code?: string | null; name: string } | null;
  warrantyMonths: number | null;
  /** Model và hãng của LÔ hàng này — khác nhau giữa các lần mua, khai ở dòng. */
  model: string | null;
  manufacturer: string | null;
  /** Hạn sử dụng của lô vật tư tiêu hao, hoá chất; dòng thiết bị từng cái luôn null. */
  expiryDate: string | null;
  /**
   * Quy cách bao bì của vật tư, hoá chất: 1 `packUnit` = `packSize` đơn vị của thiết bị. Có quy cách thì số lượng
   * của dòng đếm theo bao bì, đơn giá là giá một bao bì, và lô vào sổ mang `stockQuantity` đã quy đổi.
   */
  packUnit: { id: number; code?: string | null; name: string } | null;
  packSize: number | null;
  stockQuantity: number | null;
  note?: string | null;
  movementReason?: Ref | null;
};

/** Số lượng vào sổ của một dòng: số nhận × quy cách, hoặc số nhận khi không quy đổi. */
export function stockQuantityOf(received: number, packSize: number | null | undefined): number {
  return packSize ? Math.round(received * Number(packSize) * 1000) / 1000 : received;
}

/** Phiếu nghiệp vụ đã sinh ra phiếu ghi tăng (đề xuất mua sắm, biên bản kiểm kê). */
export type IntakeSource = { resource: string; id: number | null; code: string | null };

export type EquipmentIntake = VoucherBase & {
  intakeDate: string;
  documentNo: string | null;
  documentDate: string | null;
  supplier: string | null;
  fundingSource: string | null;
  /** Nguồn hình thành của CẢ PHIẾU — quyết định nguồn kinh phí nào chọn được ở từng dòng. */
  originSource: { id: number; code?: string | null; name: string } | null;
  originNote: string | null;
  /** Năm học của lần ghi tăng. */
  schoolYear: { id: number; code?: string | null; name: string } | null;
  /** null = phiếu lập tay. */
  source: IntakeSource | null;
  acquisitionMethod: { id: number; code?: string | null; name: string } | null;
  warrantyMonths: number | null;
  /** Biên bản giao nhận (người giao, đại diện bên giao, người nhận, chức vụ, kết quả kiểm tra, số biên bản). */
  details?: Record<string, unknown> | null;
  deliverer?: string | null;
  delivererRepresentative?: string | null;
  receiver?: string | null;
  receiverPosition?: string | null;
  storekeeper?: string | null;
  inspectionResult?: InspectionResult | null;
  handoverNo?: string | null;
  /** Lúc lãnh đạo trường duyệt — cũng là lúc ghi tăng. */
  confirmedAt: string | null;
  lines: IntakeLine[];
  lineCount: number;
  totalReceived: number;
  totalAmount: number | null;
  /** Số hồ sơ tài sản sẽ sinh khi duyệt. */
  expectedAssets?: number;
  generatedCount: number;
  createdAt: string;
  updatedAt: string | null;
  /** Người lập phiếu — `code` tên đăng nhập, `name` họ tên. */
  createdBy: { id: number; code: string | null; name: string } | null;
  _can?: Record<string, boolean>;
};

/** Một tài sản phiếu đã sinh (`GET /equipment_intakes/{id}/assets`). */
export type WrittenUpAsset = {
  id: number;
  lineNo: number;
  code: string;
  name: string;
  quantity: number;
  room: string | null;
  status: string;
};
