package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.catalog.norm.EquipmentNormChanged;
import com.g123.sfems.module.system.notification.service.NotificationService;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Bước 9 (docs/du-lieu-theo-nam-hoc.md §8): Sở sửa / ngừng / xoá một dòng danh mục tối thiểu thì điều chỉnh của trường trên dòng
 * đó (năm chưa chốt) hết hiệu lực, và cán bộ thiết bị, lãnh đạo các trường đó được nhắc chọn lại. Chạy trong giao dịch
 * của lần ghi danh mục — ghi hỏng thì không hết hiệu lực gì.
 */
@Component
public class NormChangeListener {

    private final SchoolNormAdjustmentService adjustments;
    private final NotificationService notifications;
    private final JdbcTemplate jdbc;

    public NormChangeListener(SchoolNormAdjustmentService adjustments, NotificationService notifications,
            JdbcTemplate jdbc) {
        this.adjustments = adjustments;
        this.notifications = notifications;
        this.jdbc = jdbc;
    }

    @EventListener
    public void onNormChanged(EquipmentNormChanged event) {
        List<Long> schools = adjustments.expireForNorm(event.normId(), event.reason(), event.always());
        if (schools.isEmpty()) {
            return;
        }
        String name = jdbc.queryForList("SELECT COALESCE(c.name, n.name) FROM equipment_norms n LEFT JOIN equipment_catalogs c"
                + " ON c.id = n.catalog_id WHERE n.id = ?", String.class, event.normId()).stream().findFirst()
                .orElse("một thiết bị");
        for (Long school : schools) {
            for (Long user : jdbc.queryForList("""
                    SELECT DISTINCT u.id FROM users u JOIN user_schools us ON us.id = u.id
                    JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                    WHERE us.school_id = ? AND u.status = 'ACTIVE' AND r.code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF')""",
                    Long.class, school)) {
                notifications.notify(NotificationType.YEAR_PROFILE, user, NotificationLevel.WARNING,
                        "Điều chỉnh chuẩn hết hiệu lực: " + name, event.reason() + ". Chọn lại điều chỉnh cho dòng này.",
                        "/equipment-minimum");
            }
        }
    }
}
