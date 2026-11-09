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

export type TrackingType = "SERIAL" | "BULK";

export type Ref = { id: number; code: string | null; name: string };

export type EquipmentIntakeLine = {
  id: number;
  lineNo: number;
  catalog: Ref;
  name: string;
  trackingType: TrackingType | null;
  unit: Ref | null;
  physicalOrDigital: "PHYSICAL" | "DIGITAL" | "LEARNING_SUPPORT";
  assetCategory: AssetCategory | null;
  documentQuantity: number;
  receivedQuantity: number;
  varianceReason: string | null;
  unitPrice: number | null;
  amount: number | null;
  room: Ref | null;
  generatedCount: number;
  supplier: string | null;
  documentNo: string | null;
  documentDate: string | null;
  fundingSource: FundingSource | null;
  fundingNote: string | null;
  acquisitionMethod: Ref | null;
  acquisitionNote: string | null;
  warrantyMonths: number | null;
  model: string | null;
  manufacturer: string | null;
  note: string | null;
  movementReason: Ref | null;
};

export type EquipmentIntake = VoucherBase & {
  intakeDate: string;
  documentNo: string | null;
  documentDate: string | null;
  supplier: string | null;
  fundingSource: FundingSource | null;
  originSource: Ref | null;
  originNote: string | null;
  acquisitionMethod: Ref | null;
  schoolYear: Ref | null;
  warrantyMonths: number | null;
  deliverer: string | null;
  delivererRepresentative: string | null;
  receiver: string | null;
  receiverPosition: string | null;
  storekeeper: string | null;
  inspectionResult: InspectionResult | null;
  handoverNo: string | null;
  /** `null` ở danh sách: bảng chỉ cần các con số tổng. */
  lines: EquipmentIntakeLine[] | null;
  lineCount: number;
  totalReceived: number;
  totalAmount: number;
  /** Số hồ sơ tài sản sẽ sinh khi duyệt. */
  expectedAssets: number;
  /** Số hồ sơ đã sinh (phiếu hoàn tất). */
  generatedCount: number;
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

/** Số hồ sơ một dòng sinh khi duyệt — cùng phép với `EquipmentIntakeResponse.expectedAssets` ở máy chủ. */
export function expectedAssets(trackingType: TrackingType | null | undefined, received: number): number {
  if (!received || received <= 0) return 0;
  return trackingType === "BULK" ? 1 : received;
}

/** Câu "khi duyệt sẽ sinh gì" của một dòng. */
export function lineOutcome(trackingType: TrackingType | null | undefined, received: number, unitName?: string | null): string {
  if (!received || received <= 0) return "Không ghi tăng (không nhận được cái nào)";
  return trackingType === "BULK"
    ? `Ghi tăng 1 hồ sơ theo lô, số lượng ${received.toLocaleString("vi-VN")}${unitName ? ` ${unitName}` : ""}, chung một mã`
    : `Ghi tăng ${received.toLocaleString("vi-VN")} hồ sơ tài sản, mỗi cái một mã`;
}

/** Thông tin danh mục của một dòng mà luật trình cần (cách quản lý, đơn vị tính). */
export type LineCatalogInfo = { trackingType?: TrackingType | null; unit?: { id: number } | null };

type LineValues = {
  catalog?: { id?: number | null } | null;
  documentQuantity?: number | string | null;
  receivedQuantity?: number | string | null;
  varianceReason?: string | null;
  unitPrice?: number | null;
  fundingSource?: string | null;
  movementReason?: { id?: number | null } | null;
};

const filled = (v: unknown) => v != null && v !== "";
const num = (v: unknown) => (v === "" || v == null ? 0 : Number(v));

/**
 * Những gì MỘT dòng còn thiếu trước khi trình — cùng luật với `validateLineForSubmit` ở máy chủ (GBR-09).
 * Bảng dòng hiện số mục thiếu ở cột "Đủ"; hộp chi tiết dòng liệt kê ra.
 */
export function lineIssues(line: LineValues, info: LineCatalogInfo | undefined, headFunding?: string | null): string[] {
  if (!line.catalog?.id) return ["Chưa chọn thiết bị"];
  const out: string[] = [];
  if (!line.movementReason?.id) out.push("Chưa chọn lý do tăng");
  if (num(line.documentQuantity) !== num(line.receivedQuantity) && !filled(line.varianceReason?.trim())) {
    out.push("Lệch số lượng, chưa ghi lý do");
  }
  if (num(line.receivedQuantity) > 0) {
    if (info && !info.unit) out.push("Thiết bị chưa có đơn vị tính (sửa ở danh mục)");
    if (info?.trackingType !== "BULK") {
      if (line.unitPrice == null) out.push("Chưa có đơn giá");
      if (!filled(line.fundingSource) && !filled(headFunding)) out.push("Chưa có nguồn kinh phí");
    }
  }
  return out;
}
