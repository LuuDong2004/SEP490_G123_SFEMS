package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalFlowType;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.List;
import java.util.Objects;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Báo tiến độ của phiếu: phiếu vừa tới một bước duyệt thì báo những người duyệt được bước đó; phiếu duyệt xong
 * thì báo người trình. Trước đây chỉ có thông báo khi bị trả lại / từ chối ({@link VoucherDecisionNotifier}), nên
 * người duyệt không biết có việc, người lập không biết phiếu đã qua (E2E-05).
 *
 * <p>"Người duyệt được" là cùng một luật với {@link VoucherWorkflow#inTier} cộng mã quyền
 * {@code <loại phiếu>:approve}: bước TRƯỜNG — tài khoản của trường đó; bước CƠ QUAN QUẢN LÝ / CƠ QUAN NHẬN —
 * tài khoản của Sở quản lý trường (hoặc trường nhận). Chỉ tài khoản đang hoạt động.
 *
 * <p>Nghe đồng bộ như {@link VoucherDecisionNotifier}: thông báo là bản ghi, đi cùng giao dịch của việc trình / duyệt.
 */
@Component
class VoucherProgressNotifier {

    private final NotificationService notifications;
    private final VoucherApprovers approvers;

    VoucherProgressNotifier(NotificationService notifications, VoucherApprovers approvers) {
        this.notifications = notifications;
        this.approvers = approvers;
    }

    @EventListener
    void on(VoucherAwaiting event) {
        if (event.step() == null) {
            return;
        }
        // Lãnh đạo một cơ sở chỉ nhận phiếu chỉ chạm cơ sở của mình (cùng luật với VoucherWorkflow.inTier).
        List<Long> recipients = approvers.of(event.resource(), event.step(), event.schoolId(), event.campuses());
        Long me = CurrentUser.id().orElse(null);
        String title = kind(event.resource()) + number(event.code()) + " chờ duyệt";
        String body = "Trường " + event.schoolName() + " trình, đang chờ " + stepLabel(event.step()) + " duyệt.";
        for (Long recipient : recipients) {
            if (!Objects.equals(recipient, me)) {
                notifications.notify(NotificationType.VOUCHER_PENDING, recipient, NotificationLevel.INFO, title, body,
                        link(event.resource(), event.voucherId()));
            }
        }
    }

    @EventListener
    void on(VoucherApproved event) {
        Long recipient = event.recipientId();
        if (recipient == null || Objects.equals(recipient, CurrentUser.id().orElse(null))) {
            return;
        }
        notifications.notify(NotificationType.VOUCHER_RESULT, recipient, NotificationLevel.SUCCESS,
                kind(event.resource()) + number(event.code()) + " đã được duyệt",
                "Phiếu đã qua đủ các cấp duyệt. Mở phiếu để làm bước tiếp theo nếu có.",
                link(event.resource(), event.voucherId()));
    }

    private static String kind(String resource) {
        return ApprovalFlowType.of(resource).map(ApprovalFlowType::label).orElse("Phiếu");
    }

    private static String number(String code) {
        return code == null ? "" : " " + code;
    }

    private static String link(String resource, Long id) {
        return "/" + resource.replace('_', '-') + "/show/" + id;
    }

    private static String stepLabel(ApprovalStep step) {
        return switch (step) {
            case SCHOOL -> "lãnh đạo trường";
            case MANAGING_BODY -> "lãnh đạo Sở";
        };
    }

    /** Phiếu vừa tới bước {@code step} (sau khi trình, hoặc sau khi bước trước duyệt). */
    record VoucherAwaiting(String resource, Long voucherId, String code, ApprovalStep step, Long schoolId,
            String schoolName, java.util.Set<Long> campuses) {
    }

    /** Phiếu vừa qua bước duyệt cuối. {@code recipientId}: người trình, không có thì người lập. */
    record VoucherApproved(String resource, Long voucherId, String code, Long recipientId) {
    }
}
