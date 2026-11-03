package com.g123.sfems.domain.catalog.enums;

/**
 * Loại tài sản để hạch toán. Khai trên nhóm thiết bị (tính chất của mặt hàng) và chép xuống từng
 * tài sản lúc ghi tăng. Mã ngắn là thành phần của mã tài sản khi cần.
 */
public enum AssetCategory {
    /** Tài sản cố định. */
    FIXED_ASSET("TS", "Tài sản cố định (TSCĐ)"),
    /** Đồ dùng, dụng cụ lâu bền. */
    DURABLE_TOOL("DH", "Dụng cụ lâu bền (CCDC)"),
    SUPPLY("VT", "Vật tư"),
    CHEMICAL("HL", "Hoá chất, vật liệu");

    private final String code;
    private final String label;

    AssetCategory(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String code() {
        return code;
    }

    public String label() {
        return label;
    }
}
