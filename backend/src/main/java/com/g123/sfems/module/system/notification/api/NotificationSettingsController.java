package com.g123.sfems.module.system.notification.api;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService.Preference;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService.PreferenceChange;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService.TypeSetting;
import com.g123.sfems.module.system.notification.service.NotificationSettingsService.TypeSettingChange;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.mail.MailContent;
import com.g123.sfems.shared.mail.MailService;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cài đặt thông báo: của chính người gọi ({@code /api/notification_preferences} — mọi tài khoản), và toàn
 * hệ thống ({@code /api/notification_type_settings} — quản trị).
 */
@RestController
public class NotificationSettingsController {

    public record PreferenceItem(@NotNull NotificationType type, @NotNull Boolean emailEnabled) {
    }

    public record PreferencesRequest(@NotNull @Size(max = 50) List<@Valid @NotNull PreferenceItem> items) {
    }

    public record TypeSettingItem(@NotNull NotificationType type, @NotNull Boolean inAppEnabled,
            @NotNull Boolean emailEnabled) {
    }

    public record TypeSettingsRequest(@NotEmpty @Size(max = 50) List<@Valid @NotNull TypeSettingItem> items) {
    }

    public record TestMailRequest(@NotBlank @Text(value = FieldRule.EMAIL, label = "Thư điện tử") String email) {
    }

    /** Thư thử: tối đa 5 lần / phút / quản trị. */
    private static final int TEST_MAILS_PER_MINUTE = 5;

    private final NotificationSettingsService settings;
    private final MailService mail;
    private final Map<Long, long[]> testMails = new ConcurrentHashMap<>();

    public NotificationSettingsController(NotificationSettingsService settings, MailService mail) {
        this.settings = settings;
        this.mail = mail;
    }

    @GetMapping("/api/notification_preferences")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public List<Preference> preferences() {
        return settings.preferences(me(), myType());
    }

    @PutMapping("/api/notification_preferences")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATIONS_READ + "')")
    public List<Preference> savePreferences(@Valid @RequestBody PreferencesRequest request) {
        return settings.updatePreferences(me(), myType(), request.items().stream()
                .map(i -> new PreferenceChange(i.type(), i.emailEnabled())).toList());
    }

    /** Cài đặt từng loại + máy chủ thư đã khai chưa. */
    public record TypeSettingsResponse(List<TypeSetting> items, boolean mailConfigured) {
    }

    @GetMapping("/api/notification_type_settings")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATION_SETTINGS_READ + "')")
    public TypeSettingsResponse typeSettings() {
        return new TypeSettingsResponse(settings.typeSettings(), mail.configured());
    }

    @PutMapping("/api/notification_type_settings")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATION_SETTINGS_WRITE + "')")
    public TypeSettingsResponse saveTypeSettings(@Valid @RequestBody TypeSettingsRequest request) {
        settings.updateTypeSettings(request.items().stream()
                .map(i -> new TypeSettingChange(i.type(), i.inAppEnabled(), i.emailEnabled())).toList(), me());
        return typeSettings();
    }

    public record TestMailResponse(boolean sent, String message) {
    }

    @PostMapping("/api/notification_type_settings/test-mail")
    @PreAuthorize("hasAuthority('" + Permissions.NOTIFICATION_SETTINGS_WRITE + "')")
    public TestMailResponse testMail(@Valid @RequestBody TestMailRequest request) {
        throttle(me());
        if (!mail.configured()) {
            return new TestMailResponse(false, "Chưa cấu hình máy chủ thư");
        }
        try {
            mail.deliver(request.email().trim(), "Thư thử", MailContent.titled("Máy chủ thư hoạt động bình thường")
                    .label("Thư thử")
                    .paragraph("Đây là thư thử gửi từ màn Cài đặt thông báo. Nhận được thư này nghĩa là hệ thống đã"
                            + " gửi được email: thông báo, link đặt lại mật khẩu, mã đăng nhập sẽ tới người dùng.")
                    .tone(MailContent.Tone.SUCCESS));
            return new TestMailResponse(true, "Đã gửi thư thử");
        } catch (IllegalStateException e) {
            // Lỗi gốc của máy chủ thư (sai mật khẩu ứng dụng, sai cổng…) giúp quản trị sửa cấu hình.
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            return new TestMailResponse(false, "Không gửi được thư thử: " + cause.getMessage());
        }
    }

    private void throttle(Long user) {
        long now = System.currentTimeMillis();
        long[] window = testMails.compute(user, (k, w) -> w == null || now - w[0] > 60_000 ? new long[] {now, 0} : w);
        synchronized (window) {
            if (++window[1] > TEST_MAILS_PER_MINUTE) {
                throw new FieldValidationException("email", "Gửi thử quá nhiều lần, thử lại sau một phút");
            }
        }
    }

    private static Long me() {
        return CurrentUser.id().orElseThrow(() -> new BadCredentialsException("Not authenticated"));
    }

    private static UserType myType() {
        return CurrentUser.userType().orElseThrow(() -> new BadCredentialsException("Not authenticated"));
    }
}
