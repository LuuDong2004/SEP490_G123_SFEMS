package com.g123.sfems.module.school.voucher;

import java.util.List;

/**
 * Hai loại chênh lệch kiểm kê cần một phiếu KHÁC để xử lý, phát ra lúc biên bản
 * được duyệt — cùng lý do và cùng cách với {@link EquipmentIncident}: biên bản
 * không sửa sổ, nó lập phiếu nháp để có người duyệt.
 */
public final class InventoryFindings {

    private InventoryFindings() {
    }

    /** Tài sản ở sai phòng so với sổ → phiếu điều chuyển nội bộ nháp, mỗi phòng một phiếu. */
    public record Misplaced(Long schoolId, List<Move> moves, Long sourceId, String sourceCode, String note) {
    }

    public record Move(Long equipmentId, Long roomId) {
    }

    /** Tài sản thừa (thấy mà sổ không có) → phiếu nhập nháp. */
    public record Surplus(Long schoolId, List<Item> items, Long sourceId, String sourceCode, String note) {
    }

    public record Item(Long catalogId, String name, int quantity, Long roomId) {
    }
}
