package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearActivated;
import com.g123.sfems.module.system.notification.service.NotificationService;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Năm học mới thành hiện hành → báo mọi tài khoản trường (trưởng nhóm 25/11/2026): khai dữ liệu đầu năm ở tab Năm học
 * (lên lớp, rà soát phân công giáo viên, phòng) rồi xác nhận đã khai. Chạy trong giao dịch ghi năm học.
 */
@Component
class YearStartNotifier {

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;

    YearStartNotifier(JdbcTemplate jdbc, NotificationService notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    void on(SchoolYearActivated event) {
        SchoolYear year = event.year();
        if (year == null || year.getId() == null) {
            return;
        }
        List<Long> users = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u JOIN user_schools us ON us.id = u.id
                JOIN schools s ON s.id = us.school_id AND s.status = 'ACTIVE'
                JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                WHERE u.status = 'ACTIVE' AND r.code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF')""", Long.class);
        String name = year.getName() == null ? "Năm học mới" : year.getName();
        for (Long user : users) {
            notifications.notify(NotificationType.YEAR_PROFILE, user, NotificationLevel.INFO,
                    name + " đã là năm học hiện hành",
                    "Khai dữ liệu đầu năm ở tab Năm học: lên lớp, rà soát phân công giáo viên, cán bộ, phòng, rồi xác nhận"
                            + " đã khai. Thiết bị mới vẫn vào sổ qua phiếu ghi tăng.",
                    "/school-year-profile?year=" + year.getId());
        }
    }
}
