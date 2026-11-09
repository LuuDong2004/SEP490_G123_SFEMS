import type { EnumCatalogResource } from "@/domains/enum-catalog/types";

/**
 * Danh mục cố định, chỉ đọc: giá trị nằm trong code backend (`domain/catalog/enums`) vì nghiệp vụ rẽ
 * nhánh theo từng giá trị. `resource` trùng đoạn đường dẫn `/api/enum_catalogs/{resource}`.
 */
export type EnumCatalogConfig = {
  resource: EnumCatalogResource;
  path: string;
  label: string;
};

export const ENUM_CATALOGS: EnumCatalogConfig[] = [
  { resource: "asset_categories", path: "/catalogs/asset-categories", label: "Loại tài sản" },
  { resource: "usage_purposes", path: "/catalogs/usage-purposes", label: "Mục đích sử dụng thiết bị" },
  { resource: "funding_sources", path: "/catalogs/funding-sources", label: "Nguồn kinh phí" },
  { resource: "staff_positions", path: "/catalogs/staff-positions", label: "Chức vụ" },
];
