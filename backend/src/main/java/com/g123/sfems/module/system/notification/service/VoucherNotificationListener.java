package com.g123.sfems.module.system.notification.service;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.module.school.voucher.VoucherAwaitingApproval;
import com.g123.sfems.module.school.voucher.VoucherDecided;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Delivers return/rejection outcomes to the person who submitted the voucher. */
@Component
public class VoucherNotificationListener {

    private static final Map<String, String> LABELS = Map.of(
            "equipment_intakes", "phiếu nhập thiết bị",
            "purchase_proposals", "đề xuất mua sắm",
            "inventory_sessions", "phiếu kiểm kê");

    private final NotificationService notifications;
    private final JdbcTemplate jdbc;

    public VoucherNotificationListener(NotificationService notifications, JdbcTemplate jdbc) {
        this.notifications = notifications;
        this.jdbc = jdbc;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoucherAwaitingApproval(VoucherAwaitingApproval event) {
        String scopePredicate;
        Long scopeId;
        if (event.step() == ApprovalStep.SCHOOL) {
            scopePredicate = "u.school_id = ?";
            scopeId = event.schoolId();
        } else {
            scopePredicate = "u.managing_body_id = ?";
            scopeId = event.managingBodyId();
        }
        if (scopeId == null) return;

        List<Long> recipients = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                LEFT JOIN role_permissions rp ON rp.role_id = r.id
                LEFT JOIN permissions p ON p.id = rp.permission_id
                WHERE u.status = 'ACTIVE' AND (r.code = 'ADMIN' OR (p.code = ? AND %s))
                """.formatted(scopePredicate), Long.class, event.resource() + ":approve", scopeId);
        String label = LABELS.getOrDefault(event.resource(), "phiếu");
        String title = "Cần duyệt %s — %s".formatted(label, event.code());
        String body = event.step() == ApprovalStep.SCHOOL
                ? "Phiếu đang chờ lãnh đạo trường duyệt."
                : "Phiếu đang chờ cơ quan quản lý duyệt.";
        String link = "/" + event.resource() + "/show/" + event.voucherId();
        for (Long recipient : recipients) {
            notifications.notify(recipient, NotificationLevel.INFO, title, body, link);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVoucherDecided(VoucherDecided event) {
        if (event.recipientId() == null) return;
        String label = LABELS.getOrDefault(event.resource(), "phiếu");
        boolean returned = event.decision() == VoucherDecided.Decision.RETURNED;
        String outcome = returned ? "được trả lại để chỉnh sửa" : "bị từ chối";
        String title = "%s %s — %s".formatted(capitalize(label), event.code(), outcome);
        String body = event.note() == null || event.note().isBlank() ? null : event.note();
        String link = "/" + event.resource() + "/show/" + event.voucherId();
        notifications.notify(event.recipientId(), returned ? NotificationLevel.WARNING : NotificationLevel.ERROR,
                title, body, link);
    }

    private static String capitalize(String value) {
        return value.isEmpty() ? value : value.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + value.substring(1);
    }
}
