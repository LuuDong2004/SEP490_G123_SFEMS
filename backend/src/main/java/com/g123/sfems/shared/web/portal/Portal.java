package com.g123.sfems.shared.web.portal;

import com.g123.sfems.domain.security.user.UserType;

/**
 * Cổng API theo loại tài khoản (docs/kien-truc/11): {@code /api/admin/**}, {@code /api/so/**}, {@code /api/ubnd/**},
 * {@code /api/school/**}. {@code SecurityConfig} chỉ cho đúng loại tài khoản đi qua cổng của nó — sai loại là 403
 * trước mọi kiểm tra quyền.
 */
public enum Portal {
    ADMIN("admin", UserType.SYSTEM),
    SO("so", UserType.SO),
    SCHOOL("school", UserType.SCHOOL);

    private final String prefix;
    private final UserType userType;

    Portal(String prefix, UserType userType) {
        this.prefix = prefix;
        this.userType = userType;
    }

    /** Đoạn đường dẫn của cổng: {@code /api/<prefix>/...}. */
    public String prefix() {
        return prefix;
    }

    /** Loại tài khoản duy nhất được vào cổng này. */
    public UserType userType() {
        return userType;
    }

    /** {@code /api/<prefix>/**} — mẫu cho SecurityConfig. */
    public String pattern() {
        return "/api/" + prefix + "/**";
    }
}
