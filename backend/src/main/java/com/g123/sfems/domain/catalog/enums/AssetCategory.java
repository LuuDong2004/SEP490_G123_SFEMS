package com.g123.sfems.domain.catalog.enums;

/** Loại tài sản — quyết định cách hạch toán và theo dõi thiết bị. */
public enum AssetCategory implements LabeledEnum {
    FIXED_ASSET("TS", "Tài sản cố định (TSCĐ)"),
    DURABLE_TOOL("DH", "Đồ dùng / Dụng cụ lâu bền (CCDC)"),
    SUPPLY("VT", "Vật tư"),
    CHEMICAL("HL", "Hóa chất / Vật liệu");

    private final String code;
    private final String label;

    AssetCategory(String code, String label) {
        this.code = code;
        this.label = label;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public String label() {
        return label;
    }
}
