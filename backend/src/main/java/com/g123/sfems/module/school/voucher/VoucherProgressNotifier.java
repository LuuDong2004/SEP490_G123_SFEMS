package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalFlowType;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.List;
import java.util.Objects;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Báo tiến độ của phiếu: phiếu vừa tới một bước duyệt thì báo những người duyệt được bước đó; phiếu duyệt xong
 * thì báo người trình. Trước đây chỉ có thông báo khi bị trả lại / từ chối ({@link VoucherDecisionNotifier}), nên
 * người duyệt không biết có việc, người lập không biết phiếu đã qua (E2E-05).
 *
 * <p>"Người duyệt được" là cùng một luật với {@link VoucherWorkflow#inTier} cộng mã quyền
 * {@code <loại phiếu>:approve}: bước TRƯỜNG — tài khoản của trường đó; bước CƠ QUAN QUẢN LÝ / CƠ QUAN NHẬN —
 * tài khoản của cơ quan chủ quản trực tiếp của trường (hoặc trường nhận). Chỉ tài khoản đang hoạt động.
 *
 * <p>Nghe đồng bộ như {@link VoucherDecisionNotifier}: thông báo là bản ghi, đi cùng giao dịch của việc trình / duyệt.
 */
@Component
class VoucherProgressNotifier {

    private static final String APPROVERS = """
            SELECT DISTINCT u.id FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN role_permissions rp ON rp.role_id = ur.role_id
            JOIN permissions p ON p.id = rp.permission_id
            LEFT JOIN user_schools us ON us.id = u.id
            LEFT JOIN (SELECT id, managing_body_id FROM user_sos
                       UNION ALL SELECT id, managing_body_id FROM user_ubnds) ag ON ag.id = u.id
            WHERE p.code = ? AND u.status = 'ACTIVE' AND\s""";

    private final NotificationService notifications;
    private final JdbcTemplate jdbc;

    VoucherProgressNotifier(NotificationService notifications, JdbcTemplate jdbc) {
        this.notifications = notifications;
        this.jdbc = jdbc;
    }

    @EventListener
    void on(VoucherAwaiting event) {
        if (event.step() == null) {
            return;
        }
        String permission = event.resource() + ":approve";
        List<Long> recipients = switch (event.step()) {
            case SCHOOL -> jdbc.queryForList(APPROVERS + "us.school_id = ?", Long.class, permission, event.schoolId());
            case MANAGING_BODY -> bodyApprovers(permission, event.schoolId());
            case RECEIVING_BODY -> bodyApprovers(permission, event.targetSchoolId());
        };
        Long me = CurrentUser.id().orElse(null);
        String title = kind(event.resource()) + number(event.code()) + " chờ duyệt";
        String body = "Trường " + event.schoolName() + " trình, đang chờ " + stepLabel(event.step()) + " duyệt.";
        for (Long recipient : recipients) {
            if (!Objects.equals(recipient, me)) {
                notifications.notify(recipient, NotificationLevel.INFO, title, body, link(event.resource(), event.voucherId()));
            }
        }
    }

    @EventListener
    void on(VoucherApproved event) {
        Long recipient = event.recipientId();
        if (recipient == null || Objects.equals(recipient, CurrentUser.id().orElse(null))) {
            return;
        }
        notifications.notify(recipient, NotificationLevel.SUCCESS,
                kind(event.resource()) + number(event.code()) + " đã được duyệt",
                "Phiếu đã qua đủ các cấp duyệt. Mở phiếu để làm bước tiếp theo nếu có.",
                link(event.resource(), event.voucherId()));
    }

    private List<Long> bodyApprovers(String permission, Long schoolId) {
        if (schoolId == null) {
            return List.of();
        }
        return jdbc.queryForList(APPROVERS
                + "ag.managing_body_id = (SELECT s.department_of_education_id FROM schools s WHERE s.id = ?)",
                Long.class, permission, schoolId);
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
            case MANAGING_BODY -> "cơ quan quản lý";
            case RECEIVING_BODY -> "cơ quan quản lý của trường nhận";
        };
    }

    /** Phiếu vừa tới bước {@code step} (sau khi trình, hoặc sau khi bước trước duyệt). */
    record VoucherAwaiting(String resource, Long voucherId, String code, ApprovalStep step, Long schoolId,
            String schoolName, Long targetSchoolId) {
    }

    /** Phiếu vừa qua bước duyệt cuối. {@code recipientId}: người trình, không có thì người lập. */
    record VoucherApproved(String resource, Long voucherId, String code, Long recipientId) {
    }
}
