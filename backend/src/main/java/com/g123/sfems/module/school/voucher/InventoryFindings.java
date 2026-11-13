package com.g123.sfems.module.school.voucher;

import java.util.List;

/**
 * Chênh lệch kiểm kê cần một phiếu KHÁC để xử lý (KK-06). Biên bản không sửa sổ: người dùng bấm lập nhanh, biên
 * bản phát sự kiện này, loại phiếu nhận sự kiện lập một phiếu NHÁP — vẫn phải có người duyệt như phiếu lập tay.
 */
public final class InventoryFindings {

    private InventoryFindings() {
    }

    /** Tài sản thừa (thấy mà sổ không có) → một phiếu nhập nháp, nguồn hình thành "Kiểm kê thừa". */
    public record Surplus(Long schoolId, List<Item> items, Long sourceId, String sourceCode) {
    }

    /** Một dòng tài sản thừa: thiết bị trong danh mục, tên thực tế, số lượng, phòng thấy (có thể trống). */
    public record Item(Long catalogId, String name, int quantity, Long roomId) {
    }
}
