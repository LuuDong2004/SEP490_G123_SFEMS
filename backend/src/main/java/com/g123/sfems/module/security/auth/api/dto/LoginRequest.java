package com.g123.sfems.module.security.auth.api.dto;

import com.g123.sfems.shared.security.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /auth/login} payload.
 *
 * <p>The field is called {@code username} but accepts an email address too, so
 * that nobody has to remember which of the two this system decided to key on.
 * No length or format rules: a credential is either right or wrong, and telling
 * someone their guess was too short only helps them guess better.
 */
public record LoginRequest(
        @NotBlank(message = "Nhập tên đăng nhập hoặc email")
        @Size(max = 254, message = "Tên đăng nhập hoặc email tối đa 254 ký tự")
        String username,

        @NotBlank(message = "Nhập mật khẩu")
        @Size(max = 128, message = "Mật khẩu tối đa 128 ký tự")
        String password,

        /** Mã xác thực hai yếu tố — chỉ khi tài khoản đã bật. */
        @Size(max = 64, message = "Mã xác thực không hợp lệ")
        String code,

        /**
         * Khu đăng nhập (docs/kien-truc/11, cổng Admin cách ly): {@code business} (mặc định, {@code /login}) chỉ nhận
         * tài khoản Sở / UBND / trường; {@code admin} ({@code /admin/login}) chỉ nhận tài khoản quản trị hệ thống.
         */
        @Pattern(regexp = AREA_ADMIN + "|" + AREA_BUSINESS, message = "Khu đăng nhập không hợp lệ")
        String area) {

    public static final String AREA_ADMIN = "admin";
    public static final String AREA_BUSINESS = "business";

    /** Mật khẩu bỏ khoảng trắng như lúc đặt, để hai phía so cùng một chuỗi. */
    public LoginRequest {
        username = username == null ? null : username.trim();
        password = PasswordPolicy.strip(password);
        area = area == null || area.isBlank() ? AREA_BUSINESS : area.trim();
    }

    /** Đăng nhập ở khu quản trị. */
    public boolean adminArea() {
        return AREA_ADMIN.equals(area);
    }
}
