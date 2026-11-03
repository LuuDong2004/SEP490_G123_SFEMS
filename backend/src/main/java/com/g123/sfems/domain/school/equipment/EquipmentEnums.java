package com.g123.sfems.domain.school.equipment;

/**
 * Các giá trị cố định của thiết bị. Lưu bằng TÊN hằng; nhãn tiếng Việt ở frontend.
 */
public final class EquipmentEnums {

    private EquipmentEnums() {
    }

    /** Vật lý / phần mềm / hệ thống hỗ trợ học tập — quyết định nhóm LT của mã tài sản (TB/PM/HL). */
    public enum PhysicalDigitalType {
        PHYSICAL,
        DIGITAL,
        LEARNING_SUPPORT
    }

    /** Tình trạng kỹ thuật — tổ kiểm kê ghi lại, báo cáo đếm "dùng được" từ đây. */
    public enum EquipmentCondition {
        TOT,
        KHA,
        TRUNG_BINH,
        KEM,
        HONG,
        KHONG_SU_DUNG
    }

    /**
     * Trạng thái vòng đời tài sản. Chỉ đổi qua phiếu (ghi tăng, kiểm kê...) hoặc sửa hồ sơ có ghi lịch sử.
     *
     * <p>{@code IN_STOCK} và {@code IN_USE} khác nhau: hàng vừa nhập nằm trong kho, chưa giao cho phòng
     * nào; gộp hai thứ thì báo cáo "đang sử dụng" đếm cả hàng còn trong kho.
     */
    public enum AssetStatus {
        IN_STOCK,
        IN_USE,
        /** Đã báo hỏng, chờ sửa hoặc thanh lý. */
        BROKEN,
        REPAIRING,
        /** Kiểm kê không thấy, chờ quyết định ghi giảm. Chưa ra khỏi sổ. */
        MISSING,
        PENDING_LIQUIDATION,
        LIQUIDATED,
        LOST
    }
}
