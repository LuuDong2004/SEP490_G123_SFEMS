/**
 * Danh mục CỐ ĐỊNH, chỉ đọc (giá trị nằm trong code backend, `/api/enum_catalogs/{resource}`).
 * Tên resource ở đây là dữ liệu thuần — bảng quyền dùng nó (không cần mã quyền
 * riêng), còn icon và đường dẫn của menu nằm ở `features/catalogs/enum-registry.ts`.
 */
export const ENUM_CATALOG_RESOURCES = [
  "asset_categories",
  "usage_purposes",
  "funding_sources",
  "staff_positions",
] as const;
