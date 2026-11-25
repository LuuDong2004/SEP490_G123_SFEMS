package com.g123.sfems.domain.catalog.enums;

/** Chức vụ của cán bộ trong trường. */
public enum StaffPosition implements LabeledEnum {
    HIEU_TRUONG("HIEU_TRUONG", "Hiệu trưởng"),
    PHO_HIEU_TRUONG("PHO_HIEU_TRUONG", "Phó hiệu trưởng"),
    TO_TRUONG("TO_TRUONG", "Tổ trưởng chuyên môn"),
    GIAO_VIEN("GIAO_VIEN", "Giáo viên"),
    CAN_BO_THIET_BI("CAN_BO_THIET_BI", "Cán bộ thiết bị"),
    NHAN_VIEN_THU_VIEN("NHAN_VIEN_THU_VIEN", "Nhân viên thư viện"),
    KE_TOAN("KE_TOAN", "Kế toán"),
    THU_KHO("THU_KHO", "Thủ kho"),
    VAN_THU("VAN_THU", "Văn thư"),
    NHAN_VIEN("NHAN_VIEN", "Nhân viên"),
    KHAC("KHAC", "Khác");

    private final String code;
    private final String label;

    StaffPosition(String code, String label) {
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
