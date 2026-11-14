package com.g123.sfems.domain.catalog.equipmentcatalog;

/**
 * Nguồn gốc của một thiết bị NGOÀI danh mục của Sở — bắt buộc khi thiết bị thuộc riêng một trường.
 * Báo cáo dùng nó để tách đồ tự làm / được tài trợ / mua ngoài danh mục khỏi phần còn lại.
 */
public enum CatalogOrigin {
    /** Giáo viên, học sinh tự làm. */
    SELF_MADE,
    /** Được tặng, tài trợ. */
    DONATED,
    /** Mua sắm nhưng không có trong danh mục của Sở. */
    OUTSIDE_PURCHASE
}
