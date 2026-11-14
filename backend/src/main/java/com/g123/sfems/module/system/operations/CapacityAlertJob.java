package com.g123.sfems.module.system.operations;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.scheduling.JobLock;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Hai việc vận hành theo lịch:
 * <ul>
 *   <li>01:30 — sao lưu cơ sở dữ liệu; hỏng thì báo quản trị viên ngay;</li>
 *   <li>06:00 — xét tình trạng (ổ đĩa, dung lượng, tuổi bản sao lưu) và báo quản
 *       trị viên từng cảnh báo còn tồn tại.</li>
 * </ul>
 * Người nhận là mọi tài khoản đang hoạt động có vai trò {@code ADMIN} — người có
 * thể làm gì đó với cảnh báo.
 *
 * <p>Nhiều node thì mỗi lượt chỉ một node chạy ({@link JobLock}) — hai {@code pg_dump} cùng lúc
 * là gấp đôi I/O của database và hai tệp trùng nhau.
 */
@Component
public class CapacityAlertJob {

    private static final Logger log = LoggerFactory.getLogger(CapacityAlertJob.class);

    private final SystemStatusService status;
    private final BackupService backups;
    private final NotificationService notifications;
    private final JdbcTemplate jdbc;
    private final JobLock lock;

    public CapacityAlertJob(SystemStatusService status, BackupService backups, NotificationService notifications,
            JdbcTemplate jdbc, JobLock lock) {
        this.status = status;
        this.backups = backups;
        this.notifications = notifications;
        this.jdbc = jdbc;
        this.lock = lock;
    }

    @Scheduled(cron = "${app.backup.cron:0 30 1 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void backup() {
        lock.runExclusive("backup", Duration.ofHours(3), Duration.ofMinutes(10), () -> {
            BackupService.Result result = backups.run();
            if (!result.success()) {
                log.error("Sao lưu theo lịch thất bại: {}", result.message());
                notifyAdmins(NotificationLevel.ERROR, "Sao lưu dữ liệu thất bại", result.message());
            }
        });
    }

    @Scheduled(cron = "${app.capacity.check-cron:0 0 6 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void check() {
        lock.runExclusive("capacity-check", Duration.ofMinutes(30), Duration.ofMinutes(5), () -> {
            for (SystemStatusService.Alert alert : status.status().alerts()) {
                notifyAdmins("destructive".equals(alert.level()) ? NotificationLevel.ERROR : NotificationLevel.WARNING,
                        "Cảnh báo vận hành", alert.message());
            }
        });
    }

    /**
     * Không chung giao dịch: phương thức tự gọi không qua proxy nên {@code @Transactional} ở đây
     * vốn không có tác dụng. Mỗi {@code notify} tự commit; báo hỏng một người thì người khác vẫn
     * được báo.
     */
    private void notifyAdmins(NotificationLevel level, String title, String body) {
        List<Long> admins = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u
                JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                WHERE r.code = 'ADMIN' AND u.status = 'ACTIVE'""", Long.class);
        for (Long id : admins) {
            try {
                notifications.notify(id, level, title, body, "/system-status");
            } catch (RuntimeException e) {
                log.warn("Không báo được quản trị viên {}: {}", id, e.getMessage());
            }
        }
    }
}
