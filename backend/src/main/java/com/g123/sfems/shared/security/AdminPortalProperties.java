package com.g123.sfems.shared.security;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cổng Admin cách ly (docs/kien-truc/11, quyết định 4), đọc từ {@code app.portal.*}.
 *
 * @param adminMfaRequired      tài khoản SYSTEM phải có lớp xác thực thứ hai mới dùng được API (tạm mặc định KHÔNG trong giai đoạn kiểm thử). Bật
 *                              lại bằng {@code APP_PORTAL_ADMIN_MFA_REQUIRED=true}
 * @param adminAllowedIps       IP / dải CIDR được vào khu quản trị (đăng nhập khu Admin, {@code /api/admin/**}, mọi
 *                              yêu cầu mang token SYSTEM); rỗng = không giới hạn
 * @param adminSessionTtl       phiên của tài khoản SYSTEM dài tối đa bao lâu tính từ lúc đăng nhập — làm mới token
 *                              không kéo dài quá mốc này
 * @param adminAccessTokenTtl   hạn access token của tài khoản SYSTEM
 */
@ConfigurationProperties(prefix = "app.portal")
public record AdminPortalProperties(
        Boolean adminMfaRequired,
        List<String> adminAllowedIps,
        Duration adminSessionTtl,
        Duration adminAccessTokenTtl) {

    public AdminPortalProperties {
        adminMfaRequired = adminMfaRequired != null && adminMfaRequired;
        adminAllowedIps = adminAllowedIps == null ? List.of()
                : adminAllowedIps.stream().map(String::trim).filter(ip -> !ip.isEmpty()).toList();
        adminSessionTtl = adminSessionTtl == null ? Duration.ofHours(8) : adminSessionTtl;
        adminAccessTokenTtl = adminAccessTokenTtl == null ? Duration.ofMinutes(5) : adminAccessTokenTtl;
    }
}
