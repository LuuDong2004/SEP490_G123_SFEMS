package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.school.voucher.VoucherProgressNotifier.VoucherApproved;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Phiếu của trường duyệt xong thì việc chuyển sang cơ quan quản lý — báo người làm bước tiếp ở Sở (quả chuông):
 *
 * <ul>
 *   <li>Đề xuất mua sắm duyệt xong → chuyên viên lập kế hoạch ({@code procurement_plans:write}) của Sở quản lý trường:
 *       có đề xuất chờ đưa vào kế hoạch.</li>
 *   <li>Biên bản kiểm kê thuộc một đợt duyệt xong → người phụ trách đợt ({@code inventory_campaigns:write}) của cơ quan
 *       phát động: trường đã nộp biên bản.</li>
 * </ul>
 *
 * <p>Trước đây chỉ người trình phiếu được báo; Sở phải tự mở danh sách mới biết có việc (trưởng nhóm 27/11/2026).
 */
@Component
class BodyFollowUpNotifier {

    private final NotificationService notifications;
    private final BodyRecipients recipients;
    private final JdbcTemplate jdbc;

    BodyFollowUpNotifier(NotificationService notifications, BodyRecipients recipients, JdbcTemplate jdbc) {
        this.notifications = notifications;
        this.recipients = recipients;
        this.jdbc = jdbc;
    }

    @EventListener
    void on(VoucherApproved event) {
        switch (event.resource()) {
            case "purchase_proposals" -> proposalApproved(event);
            case "inventory_sessions" -> sessionApproved(event);
            default -> {
            }
        }
    }

    private void proposalApproved(VoucherApproved event) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT s.department_of_education_id AS body, s.name AS school, p.budget_year AS year
                FROM purchase_proposals p JOIN schools s ON s.id = p.school_id WHERE p.id = ?""", event.voucherId());
        if (rows.isEmpty()) {
            return;
        }
        Map<String, Object> r = rows.get(0);
        String title = "Đề xuất mua sắm" + number(event.code()) + " chờ đưa vào kế hoạch";
        String body = "Trường %s — đề xuất đã duyệt%s. Đưa vào kế hoạch mua sắm của Sở.".formatted(r.get("school"),
                r.get("year") == null ? "" : ", năm ngân sách " + r.get("year"));
        send(recipients.holding("procurement_plans:write", toLong(r.get("body"))), NotificationType.VOUCHER_PENDING,
                NotificationLevel.INFO, title, body, "/purchase-proposals/show/" + event.voucherId());
    }

    private void sessionApproved(VoucherApproved event) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT c.managing_body_id AS body, c.title AS campaign, c.id AS campaign_id, s.name AS school
                FROM inventory_sessions k
                JOIN inventory_campaigns c ON c.id = k.campaign_id
                JOIN schools s ON s.id = k.school_id
                WHERE k.id = ?""", event.voucherId());
        if (rows.isEmpty()) {
            return;
        }
        Map<String, Object> r = rows.get(0);
        send(recipients.holding("inventory_campaigns:write", toLong(r.get("body"))), NotificationType.VOUCHER_RESULT,
                NotificationLevel.SUCCESS, "Trường %s đã nộp biên bản kiểm kê".formatted(r.get("school")),
                "Biên bản%s của đợt \"%s\" đã được lãnh đạo trường duyệt.".formatted(number(event.code()), r.get("campaign")),
                "/inventory-campaigns/show/" + r.get("campaign_id"));
    }

    private void send(List<Long> to, NotificationType type, NotificationLevel level, String title, String body,
            String link) {
        Long me = CurrentUser.id().orElse(null);
        for (Long recipient : to) {
            if (!Objects.equals(recipient, me)) {
                notifications.notify(type, recipient, level, title, body, link);
            }
        }
    }

    private static String number(String code) {
        return code == null ? "" : " " + code;
    }

    private static Long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : null;
    }
}
