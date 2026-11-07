import type { CatalogItem, CatalogRef } from "@/domains/catalog/types";

/** Một loại thiết bị dùng chung; tài sản của trường tham chiếu đến loại này. */
export type EquipmentCatalog = CatalogItem & {
  teachingCode: string | null;
  parent: CatalogRef | null;
  equipmentType: CatalogRef | null;
  subject: CatalogRef | null;
  educationLevel: CatalogRef | null;
  grade: CatalogRef | null;
  unit: CatalogRef | null;
  model: string | null;
  manufacturer: string | null;
  trackingType: "SERIAL" | "BULK";
  assetCategory: "FIXED_ASSET" | "DURABLE_TOOL" | "SUPPLY" | "CHEMICAL" | null;
  physicalOrDigital: "PHYSICAL" | "DIGITAL" | "LEARNING_SUPPORT" | null;
  usefulLifeYears: number | null;
  minimumRequired: boolean;
  statisticalCode: string | null;
  legalBasis: string | null;
  description: string | null;
  usedByTeacher: boolean;
  usedByStudent: boolean;
  ownerSchool: CatalogRef | null;
  origin: string | null;
};

export const TRACKING_LABELS = { SERIAL: "Từng cái", BULK: "Theo số lượng" } as const;
export const ASSET_CATEGORY_LABELS = {
  FIXED_ASSET: "Tài sản cố định",
  DURABLE_TOOL: "Dụng cụ lâu bền",
  SUPPLY: "Vật tư",
  CHEMICAL: "Hoá chất, vật liệu",
} as const;
export const PHYSICAL_LABELS = {
  PHYSICAL: "Thiết bị vật lý",
  DIGITAL: "Phần mềm, học liệu số",
  LEARNING_SUPPORT: "Hệ thống hỗ trợ học tập",
} as const;
