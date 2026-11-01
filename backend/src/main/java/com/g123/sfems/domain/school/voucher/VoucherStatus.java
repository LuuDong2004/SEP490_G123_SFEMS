package com.g123.sfems.domain.school.voucher;

/**
 * Vòng đời của MỌI loại phiếu (đề xuất mua sắm, phiếu nhập thiết bị, phiếu kiểm kê). Một vốn từ cho
 * mọi loại phiếu, để màn danh sách, bộ lọc và báo cáo nói cùng một thứ tiếng.
 *
 * <pre>
 *   DRAFT ──trình──► PENDING ──duyệt đủ các bước──► APPROVED ──thực hiện──► COMPLETED
 *     ▲                 │
 *     └───trả lại───────┤
 *                       └──từ chối──► REJECTED
 *   DRAFT ──huỷ──► CANCELLED
 * </pre>
 *
 * <p>{@code APPROVED} và {@code COMPLETED} là hai trạng thái khác nhau vì có phiếu được duyệt rồi
 * mới làm. Phiếu nào duyệt xong là xong ngay (phiếu nhập: duyệt = ghi tăng) thì service của nó gọi
 * {@code complete} ngay trong cùng giao dịch.
 *
 * <p>{@code REJECTED} và {@code CANCELLED} là hai lối ra khác nhau có chủ đích: từ chối là quyết định
 * của người duyệt, huỷ là người lập tự bỏ phiếu nháp.
 */
public enum VoucherStatus {
    DRAFT,
    PENDING,
    APPROVED,
    COMPLETED,
    REJECTED,
    CANCELLED;

    /** Trạng thái cuối: phiếu không đổi được nữa. */
    public boolean isFinal() {
        return this == COMPLETED || this == REJECTED || this == CANCELLED;
    }

    public String label() {
        return switch (this) {
            case DRAFT -> "nháp";
            case PENDING -> "chờ duyệt";
            case APPROVED -> "đã duyệt";
            case COMPLETED -> "hoàn tất";
            case REJECTED -> "bị từ chối";
            case CANCELLED -> "đã huỷ";
        };
    }
}
