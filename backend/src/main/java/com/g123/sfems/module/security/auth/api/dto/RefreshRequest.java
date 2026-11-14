package com.g123.sfems.module.security.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /auth/refresh} and {@code POST /auth/logout} payload.
 *
 * <p>The refresh token travels in the body rather than in the
 * {@code Authorization} header, because the header on those two calls is either
 * absent or holds an access token that has already expired.
 */
public record RefreshRequest(
        @NotBlank(message = "Thiếu mã làm mới phiên đăng nhập")
        @Size(max = 512, message = "Mã làm mới phiên đăng nhập không hợp lệ")
        String refreshToken) {
}
