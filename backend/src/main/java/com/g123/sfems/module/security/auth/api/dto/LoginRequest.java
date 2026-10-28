package com.g123.sfems.module.security.auth.api.dto;

import com.g123.sfems.shared.security.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;

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
        String username,

        @NotBlank(message = "Nhập mật khẩu")
        String password,

        /** Mã xác thực hai yếu tố — chỉ khi tài khoản đã bật. */
        String code) {

    /** Mật khẩu bỏ khoảng trắng như lúc đặt (QLTB-508), để hai phía so cùng một chuỗi. */
    public LoginRequest {
        username = username == null ? null : username.trim();
        password = PasswordPolicy.strip(password);
    }
}
