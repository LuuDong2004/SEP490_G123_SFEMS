package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Sở phát động đợt kiểm kê thì báo cán bộ lập phiếu kiểm kê của từng trường thuộc Sở (người có quyền
 * {@code inventory_sessions:write}, tài khoản đang hoạt động) — để trường không phải tình cờ mở màn kiểm
 * kê mới biết có đợt.
 *
 * <p>Nghe đồng bộ: thông báo là bản ghi, đi cùng giao dịch phát động — phát động lỗi thì không ai nhận
 * thông báo về một đợt không tồn tại.
 */
@Component
class CampaignLaunchNotifier {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JdbcTemplate jdbc;

    CampaignLaunchNotifier(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener
    void on(CampaignLaunched event) {
        List<Long> recipients = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                JOIN schools s ON s.id = u.school_id
                WHERE p.code = 'inventory_sessions:write' AND u.status = 'ACTIVE'
                  AND s.department_of_education_id = ?
                """, Long.class, event.managingBodyId());
        String title = "Đợt kiểm kê mới: " + event.title();
        String body = "Chốt số liệu ngày %s, nộp biên bản trước ngày %s. Lập phiếu kiểm kê theo đợt này."
                .formatted(event.cutoffDate().format(DAY), event.deadline().format(DAY));
        for (Long recipient : recipients) {
            jdbc.update("""
                    INSERT INTO notifications (recipient_id, level, title, body, link, created_at)
                    VALUES (?, ?, ?, ?, '/inventory-sessions', now())
                    """, recipient, NotificationLevel.INFO.name(), title, body);
        }
    }
}
