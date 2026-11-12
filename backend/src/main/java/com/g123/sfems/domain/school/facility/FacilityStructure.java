package com.g123.sfems.domain.school.facility;

/**
 * Kết cấu công trình theo mẫu CSDL HCM ("Hiện trạng" trong file mẫu của Sở). Khác {@link FacilityCondition} (chất
 * lượng): phòng kiên cố vẫn có thể xuống cấp. Biểu số liệu CSVC chia số lượng và diện tích theo bốn cột này.
 */
public enum FacilityStructure {
    KIEN_CO("Kiên cố"),
    BAN_KIEN_CO("Bán kiên cố"),
    TAM("Tạm"),
    NHO_MUON_THUE("Nhờ, mượn, thuê");

    private final String label;

    FacilityStructure(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
