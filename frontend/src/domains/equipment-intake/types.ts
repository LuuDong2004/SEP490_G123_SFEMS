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

export type Ref = { id: number; code: string | null; name: string };

export type EquipmentIntakeLine = {
  id: number;
  lineNo: number;
  catalog: Ref;
  name: string;
  trackingType: string | null;
  unit: Ref | null;
  physicalOrDigital: "PHYSICAL" | "DIGITAL";
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
  /** `null` ở danh sách: bảng chỉ cần các con số tổng. */
  lines: EquipmentIntakeLine[] | null;
  lineCount: number;
  totalReceived: number;
  totalAmount: number;
};
