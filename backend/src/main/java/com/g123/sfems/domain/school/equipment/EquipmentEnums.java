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
        KEM,
        HONG
    }

    /**
     * Trạng thái vòng đời tài sản. Các phiếu nghiệp vụ sẽ chuyển trạng thái này.
     *
     * <p>{@code IN_STOCK} và {@code IN_USE} là hai trạng thái khác nhau của
     * trục "vị trí &amp; người giữ" (xem {@code docs/nghiep-vu/luong-thiet-bi.drawio},
     * trang 4): hàng vừa nhập nằm trong kho, chưa giao cho ai, và chỉ thành
     * "đang sử dụng" khi có phiếu cấp phát. Gộp hai thứ đó lại thì mọi báo cáo
     * thiết bị đang dùng đều đếm cả hàng còn nằm trong kho.
     */
    public enum AssetStatus {
        IN_STOCK,
        IN_USE,
        /** Đang cho mượn — phiếu mượn đã ghi, chưa trả. */
        BORROWED,
        /** Đã báo hỏng, đang chờ phiếu sửa chữa hoặc bảo hành xử lý. */
        BROKEN,
        REPAIRING,
        /** Phiếu sửa chữa đã kết luận không sửa được; đủ điều kiện đề nghị thanh lý hoặc tiêu huỷ. */
        UNREPAIRABLE,
        WARRANTY,
        /**
         * Đang bảo dưỡng theo một phiếu bảo dưỡng đã trình, chưa ghi kết quả. Tài sản KHÔNG hỏng — vẫn tính là
         * dùng được khi xét đủ / thiếu — nhưng tạm không vào được phiếu cấp phát, điều chuyển, cho mượn.
         */
        MAINTAINING,
        /** Chờ ghi giảm do mất: đề nghị ghi giảm do mất đã trình, chờ quyết định. Chưa ra khỏi sổ (142 — trước đó là "Báo mất"). */
        MISSING,
        TRANSFERRING,
        PENDING_LIQUIDATION,
        LIQUIDATED,
        PENDING_DESTRUCTION,
        DESTROYED,
        LOST,
        /**
         * Thiếu khi điều chuyển: trường chuyển đã ghi giảm, trường nhận kiểm nhận không thấy nên chưa ghi tăng. Ra khỏi
         * sổ cả hai trường; tìm thấy hay ghi giảm do mất là quyết định ngoài, lập phiếu khác.
         */
        NOT_DELIVERED,
        /** Vật tư tiêu hao đã dùng hết số lượng (xuất kho / ghi tiêu hao về 0). Ra khỏi sổ. */
        USED_UP
    }
}
