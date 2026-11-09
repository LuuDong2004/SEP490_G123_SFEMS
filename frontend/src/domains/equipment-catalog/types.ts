import type { CatalogItem, CatalogRef } from "@/domains/catalog/types";

/** Một loại thiết bị dùng chung; tài sản của trường tham chiếu đến loại này. */
export type EquipmentCatalog = CatalogItem & {
  teachingCode: string | null;
  parent: CatalogRef | null;
  equipmentType: CatalogRef | null;
  /** Môn chính — vào mã tài sản. */
  subject: CatalogRef | null;
  /** Mọi môn của thiết bị, môn chính đứng đầu. */
  subjects: CatalogRef[];
  educationLevel: CatalogRef | null;
  grade: CatalogRef | null;
  /** Mọi khối của thiết bị, khối chính đứng đầu. */
  grades: CatalogRef[];
  unit: CatalogRef | null;
  model: string | null;
  manufacturer: string | null;
  trackingType: "SERIAL" | "BULK";
  assetCategory: "FIXED_ASSET" | "DURABLE_TOOL" | "SUPPLY" | "CHEMICAL" | null;
  physicalOrDigital: "PHYSICAL" | "DIGITAL" | "LEARNING_SUPPORT" | null;
  depreciationMethod: "straight_line" | "declining_balance" | "units_of_output" | null;
  usefulLifeYears: number | null;
  minimumRequired: boolean;
  statisticalCode: string | null;
  legalBasis: string | null;
  description: string | null;
  usedByTeacher: boolean;
  usedByStudent: boolean;
  /** Giáo viên tự chế tạo. */
  selfMade: boolean;
  /** Trường sở hữu thiết bị ngoài danh mục; null là danh mục của Sở. */
  ownerSchool: CatalogRef | null;
  origin: "SELF_MADE" | "DONATED" | "OUTSIDE_PURCHASE" | null;
};

export const TRACKING_LABELS = {
  SERIAL: "Từng cái, mỗi cái một mã",
  BULK: "Theo số lượng, chỉ cho vật tư tiêu hao",
} as const;

export const ASSET_CATEGORY_LABELS = {
  FIXED_ASSET: "Tài sản cố định (TSCĐ)",
  DURABLE_TOOL: "Đồ dùng / Dụng cụ lâu bền (CCDC)",
  SUPPLY: "Vật tư",
  CHEMICAL: "Hóa chất / Vật liệu",
} as const;

export const PHYSICAL_LABELS = {
  PHYSICAL: "Thiết bị vật lý",
  DIGITAL: "Thiết bị số / phần mềm",
  LEARNING_SUPPORT: "Hệ thống hỗ trợ học tập",
} as const;

/** Nguồn gốc của thiết bị NGOÀI danh mục của Sở (thiết bị riêng của một trường). */
export const CATALOG_ORIGIN_LABELS = {
  SELF_MADE: "Tự làm",
  DONATED: "Được tài trợ, tặng",
  OUTSIDE_PURCHASE: "Mua ngoài danh mục",
} as const;
