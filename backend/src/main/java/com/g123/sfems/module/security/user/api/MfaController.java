package com.g123.sfems.module.security.user.api;

import com.g123.sfems.module.security.user.service.EmailMfaService;
import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Xác thực qua email của CHÍNH người đang đăng nhập ({@code /api/auth/mfa}) — ai cũng tự bật được cho mình, như tự
 * đổi mật khẩu.
 */
@RestController
public class MfaController {

    public record EmailToggle(
            boolean enabled,

            @Size(max = 128, message = "Mật khẩu tối đa 128 ký tự")
            String password) {
    }

    private final EmailMfaService emailMfa;

    public MfaController(EmailMfaService emailMfa) {
        this.emailMfa = emailMfa;
    }

    @GetMapping("/api/auth/mfa")
    public EmailMfaService.Status status() {
        return emailMfa.status(me());
    }

    /** Bật / tắt xác thực qua email cho chính mình — phải nhập lại mật khẩu. */
    @PostMapping("/api/auth/mfa/email")
    public EmailMfaService.Status email(@Valid @RequestBody EmailToggle request) {
        return emailMfa.setEnabled(me(), request.enabled(), PasswordPolicy.strip(request.password()));
    }

    private static Long me() {
        return CurrentUser.id().orElseThrow(() -> new InsufficientAuthenticationException("Chưa đăng nhập"));
    }
}
