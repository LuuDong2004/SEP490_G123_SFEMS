package com.g123.sfems.module.system.notification.service;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cài đặt gửi thông báo: quản trị bật / tắt từng loại trên hệ thống và qua email (toàn hệ thống); người dùng
 * bật / tắt email từng loại của mình. Email chỉ đi khi CẢ HAI cùng bật và tài khoản có địa chỉ thư.
 *
 * <p>Cài đặt loại được đọc ở mọi lần phát thông báo, nên giữ trong bộ nhớ và nạp lại khi quản trị sửa (một máy) —
 * máy khác thấy sau tối đa {@link #TTL_MS}.
 */
@Service
public class NotificationSettingsService {

    static final long TTL_MS = 60_000;

    /** Một loại: trên hệ thống, email (toàn hệ thống). */
    public record TypeSetting(NotificationType type, String label, boolean inAppEnabled, boolean emailEnabled,
            boolean inAppOptional) {
    }

    /** Một loại trên màn cài đặt của người dùng. */
    public record Preference(NotificationType type, String label, boolean emailEnabled, boolean emailAllowed) {
    }

    public record TypeSettingChange(NotificationType type, boolean inAppEnabled, boolean emailEnabled) {
    }

    public record PreferenceChange(NotificationType type, boolean emailEnabled) {
    }

    private final JdbcTemplate jdbc;
    private volatile Map<NotificationType, TypeSetting> cache;
    private volatile long loadedAt;

    public NotificationSettingsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ toàn hệ thống

    public List<TypeSetting> typeSettings() {
        return List.copyOf(settings().values());
    }

    public TypeSetting setting(NotificationType type) {
        return settings().get(type);
    }

    @Transactional
    public List<TypeSetting> updateTypeSettings(List<TypeSettingChange> changes, Long actorId) {
        for (TypeSettingChange c : changes) {
            if (c.type() == null) {
                throw new FieldValidationException("type", "Loại thông báo không hợp lệ");
            }
            if (!c.inAppEnabled() && !c.type().inAppOptional()) {
                throw new FieldValidationException("inAppEnabled",
                        "Không tắt được \"" + c.type().label() + "\" trên hệ thống");
            }
            // Tắt trên hệ thống thì email tắt theo.
            boolean email = c.inAppEnabled() && c.emailEnabled();
            jdbc.update("""
                    INSERT INTO notification_type_settings (type, in_app_enabled, email_enabled, updated_at, updated_by_id)
                    VALUES (?, ?, ?, now(), ?)
                    ON CONFLICT (type) DO UPDATE SET in_app_enabled = EXCLUDED.in_app_enabled,
                        email_enabled = EXCLUDED.email_enabled, updated_at = now(), updated_by_id = EXCLUDED.updated_by_id""",
                    c.type().name(), c.inAppEnabled(), email, actorId);
        }
        cache = null;
        return typeSettings();
    }

    // ------------------------------------------------------------------ của từng người

    /** Các loại {@code userType} nhận được, kèm lựa chọn email hiện tại của người đó. */
    public List<Preference> preferences(Long userId, UserType userType) {
        Map<String, Boolean> own = own(userId);
        List<Preference> out = new ArrayList<>();
        for (TypeSetting s : settings().values()) {
            if (!s.type().reaches(userType) || !s.inAppEnabled()) {
                continue;
            }
            boolean email = own.getOrDefault(s.type().name(), s.type().emailByDefault());
            out.add(new Preference(s.type(), s.label(), email && s.emailEnabled(), s.emailEnabled()));
        }
        return out;
    }

    @Transactional
    public List<Preference> updatePreferences(Long userId, UserType userType, List<PreferenceChange> changes) {
        for (PreferenceChange c : changes) {
            if (c.type() == null || !c.type().reaches(userType)) {
                throw new FieldValidationException("type", "Loại thông báo không dành cho tài khoản này");
            }
            if (c.emailEnabled() == c.type().emailByDefault()) {
                jdbc.update("DELETE FROM notification_preferences WHERE user_id = ? AND type = ?", userId,
                        c.type().name());
            } else {
                jdbc.update("""
                        INSERT INTO notification_preferences (user_id, type, email_enabled, updated_at)
                        VALUES (?, ?, ?, now())
                        ON CONFLICT (user_id, type) DO UPDATE SET email_enabled = EXCLUDED.email_enabled, updated_at = now()""",
                        userId, c.type().name(), c.emailEnabled());
            }
        }
        return preferences(userId, userType);
    }

    /** Người này có muốn nhận email loại {@code type} không (chưa xét cài đặt toàn hệ thống). */
    public boolean wantsEmail(Long userId, NotificationType type) {
        List<Boolean> own = jdbc.queryForList(
                "SELECT email_enabled FROM notification_preferences WHERE user_id = ? AND type = ?", Boolean.class,
                userId, type.name());
        return own.isEmpty() ? type.emailByDefault() : own.getFirst();
    }

    private Map<String, Boolean> own(Long userId) {
        Map<String, Boolean> out = new HashMap<>();
        jdbc.query("SELECT type, email_enabled FROM notification_preferences WHERE user_id = ?",
                rs -> {
                    out.put(rs.getString(1), rs.getBoolean(2));
                }, userId);
        return out;
    }

    private Map<NotificationType, TypeSetting> settings() {
        Map<NotificationType, TypeSetting> current = cache;
        if (current != null && System.currentTimeMillis() - loadedAt < TTL_MS) {
            return current;
        }
        Map<String, boolean[]> rows = new HashMap<>();
        jdbc.query("SELECT type, in_app_enabled, email_enabled FROM notification_type_settings",
                rs -> {
                    rows.put(rs.getString(1), new boolean[] {rs.getBoolean(2), rs.getBoolean(3)});
                });
        Map<NotificationType, TypeSetting> loaded = new EnumMap<>(NotificationType.class);
        for (NotificationType t : NotificationType.values()) {
            boolean[] r = rows.get(t.name());
            boolean inApp = r == null || r[0] || !t.inAppOptional();
            boolean email = r == null ? t.emailByDefault() : r[1];
            loaded.put(t, new TypeSetting(t, t.label(), inApp, inApp && email, t.inAppOptional()));
        }
        cache = loaded;
        loadedAt = System.currentTimeMillis();
        return loaded;
    }
}
