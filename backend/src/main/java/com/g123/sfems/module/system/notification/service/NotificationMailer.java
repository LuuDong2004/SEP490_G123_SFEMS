package com.g123.sfems.module.system.notification.service;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.security.user.service.PasswordResetService;
import com.g123.sfems.shared.data.rls.RowSecurityDataSource;
import com.g123.sfems.shared.mail.MailContent;
import com.g123.sfems.shared.mail.MailService;
import com.g123.sfems.shared.scheduling.JobLock;
import com.g123.sfems.shared.web.portal.Portal;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;


/**
 * Kênh email của thông báo. Sau khi thông báo đã commit, gửi thư nếu: loại đó bật email toàn hệ thống,
 * người nhận bật email loại đó, tài khoản đang hoạt động và có địa chỉ thư. Mọi quyết định GỬI / KHÔNG GỬI có lý do
 * được ghi ở {@code notification_emails} (một dòng / thông báo) để tra "vì sao không nhận được thư".
 *
 * <p>Gửi trên luồng riêng: máy chủ thư chậm không giữ yêu cầu của người dùng, không giữ kết nối CSDL. Thư lỗi được thử
 * lại sau {@link #RETRY_AFTER} (tối đa {@link #MAX_ATTEMPTS} lần); còn lỗi thì báo quản trị một lần mỗi ngày.
 */
@Component
public class NotificationMailer {

    private static final Logger log = LoggerFactory.getLogger(NotificationMailer.class);
    static final int MAX_ATTEMPTS = 2;
    static final Duration RETRY_AFTER = Duration.ofMinutes(5);
    static final String FAILURE_ALERT = "Gửi email thông báo bị lỗi";

    private record Mail(long id, String email, NotificationType type, NotificationLevel level, String title,
            String body, String link, UserType userType) {
    }

    private final JdbcTemplate jdbc;
    private final MailService mail;
    private final NotificationSettingsService settings;
    private final NotificationService notifications;
    private final JobLock lock;
    private final String frontendUrl;
    private final ExecutorService executor;

    public NotificationMailer(JdbcTemplate jdbc, MailService mail, NotificationSettingsService settings,
            @Lazy NotificationService notifications, JobLock lock,
            @Value("${app.frontend-url:http://localhost:5555}") String frontendUrl,
            @Value("${app.notifications.mail-async:true}") boolean async) {
        this.jdbc = jdbc;
        this.mail = mail;
        this.settings = settings;
        this.notifications = notifications;
        this.lock = lock;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.executor = async ? Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "notification-mail");
            t.setDaemon(true);
            return t;
        }) : null;
    }

    @PreDestroy
    void stop() {
        if (executor != null) {
            executor.shutdown();
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRaised(NotificationRaised raised) {
        if (!raised.email()) {
            return;
        }
        try {
            // Người nhận thường khác người gây ra sự kiện — đọc tài khoản người nhận không theo phạm vi của người gọi.
            Long emailId = RowSecurityDataSource.unscoped(() -> decide(raised.id()));
            if (emailId != null) {
                dispatch(emailId);
            }
        } catch (RuntimeException e) {
            // Thông báo trên hệ thống đã có; thư hỏng không được làm hỏng gì khác.
            log.warn("Không xếp được thư cho thông báo {}: {}", raised.id(), e.getMessage());
        }
    }

    /** Quyết định gửi hay không; trả id dòng {@code notification_emails} cần gửi, hoặc null. */
    Long decide(long notificationId) {
        List<Object[]> rows = jdbc.query("""
                SELECT n.type, n.recipient_id, u.email, u.status FROM notifications n JOIN users u ON u.id = n.recipient_id
                WHERE n.id = ?""", (rs, i) -> new Object[] {rs.getString(1), rs.getLong(2), rs.getString(3),
                        rs.getString(4)}, notificationId);
        if (rows.isEmpty()) {
            return null;
        }
        Object[] r = rows.getFirst();
        NotificationType type = parse((String) r[0]);
        long recipient = (Long) r[1];
        String email = (String) r[2];
        if (!settings.setting(type).emailEnabled() || !settings.wantsEmail(recipient, type)
                || !"ACTIVE".equals(r[3])) {
            return null;
        }
        // Email giả máy đặt cho tài khoản chưa có email: không có hộp thư thật ở đó.
        if (email == null || email.isBlank() || !email.contains("@")
                || email.endsWith(PasswordResetService.PLACEHOLDER_DOMAIN)) {
            record(notificationId, null, "SKIPPED", "Tài khoản chưa có thư điện tử");
            return null;
        }
        if (!mail.configured()) {
            record(notificationId, email.trim(), "SKIPPED", "Chưa cấu hình máy chủ thư");
            return null;
        }
        return record(notificationId, email.trim(), "PENDING", null);
    }

    private Long record(long notificationId, String email, String status, String error) {
        List<Long> ids = jdbc.queryForList("""
                INSERT INTO notification_emails (notification_id, recipient_email, status, error)
                VALUES (?, ?, ?, ?) ON CONFLICT (notification_id) DO NOTHING RETURNING id""", Long.class,
                notificationId, email, status, error);
        return ids.isEmpty() ? null : ids.getFirst();
    }

    private void dispatch(long emailId) {
        if (executor == null) {
            deliver(emailId);
        } else {
            executor.execute(() -> deliver(emailId));
        }
    }

    /** Gửi một thư; kết quả ghi lại dòng {@code notification_emails}. */
    void deliver(long emailId) {
        List<Mail> found = jdbc.query("""
                SELECT e.id, e.recipient_email, n.type, n.level, n.title, n.body, n.link, u.user_type
                FROM notification_emails e JOIN notifications n ON n.id = e.notification_id
                JOIN users u ON u.id = n.recipient_id WHERE e.id = ?""",
                (rs, i) -> new Mail(rs.getLong(1), rs.getString(2), parse(rs.getString(3)),
                        NotificationLevel.valueOf(rs.getString(4)), rs.getString(5), rs.getString(6), rs.getString(7),
                        UserType.valueOf(rs.getString(8))), emailId);
        if (found.isEmpty()) {
            return;
        }
        Mail m = found.getFirst();
        try {
            boolean sent = mail.deliver(m.email(), subject(m), content(m));
            jdbc.update("""
                    UPDATE notification_emails SET status = ?, attempts = attempts + 1, error = ?,
                        sent_at = CASE WHEN ? THEN now() ELSE sent_at END WHERE id = ?""",
                    sent ? "SENT" : "SKIPPED", sent ? null : "Gửi thư đang tắt hoặc chưa cấu hình máy chủ thư", sent, emailId);
        } catch (RuntimeException e) {
            // Lỗi gốc từ máy chủ thư (sai mật khẩu, từ chối người nhận…) có ích hơn câu chung của MailService.
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            String error = cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage();
            jdbc.update("UPDATE notification_emails SET status = 'FAILED', attempts = attempts + 1, error = ? WHERE id = ?",
                    error.length() > 500 ? error.substring(0, 500) : error, emailId);
        }
    }

    /** Thử lại thư lỗi; còn lỗi sau {@link #MAX_ATTEMPTS} lần thì báo quản trị (một lần / ngày). */
    @Scheduled(fixedDelayString = "${app.notifications.mail-retry-ms:300000}", initialDelay = 120_000)
    public void retry() {
        lock.runExclusive("notification-mail-retry", Duration.ofMinutes(10), Duration.ofMinutes(1), this::retryNow);
    }

    void retryNow() {
        List<Long> due = jdbc.queryForList("""
                SELECT id FROM notification_emails WHERE status = 'FAILED' AND attempts < ?
                  AND created_at < now() - make_interval(secs => ?) ORDER BY id LIMIT 200""", Long.class,
                MAX_ATTEMPTS, RETRY_AFTER.toSeconds());
        for (Long id : due) {
            deliver(id);
        }
        Long gaveUp = jdbc.queryForObject("""
                SELECT count(*) FROM notification_emails WHERE status = 'FAILED' AND attempts >= ?
                  AND created_at > now() - interval '1 day'""", Long.class, MAX_ATTEMPTS);
        Long alerted = jdbc.queryForObject("""
                SELECT count(*) FROM notifications WHERE type = 'SYSTEM_ALERT' AND title = ?
                  AND created_at > now() - interval '1 day'""", Long.class, FAILURE_ALERT);
        if (gaveUp != null && gaveUp > 0 && alerted != null && alerted == 0) {
            String error = jdbc.queryForList("""
                    SELECT error FROM notification_emails WHERE status = 'FAILED' AND attempts >= ?
                    ORDER BY id DESC LIMIT 1""", String.class, MAX_ATTEMPTS).stream().findFirst().orElse("");
            for (Long admin : jdbc.queryForList("""
                    SELECT DISTINCT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id
                    JOIN roles r ON r.id = ur.role_id WHERE r.code = 'ADMIN' AND u.status = 'ACTIVE'""", Long.class)) {
                notifications.notify(NotificationType.SYSTEM_ALERT, admin, NotificationLevel.ERROR, FAILURE_ALERT,
                        "%d thư thông báo trong 24 giờ qua không gửi được. Lỗi gần nhất: %s".formatted(gaveUp, error),
                        "/notification-settings");
            }
        }
    }

    // ------------------------------------------------------------------ nội dung thư

    private static String subject(Mail m) {
        String title = m.title().replaceAll("[\r\n]+", " ");
        return title.length() > 200 ? title.substring(0, 199) + "…" : title;
    }

    /** Đường dẫn đầy đủ: địa chỉ giao diện + cổng của người nhận + đường dẫn nội bộ của thông báo. */
    String url(String link, UserType userType) {
        if (link == null || !link.startsWith("/") || link.startsWith("//")) {
            return frontendUrl;
        }
        String portal = Arrays.stream(Portal.values()).filter(p -> p.userType() == userType).findFirst()
                .map(p -> "/" + p.prefix()).orElse("");
        return frontendUrl + portal + link;
    }

    MailContent content(Mail m) {
        MailContent.Tone tone = switch (m.level()) {
            case ERROR -> MailContent.Tone.ERROR;
            case WARNING -> MailContent.Tone.WARNING;
            case SUCCESS -> MailContent.Tone.SUCCESS;
            default -> MailContent.Tone.INFO;
        };
        return MailContent.titled(m.title())
                .label(m.type().label())
                .paragraph(m.body())
                .action("Xem trên hệ thống", url(m.link(), m.userType()))
                .note("Không muốn nhận email loại này? Vào Hồ sơ cá nhân → Thông báo để tắt.")
                .tone(tone);
    }

    private static NotificationType parse(String type) {
        try {
            return NotificationType.valueOf(type);
        } catch (IllegalArgumentException | NullPointerException e) {
            return NotificationType.ADMIN_MESSAGE;
        }
    }
}
