package com.g123.sfems.domain.catalog.equipmentcatalog;

/**
 * Nguồn gốc của một nhóm thiết bị NGOÀI danh mục của Sở — bắt buộc khi nhóm thuộc riêng một trường
 * ({@link EquipmentCatalog#getOwnerSchool()}). Báo cáo dùng nó để tách đồ tự làm / được tài trợ / mua
 * ngoài danh mục khỏi phần còn lại.
 */
public enum CatalogOrigin {
    /** Giáo viên, học sinh tự làm. */
    SELF_MADE,
    /** Được tặng, tài trợ. */
    DONATED,
    /** Mua sắm nhưng không có trong danh mục của Sở. */
    OUTSIDE_PURCHASE
}
