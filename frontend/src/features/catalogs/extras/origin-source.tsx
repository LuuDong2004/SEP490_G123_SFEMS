import type { CatalogConfig } from "@/features/catalogs/catalog-config";

/** Danh mục cố định sáu dòng: chỉ xem, không có nút sửa, xoá. */
export const originSourceConfig: CatalogConfig = {
  resource: "origin_sources",
  noun: "nguồn hình thành",
  description: "Thiết bị từ đâu ra. Sáu nguồn cố định, chọn ở đầu phiếu ghi tăng, không thêm hay sửa được.",
  codePlaceholder: "MUA_SAM",
  namePlaceholder: "Mua sắm",
  canModify: () => false,
};
