package com.g123.sfems.module.school.voucher;

/**
 * Sự kiện Spring: một phiếu vừa bị TRẢ LẠI hoặc TỪ CHỐI. {@code recipientId} là người trình, không có
 * thì người lập.
 *
 * <p>Phát ra đồng bộ trong giao dịch của bước duyệt. Phân hệ Thông báo (HT-06) nghe sự kiện này bằng
 * một {@code @EventListener} để báo cho người lập; vòng duyệt không gọi thẳng service thông báo, để
 * hai phân hệ không phụ thuộc nhau lúc biên dịch.
 */
public record VoucherDecided(String resource, Long voucherId, String code, Decision decision, String note,
        Long recipientId) {

    public enum Decision {
        RETURNED,
        REJECTED
    }
}
