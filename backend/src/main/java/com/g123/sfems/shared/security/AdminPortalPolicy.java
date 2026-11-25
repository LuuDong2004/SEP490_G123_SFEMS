package com.g123.sfems.shared.security;

import com.g123.sfems.domain.security.user.SystemUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserType;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

/**
 * Luật của cổng Admin cách ly (docs/kien-truc/11, quyết định 4): IP được phép, bắt buộc lớp xác thực thứ hai, phiên
 * ngắn. Một chỗ cho cả đăng nhập ({@code AuthService}), bộ chặn yêu cầu ({@code AdminPortalGuard}) và nơi cấp token
 * ({@link JwtService}, {@code RefreshTokenService}).
 *
 * <p>IP là {@code getRemoteAddr()}: sau proxy, Tomcat đã thay nó bằng IP thật lấy từ {@code X-Forwarded-For} của
 * proxy tin cậy ({@code server.forward-headers-strategy=native}, dải nội bộ). Không đọc header đó ở đây — đọc là tin
 * chữ client tự khai.
 */
@Component
public class AdminPortalPolicy {

    private final AdminPortalProperties properties;
    private final List<IpAddressMatcher> allowed;

    public AdminPortalPolicy(AdminPortalProperties properties) {
        this.properties = properties;
        // Sai cú pháp thì không khởi động: một danh sách IP gõ hỏng mà bị bỏ qua là cổng mở toang.
        this.allowed = properties.adminAllowedIps().stream().map(IpAddressMatcher::new).toList();
    }

    /** IP này được vào khu quản trị không. Danh sách rỗng = không giới hạn. */
    public boolean ipAllowed(String ip) {
        if (allowed.isEmpty()) {
            return true;
        }
        if (ip == null || ip.isBlank()) {
            return false;
        }
        try {
            return allowed.stream().anyMatch(matcher -> matcher.matches(ip));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * IP này có được dùng tài khoản quản trị {@code user} không: qua danh sách chung, VÀ qua danh sách riêng của người
     * đó nếu có ({@code user_systems.allowed_ips}). Tài khoản loại khác chỉ theo danh sách chung của khu quản trị.
     */
    public boolean ipAllowed(User user, String ip) {
        if (!ipAllowed(ip)) {
            return false;
        }
        return !(user instanceof SystemUser admin) || AdminIps.matches(admin.allowedIpList(), ip);
    }

    /** Có bắt buộc lớp xác thực thứ hai cho tài khoản SYSTEM không ({@code app.portal.admin-mfa-required}). */
    public boolean mfaRequired() {
        return properties.adminMfaRequired();
    }

    /** Tài khoản này còn phải bật lớp thứ hai trước khi dùng được gì khác. */
    public boolean secondFactorMissing(UserType type, boolean secondFactor) {
        return type == UserType.SYSTEM && properties.adminMfaRequired() && !secondFactor;
    }

    /** Hạn access token: tài khoản SYSTEM dùng hạn ngắn riêng (không dài hơn hạn chung). */
    public Duration accessTokenTtl(UserType type, Duration standard) {
        if (type != UserType.SYSTEM) {
            return standard;
        }
        Duration admin = properties.adminAccessTokenTtl();
        return admin.compareTo(standard) < 0 ? admin : standard;
    }

    /**
     * Hạn refresh token cấp lúc {@code now}. Tài khoản SYSTEM: không quá {@code sessionStartedAt + admin-session-ttl}
     * — làm mới xoay token nhưng không kéo phiên quá mốc, hết mốc là đăng nhập lại.
     */
    public Instant refreshExpiry(UserType type, Instant now, Instant sessionStartedAt, Duration standard) {
        Instant normal = now.plus(standard);
        if (type != UserType.SYSTEM) {
            return normal;
        }
        Instant start = sessionStartedAt == null ? now : sessionStartedAt;
        Instant cap = start.plus(properties.adminSessionTtl());
        return cap.isBefore(normal) ? cap : normal;
    }
}
