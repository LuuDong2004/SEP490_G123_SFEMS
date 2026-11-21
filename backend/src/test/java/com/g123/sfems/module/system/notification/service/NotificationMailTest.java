package com.g123.sfems.module.system.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.system.notification.Notification;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService.PreferenceChange;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService.TypeSettingChange;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.mail.BodyPart;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import com.g123.sfems.shared.mail.FakeMailSenderConfig;
import com.g123.sfems.shared.mail.FakeMailSenderConfig.FakeMailSender;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kênh email của thông báo: ai nhận thư, ai không, vì sao; thư lỗi được thử lại rồi báo quản trị. Máy chủ
 * thư là bản giả ghi lại thư; gửi đồng bộ ({@code app.notifications.mail-async=false}). Chạy trong giao dịch, lùi hết.
 */
@SpringBootTest(properties = FakeMailSenderConfig.PROPERTIES)
@Import(FakeMailSenderConfig.class)
@Transactional
class NotificationMailTest {

    @Autowired
    NotificationService notifications;

    @Autowired
    NotificationSettingsService settings;

    @Autowired
    NotificationMailer mailer;

    @Autowired
    JavaMailSender sender;

    @Autowired
    JdbcTemplate jdbc;

    FakeMailSender fake;
    Long schoolUser;

    @BeforeEach
    void setUp() {
        fake = (FakeMailSender) sender;
        fake.sent.clear();
        fake.failing = false;
        // Tài khoản trường riêng của test (lùi cùng giao dịch): không dựa vào dữ liệu demo, email thật để thư đi.
        Long school = jdbc.queryForObject("""
                INSERT INTO schools (code, name, status, created_at) VALUES ('TEST-MAIL', 'Trường thử thư', 'ACTIVE', now())
                RETURNING id""", Long.class);
        schoolUser = jdbc.queryForObject("""
                INSERT INTO users (username, email, password_hash, full_name, status, created_at, user_type)
                VALUES ('test.mail', 'test.mail@example.com', 'x', 'Cán bộ thử thư', 'ACTIVE', now(), 'SCHOOL')
                RETURNING id""", Long.class);
        jdbc.update("INSERT INTO user_schools (id, school_id) VALUES (?, ?)", schoolUser, school);
        // Mặc định của loại, không ai sửa.
        settings.updateTypeSettings(List.of(
                new TypeSettingChange(NotificationType.VOUCHER_RESULT, true, true),
                new TypeSettingChange(NotificationType.INVENTORY_CAMPAIGN, true, false)), null);
        jdbc.update("DELETE FROM notification_preferences WHERE user_id = ?", schoolUser);
    }

    @Test
    void emailGoesOutWhenTypeAndUserBothWantIt() throws MessagingException, IOException {
        Notification n = raise(NotificationType.VOUCHER_RESULT, "/purchase-proposals/show/7");
        afterCommit(n);

        assertThat(status(n)).isEqualTo("SENT");
        assertThat(fake.sent).hasSize(1);
        MimeMessage message = fake.sent.getFirst();
        assertThat(message.getSubject()).isEqualTo("[SFEMS] Đề xuất ĐX-0007 bị trả lại, cần sửa");
        assertThat(contentOf(message)).contains("/school/purchase-proposals/show/7");
    }

    @Test
    void noEmailWhenUserTurnedItOff() {
        settings.updatePreferences(schoolUser, UserType.SCHOOL,
                List.of(new PreferenceChange(NotificationType.VOUCHER_RESULT, false)));
        Notification n = raise(NotificationType.VOUCHER_RESULT, null);
        afterCommit(n);

        assertThat(status(n)).isNull();
        assertThat(fake.sent).isEmpty();
    }

    @Test
    void noEmailWhenTypeHasEmailOff() {
        Notification n = raise(NotificationType.INVENTORY_CAMPAIGN, null);
        afterCommit(n);

        assertThat(status(n)).isNull();
        assertThat(fake.sent).isEmpty();
    }

    @Test
    void noEmailToPlaceholderAddress() {
        jdbc.update("UPDATE users SET email = 'test.mail@qltb.local' WHERE id = ?", schoolUser);
        Notification n = raise(NotificationType.VOUCHER_RESULT, null);
        afterCommit(n);

        assertThat(status(n)).isEqualTo("SKIPPED");
        assertThat(fake.sent).isEmpty();
    }

    @Test
    void typeTurnedOffInAppRaisesNothing() {
        settings.updateTypeSettings(List.of(new TypeSettingChange(NotificationType.YEAR_PROFILE, false, true)), null);
        assertThat(settings.setting(NotificationType.YEAR_PROFILE).emailEnabled()).isFalse();
        assertThat(notifications.notify(NotificationType.YEAR_PROFILE, schoolUser, NotificationLevel.INFO, "Thử", null,
                null)).isNull();
    }

    @Test
    void systemAlertsCannotBeSilenced() {
        assertThatThrownBy(() -> settings.updateTypeSettings(
                List.of(new TypeSettingChange(NotificationType.SYSTEM_ALERT, false, false)), null))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void userOnlySeesAndSetsTypesMeantForThem() {
        assertThat(settings.preferences(schoolUser, UserType.SCHOOL))
                .extracting(NotificationSettingsService.Preference::type)
                .contains(NotificationType.VOUCHER_RESULT).doesNotContain(NotificationType.SYSTEM_ALERT);
        assertThatThrownBy(() -> settings.updatePreferences(schoolUser, UserType.SCHOOL,
                List.of(new PreferenceChange(NotificationType.SYSTEM_ALERT, false))))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void failedMailIsRetriedThenAdminsAreTold() {
        fake.failing = true;
        Notification n = raise(NotificationType.VOUCHER_RESULT, null);
        afterCommit(n);
        assertThat(status(n)).isEqualTo("FAILED");

        jdbc.update("UPDATE notification_emails SET created_at = now() - interval '10 minutes' WHERE notification_id = ?",
                n.getId());
        jdbc.update("DELETE FROM notifications WHERE type = 'SYSTEM_ALERT' AND title = ?", NotificationMailer.FAILURE_ALERT);
        mailer.retryNow();

        assertThat(jdbc.queryForObject("SELECT attempts FROM notification_emails WHERE notification_id = ?",
                Integer.class, n.getId())).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications WHERE type = 'SYSTEM_ALERT' AND title = ?",
                Long.class, NotificationMailer.FAILURE_ALERT)).isPositive();
    }

    private Notification raise(NotificationType type, String link) {
        return notifications.notify(type, schoolUser, NotificationLevel.WARNING, "Đề xuất ĐX-0007 bị trả lại, cần sửa",
                "Lý do: thiếu báo giá.", link);
    }

    private String status(Notification n) {
        return jdbc.queryForList("SELECT status FROM notification_emails WHERE notification_id = ?", String.class,
                n.getId()).stream().findFirst().orElse(null);
    }

    /** Như sau commit: quyết định rồi gửi (đồng bộ). */
    private void afterCommit(Notification n) {
        Long email = mailer.decide(n.getId());
        if (email != null) {
            mailer.deliver(email);
        }
    }

    /** Bản chữ trơn của thư. */
    private static String contentOf(Part part) throws MessagingException, IOException {
        Object content = part.getContent();
        if (content instanceof String text) {
            return part.isMimeType("text/html") ? "" : text;
        }
        if (content instanceof Multipart multipart) {
            StringBuilder out = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart child = multipart.getBodyPart(i);
                out.append(contentOf(child));
            }
            return out.toString();
        }
        return "";
    }
}
