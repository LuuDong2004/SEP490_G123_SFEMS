package com.g123.sfems.domain.school.equipment;

/**
 * Các giá trị cố định của thiết bị. Mã giữ nguyên TÊN hằng như bản Jmix để dữ
 * liệu chuyển sang không phải đổi; nhãn tiếng Việt ở frontend.
 */
public final class EquipmentEnums {

    private EquipmentEnums() {
    }

    /** Vật lý / số / hệ thống hỗ trợ học tập — quyết định nhóm LT của mã (TB/PM/HL). */
    public enum PhysicalDigitalType {
        PHYSICAL,
        DIGITAL,
        LEARNING_SUPPORT
    }

    /** Tình trạng kỹ thuật. */
    public enum EquipmentCondition {
        TOT,
        TRUNG_BINH,
        KEM
    }

    /**
     * Trạng thái của thiết bị. {@code IN_STOCK}: ghi tăng hoặc khai về kho. {@code IN_USE}: ghi tăng hoặc khai thẳng vào
     * phòng. {@code LOST} chỉ duyệt kiểm kê (KK-06) đặt, là ra khỏi sổ. Không có trạng thái hỏng: báo hỏng phải có
     * phiếu, ngoài phạm vi đồ án.
     */
    public enum AssetStatus {
        IN_STOCK,
        IN_USE,
        LOST
    }
}
