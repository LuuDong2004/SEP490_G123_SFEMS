package com.g123.sfems.module.security.auth.api;

import com.g123.sfems.module.security.auth.api.dto.AuthoritiesResponse;
import com.g123.sfems.module.security.auth.api.dto.ChangePasswordRequest;
import com.g123.sfems.module.security.auth.api.dto.CurrentUserResponse;
import com.g123.sfems.module.security.auth.api.dto.LoginRequest;
import com.g123.sfems.module.security.auth.api.dto.RefreshRequest;
import com.g123.sfems.module.security.auth.api.dto.TokenResponse;
import com.g123.sfems.module.security.auth.service.AuthService;
import com.g123.sfems.module.security.token.service.RefreshTokenService.Client;
import com.g123.sfems.module.security.user.service.PasswordResetService;
import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.shared.security.ActivityActor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/auth} — signing in and everything that follows from it.
 *
 * <p>Not a Refine resource: none of these are list, create or update, and the
 * data provider never sees them. The admin UI's auth provider calls them
 * directly, which is why the payload shapes here are the auth provider's
 * contract rather than the data provider's dialect.
 *
 * <p>{@code login}, {@code refresh} and {@code logout} are open in
 * {@code SecurityConfig}, because they are precisely the three things you must
 * be able to do without a valid access token. {@code me} and
 * {@code change-password} need one, and no permission beyond that: every
 * account may read and change its own.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService service;
    private final PasswordResetService passwordReset;

    public AuthController(AuthService service, PasswordResetService passwordReset) {
        this.service = service;
        this.passwordReset = passwordReset;
    }

    public record ForgotPasswordRequest(String login) {
    }

    public record ResetPasswordRequest(String token, String newPassword) {
    }

    /**
     * Quên mật khẩu (QLTB-509) — MỞ, không cần đăng nhập. Luôn trả cùng một câu, dù tài khoản có tồn tại hay
     * không: form này không được thành chỗ dò tài khoản.
     */
    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        passwordReset.request(request.login());
        return Map.of("success", true,
                "message", "Nếu tài khoản có email, link đặt lại mật khẩu đã được gửi tới đó. Kiểm tra hộp thư trong vài phút.");
    }

    /** Đặt mật khẩu mới bằng link trong thư — MỞ; token là thứ chứng minh quyền. */
    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@RequestBody ResetPasswordRequest request) {
        passwordReset.reset(request.token(), PasswordPolicy.strip(request.newPassword()));
        return Map.of("success", true);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        // Ghi trước: đăng nhập SAI ném lỗi, nhật ký vẫn cần biết tên đăng nhập đã gõ.
        ActivityActor.name(http, request.username());
        TokenResponse token = service.login(request, client(http));
        ActivityActor.id(http, token.user().id());
        return token;
    }

    /**
     * Trades a refresh token for a new pair.
     *
     * <p>The token sent here is burned whether or not the call succeeds, so the
     * client has to store what comes back — see {@code TokenResponse}.
     */
    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest http) {
        return service.refresh(request.refreshToken(), client(http));
    }

    /** Phiên đăng nhập đang mở của chính mình (QLTB-242). */
    @GetMapping("/sessions")
    public List<AuthService.MySession> sessions() {
        return service.mySessions();
    }

    /** Đăng xuất một phiên của chính mình. */
    @DeleteMapping("/sessions/{sessionId}")
    public Map<String, Object> endSession(@PathVariable String sessionId) {
        return Map.of("success", service.endMySession(sessionId));
    }

    /** Đăng xuất mọi thiết bị khác, giữ phiên đang dùng. */
    @PostMapping("/sessions/end-others")
    public Map<String, Object> endOtherSessions() {
        return Map.of("ended", service.endOtherSessions());
    }

    /** IP (qua proxy thì phần đầu của X-Forwarded-For) và trình duyệt của request — ghi lên phiên. */
    static Client client(HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : http.getRemoteAddr();
        return new Client(ip, http.getHeader("User-Agent"));
    }

    /**
     * Ends the session and answers 200 whatever it was given.
     *
     * <p>A body rather than {@code 204}: the admin UI parses the response of
     * every call it makes, and an empty one reads as a failure.
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@RequestBody(required = false) RefreshRequest request,
            HttpServletRequest http) {
        ActivityActor.id(http, service.logout(request == null ? null : request.refreshToken()));
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** Who the caller is, re-read from the database rather than from the token. */
    @GetMapping("/me")
    public CurrentUserResponse me() {
        return service.me();
    }

    /**
     * What the caller may do — their role codes and every permission those
     * roles grant.
     *
     * <p>Its own call rather than fields on {@code me} or claims in the token.
     * The access token deliberately carries no permissions, so this is where the
     * admin UI learns what to offer; it asks once after signing in and again
     * after each token refresh, then answers every {@code can} question from
     * what it cached.
     *
     * <p>No permission of its own: every account may read its own grants, and
     * an account that could not would have no way to render a menu.
     */
    @GetMapping("/permissions")
    public AuthoritiesResponse permissions() {
        return service.authorities();
    }

    /**
     * Changes the caller's own password.
     *
     * <p>Answers with a fresh token pair, because the change ends every other
     * session under the account — including, without this, the one that asked
     * for it.
     */
    @PostMapping("/change-password")
    public TokenResponse changePassword(@Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest http) {
        return service.changePassword(request, client(http));
    }
}
