package com.g123.sfems.module.security.auth.api.dto;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.service.MfaService;
import java.time.Instant;

/**
 * The signed-in identity, as {@code GET /auth/me} and every token response
 * report it.
 *
 * <p>Identity only: who the account is, not what it may do. Roles and
 * permissions are a separate payload behind a separate endpoint
 * ({@link AuthoritiesResponse}, {@code GET /auth/permissions}), for the same
 * reason they are no longer stamped into the access token — they grow with the
 * permission model, and the things that read an identity (an account menu, a
 * profile header) do not need them.
 *
 * <p>Narrower than the user resource's own response and declared separately
 * rather than imported: this is the shape of "who am I", and widening what an
 * administrator can see about somebody else should not widen it.
 */
public record CurrentUserResponse(
        Long id,
        String username,
        String email,
        String fullName,
        /** Đã bật xác thực hai yếu tố. */
        boolean mfaEnabled,
        /** Tài khoản đặc quyền — phải bật; màn hình nhắc cho tới khi bật. */
        boolean mfaRequired,
        /** Đã có lớp xác thực thứ hai nào chưa — ứng dụng (TOTP) hoặc mã qua email. */
        boolean secondFactor,
        /** Lần đổi mật khẩu gần nhất — màn hình nhắc đổi khi quá lâu (QLTB-243). */
        Instant passwordChangedAt) {

    public static CurrentUserResponse from(User user) {
        return new CurrentUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.isMfaEnabled(),
                MfaService.required(user),
                user.isMfaEnabled() || user.isMfaEmail(),
                user.getPasswordChangedAt());
    }
}
