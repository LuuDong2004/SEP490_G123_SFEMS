package com.g123.sfems.module.school.voucher;

import java.util.List;

/**
 * Chênh lệch kiểm kê cần một phiếu KHÁC để xử lý, phát ra lúc biên bản được
 * duyệt: biên bản không sửa sổ, nó lập phiếu nháp để có người duyệt. Thiết bị
 * thừa → phiếu ghi tăng nháp.
 */
public final class InventoryFindings {

    private InventoryFindings() {
    }

    /** Tài sản thừa (thấy mà sổ không có) → phiếu nhập nháp. */
    public record Surplus(Long schoolId, List<Item> items, Long sourceId, String sourceCode, String note) {
    }

    public record Item(Long catalogId, String name, int quantity, Long roomId) {
    }
}
