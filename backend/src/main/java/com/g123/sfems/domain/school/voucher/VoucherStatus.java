package com.g123.sfems.domain.school.voucher;

/**
 * Vòng đời của MỌI loại phiếu. Một vốn từ cho bảy loại phiếu, để màn danh sách,
 * bộ lọc và báo cáo nói cùng một thứ tiếng.
 *
 * <pre>
 *   DRAFT ──trình──► PENDING ──duyệt đủ các bước──► APPROVED ──thực hiện──► COMPLETED
 *     ▲                 │
 *     └───trả lại───────┤
 *                       └──từ chối──► REJECTED
 *   DRAFT ──huỷ──► CANCELLED
 * </pre>
 *
 * <p>{@code APPROVED} và {@code COMPLETED} là hai trạng thái khác nhau vì có phiếu
 * được duyệt rồi mới làm: điều chuyển được duyệt xong còn phải bàn giao thật, và
 * chỉ khi trường nhận xác nhận thì sổ mới đổi. Phiếu nào duyệt xong là xong ngay
 * (phiếu nhập) thì đi thẳng từ {@code PENDING} sang {@code COMPLETED}.
 *
 * <p>{@code REJECTED} và {@code CANCELLED} là hai lối ra khác nhau có chủ đích:
 * từ chối là quyết định của người duyệt, huỷ là người lập tự bỏ phiếu nháp. Báo
 * cáo "bao nhiêu đề nghị bị từ chối" không được đếm lẫn phiếu người ta tự bỏ.
 */
public enum VoucherStatus {
    DRAFT,
    PENDING,
    APPROVED,
    COMPLETED,
    REJECTED,
    CANCELLED;

    /** Còn tác dụng với tài sản: phiếu ở trạng thái cuối không đổi được nữa. */
    public boolean isFinal() {
        return this == COMPLETED || this == REJECTED || this == CANCELLED;
    }
}
