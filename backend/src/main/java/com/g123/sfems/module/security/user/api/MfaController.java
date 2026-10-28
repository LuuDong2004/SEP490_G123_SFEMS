package com.g123.sfems.module.security.user.api;

import com.g123.sfems.module.security.user.service.EmailMfaService;
import com.g123.sfems.module.security.user.service.MfaService;
import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Xác thực hai yếu tố của CHÍNH người đang đăng nhập ({@code /api/auth/mfa/*}) —
 * ai cũng tự bật được cho mình, như tự đổi mật khẩu — và nút đặt lại của quản trị
 * viên cho người khác ({@code POST /api/users/{id}/mfa/reset}).
 */
@RestController
public class MfaController {

    public record CodeRequest(String code) {
    }

    public record EmailToggle(boolean enabled, String password) {
    }

    private final MfaService mfa;
    private final EmailMfaService emailMfa;

    public MfaController(MfaService mfa, EmailMfaService emailMfa) {
        this.mfa = mfa;
        this.emailMfa = emailMfa;
    }

    /** Bật / tắt xác thực hai lớp qua email cho chính mình — phải nhập lại mật khẩu (QLTB-509). */
    @PostMapping("/api/auth/mfa/email")
    public MfaService.Status email(@RequestBody EmailToggle request) {
        emailMfa.setEnabled(me(), request.enabled(), PasswordPolicy.strip(request.password()));
        return mfa.status(me());
    }

    @GetMapping("/api/auth/mfa")
    public MfaService.Status status() {
        return mfa.status(me());
    }

    @PostMapping("/api/auth/mfa/setup")
    public MfaService.Setup setup() {
        return mfa.setup(me());
    }

    @PostMapping("/api/auth/mfa/enable")
    public MfaService.Status enable(@RequestBody CodeRequest request) {
        return mfa.enable(me(), request.code());
    }

    @PostMapping("/api/auth/mfa/disable")
    public MfaService.Status disable(@RequestBody CodeRequest request) {
        return mfa.disable(me(), request.code());
    }

    @PostMapping("/api/users/{id}/mfa/reset")
    @PreAuthorize("hasAuthority('users:write')")
    public Map<String, Object> reset(@PathVariable Long id) {
        mfa.reset(id);
        return Map.of("success", true);
    }

    private static Long me() {
        return CurrentUser.id().orElseThrow(() -> new InsufficientAuthenticationException("Chưa đăng nhập"));
    }
}
