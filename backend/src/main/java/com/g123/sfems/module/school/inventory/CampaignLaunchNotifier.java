package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.system.notification.service.NotificationService;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Sở phát động đợt kiểm kê thì báo cán bộ lập biên bản kiểm kê của từng trường trong phạm vi (người có
 * {@code inventory_sessions:write}, tài khoản đang hoạt động). Trước đây trường chỉ biết khi tình cờ mở màn kiểm kê
 * (E2E-05).
 *
 * <p>Nghe đồng bộ như các bộ báo phiếu: thông báo là bản ghi, đi cùng giao dịch phát động.
 */
@Component
class CampaignLaunchNotifier {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final NotificationService notifications;
    private final JdbcTemplate jdbc;

    CampaignLaunchNotifier(NotificationService notifications, JdbcTemplate jdbc) {
        this.notifications = notifications;
        this.jdbc = jdbc;
    }

    @EventListener
    void on(CampaignLaunched event) {
        // Cùng phạm vi với màn tiến độ đợt (InventoryCampaignService.progress): đợt của Sở áp cho mọi trường Sở quản lý.
        List<Long> recipients = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                JOIN user_schools us ON us.id = u.id
                JOIN schools s ON s.id = us.school_id
                WHERE p.code = 'inventory_sessions:write' AND u.status = 'ACTIVE'
                  AND (? OR s.department_of_education_id = ?)
                """, Long.class, event.cityWide(), event.managingBodyId());
        String title = "Đợt kiểm kê mới: " + event.title();
        String body = "Chốt số liệu ngày %s, nộp biên bản trước ngày %s. Lập phiếu kiểm kê theo đợt này."
                .formatted(event.cutoffDate().format(DAY), event.deadline().format(DAY));
        for (Long recipient : recipients) {
            notifications.notify(NotificationType.INVENTORY_CAMPAIGN, recipient, NotificationLevel.INFO, title, body,
                    "/inventory-sessions");
        }
    }

    /** Một đợt kiểm kê vừa được phát động. */
    record CampaignLaunched(Long managingBodyId, boolean cityWide, String title, LocalDate cutoffDate,
            LocalDate deadline) {
    }
}
