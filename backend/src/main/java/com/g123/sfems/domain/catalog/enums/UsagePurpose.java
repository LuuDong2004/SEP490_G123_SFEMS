package com.g123.sfems.domain.catalog.enums;

/** Mục đích sử dụng thiết bị: giảng dạy, thực hành, thí nghiệm… */
public enum UsagePurpose implements LabeledEnum {
    TEACHING("GIANG_DAY", "Giảng dạy"),
    PRACTICE("THUC_HANH", "Thực hành"),
    EXPERIMENT("THI_NGHIEM", "Thí nghiệm"),
    EVENT("SU_KIEN", "Sự kiện / hoạt động"),
    MEETING("HOI_HOP", "Hội họp"),
    OTHER("KHAC", "Khác");

    private final String code;
    private final String label;

    UsagePurpose(String code, String label) {
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
