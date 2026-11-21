package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalFlowType;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.Objects;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Báo cho người lập khi phiếu của họ bị TRẢ LẠI hoặc bị TỪ CHỐI, kèm lý do và lối mở đúng phiếu. Trước đó
 * người lập chỉ biết khi tình cờ mở lại danh sách.
 *
 * <p>Nghe đồng bộ ({@link EventListener}, không phải AFTER_COMMIT): dòng thông báo là bản ghi, phải nằm cùng giao
 * dịch với việc trả lại / từ chối — giao dịch lùi lại thì không có thông báo về một việc không xảy ra. Đẩy qua
 * socket thì {@code NotificationPublisher} đã đợi commit.
 */
@Component
class VoucherDecisionNotifier {

    private final NotificationService notifications;

    VoucherDecisionNotifier(NotificationService notifications) {
        this.notifications = notifications;
    }

    @EventListener
    void on(VoucherDecided event) {
        Long recipient = event.recipientId();
        // Tự trả lại / từ chối phiếu của chính mình thì không cần chuông.
        if (recipient == null || Objects.equals(recipient, CurrentUser.id().orElse(null))) {
            return;
        }
        String kind = ApprovalFlowType.of(event.resource()).map(ApprovalFlowType::label).orElse("Phiếu");
        String number = event.code() == null ? "" : " " + event.code();
        boolean rejected = event.decision() == VoucherDecided.Decision.REJECTED;
        String title = rejected ? kind + number + " bị từ chối" : kind + number + " bị trả lại, cần sửa";
        String body = (rejected ? "Lý do: " : "Cần sửa: ") + event.note();
        notifications.notify(NotificationType.VOUCHER_RESULT, recipient,
                rejected ? NotificationLevel.ERROR : NotificationLevel.WARNING, title, body,
                "/" + event.resource().replace('_', '-') + "/show/" + event.voucherId());
    }

    /** Một phiếu vừa bị trả lại / từ chối. {@code recipientId}: người trình, không có thì người lập. */
    record VoucherDecided(String resource, Long voucherId, String code, Decision decision, String note,
            Long recipientId) {

        enum Decision {
            RETURNED,
            REJECTED
        }
    }
}
