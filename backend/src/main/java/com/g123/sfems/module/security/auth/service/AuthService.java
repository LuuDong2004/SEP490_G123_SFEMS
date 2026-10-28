package com.g123.sfems.module.security.auth.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.auth.api.dto.AuthoritiesResponse;
import com.g123.sfems.module.security.auth.api.dto.ChangePasswordRequest;
import com.g123.sfems.module.security.auth.api.dto.CurrentUserResponse;
import com.g123.sfems.module.security.auth.api.dto.LoginRequest;
import com.g123.sfems.module.security.auth.api.dto.TokenResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.security.token.RefreshToken;
import com.g123.sfems.module.security.token.service.RefreshTokenService;
import com.g123.sfems.module.security.token.service.RefreshTokenService.Client;
import com.g123.sfems.module.security.token.service.RefreshTokenService.Session;
import com.g123.sfems.module.security.token.service.RefreshTokenService.SessionView;
import com.g123.sfems.module.security.user.service.EmailMfaService;
import com.g123.sfems.module.security.user.service.LoginGuard;
import com.g123.sfems.module.security.user.service.MfaService;
import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.shared.security.MfaRequiredException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Signing in, renewing and signing out.
 *
 * <p>The pair of tokens it hands out divide the work deliberately. The access
 * token is short-lived and says only who the caller is, so it stays the same
 * size however large the permission model grows. The refresh token is
 * long-lived, opaque and recorded, which is what makes ending a session
 * possible at all. Neither property is achievable in one token.
 *
 * <p>Neither token says what the caller may do. That is answered separately, by
 * {@link #authorities()} for the UI and by {@code AuthorizationService} for the
 * API itself.
 */
@Service
@Transactional(readOnly = true)
public class AuthService {

    /**
     * Hash of nothing in particular, used to keep a failed sign-in as slow as a
     * successful one.
     *
     * <p>Without it, an unknown username returns immediately while a known one
     * pays for a BCrypt comparison first — a difference large enough to time
     * from across a network, which turns the login form into a way to enumerate
     * accounts. Verifying against this dummy hash spends the same work either
     * way.
     */
    private static final String DUMMY_HASH =
            "$2a$10$ff7CTQvwMv0Szb.qGXF3zeMUkV8Jjta52A6kYzGDeZY4YE2pyd.YS";

    /** The same answer for every way of failing, for the same reason. */
    private static final String INVALID_CREDENTIALS = "Sai tên đăng nhập hoặc mật khẩu";

    private final UserService userService;
    private final RefreshTokenService refreshTokenService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    // Answers "what may this account do" from memory. Reading it here rather
    // than from the User row is what stops /auth/permissions resolving the same
    // account twice — once in the converter that authenticated the request, and
    // once again to build the reply.
    private final AuthorizationService authorizationService;

    private final MfaService mfaService;
    private final EmailMfaService emailMfa;
    private final LoginGuard loginGuard;

    // Which resources this account is genuinely narrowed on, so that an empty
    // list can say why it is empty rather than looking like a system with no
    // data in it. Answered from the policy cache, so it costs no query either.
    private final RowLevelSecurity rowLevel;

    public AuthService(UserService userService,
                       RefreshTokenService refreshTokenService,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder,
                       AuthorizationService authorizationService,
                       RowLevelSecurity rowLevel,
                       MfaService mfaService,
                       EmailMfaService emailMfa,
                       LoginGuard loginGuard) {
        this.emailMfa = emailMfa;
        this.loginGuard = loginGuard;
        this.userService = userService;
        this.refreshTokenService = refreshTokenService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.authorizationService = authorizationService;
        this.rowLevel = rowLevel;
        this.mfaService = mfaService;
    }

    /**
     * Verifies credentials and opens a session.
     *
     * @throws BadCredentialsException on a wrong username, a wrong password or
     *                                 an account that is not active — the same
     *                                 exception and the same message for all
     *                                 three, so that a failed attempt reveals
     *                                 nothing about which accounts exist
     */
    @Transactional
    public TokenResponse login(LoginRequest request, Client client) {
        Optional<User> found = userService.findForAuthentication(request.username());
        Instant now = Instant.now();

        // Đang khoá tạm (sai mật khẩu 5 lần, QLTB-509): từ chối trước khi so mật khẩu, kể cả mật khẩu đúng.
        found.filter(User::canSignIn).ifPresent(candidate -> loginGuard.requireNotLocked(candidate, now));

        String hash = found.map(User::getPasswordHash).orElse(DUMMY_HASH);
        boolean passwordMatches = passwordEncoder.matches(request.password(), hash);

        if (found.isPresent() && found.get().canSignIn() && !passwordMatches) {
            // Đếm trong giao dịch riêng; lần thứ 5 thì khoá 15 phút và câu báo nói rõ điều đó.
            loginGuard.recordFailure(found.get().getId(), INVALID_CREDENTIALS);
        }
        User user = found
                .filter(candidate -> passwordMatches)
                .filter(User::canSignIn)
                .orElseThrow(() -> new BadCredentialsException(INVALID_CREDENTIALS));

        // Hai yếu tố hỏi SAU mật khẩu: một người không biết mật khẩu không được
        // biết tài khoản này có bật xác thực hai yếu tố hay không.
        boolean noCode = request.code() == null || request.code().isBlank();
        if (user.isMfaEnabled()) {
            if (noCode) {
                throw new MfaRequiredException();
            }
            mfaService.verifyForLogin(user.getId(), request.code());
        } else if (user.isMfaEmail()) {
            // Qua email: chưa có mã thì gửi mã rồi báo màn hình hiện ô nhập (QLTB-509).
            if (noCode) {
                emailMfa.sendForLogin(user.getId());
            }
            emailMfa.verifyForLogin(user.getId(), request.code());
        }

        loginGuard.recordSuccess(user);
        userService.recordLogin(user, now);
        return issue(user, now, Session.open(now), client);
    }

    /**
     * Exchanges a refresh token for a new pair.
     *
     * <p>Re-reads the account rather than trusting the old token's claims, so a
     * role change or a disabled account takes effect on the next refresh
     * instead of surviving as long as the session does.
     */
    @Transactional
    public TokenResponse refresh(String refreshToken, Client client) {
        Instant now = Instant.now();
        RefreshToken used = refreshTokenService.consume(refreshToken, now);
        User user = used.getUser();

        if (!user.canSignIn()) {
            // The account was disabled while the session was open. Consuming
            // the token above already burned it, so this ends the session.
            throw new BadCredentialsException("Tài khoản này đã bị khoá");
        }
        // Đi tiếp CÙNG phiên: token mới của lần làm mới vẫn là phiên đã mở lúc đăng nhập (QLTB-242).
        return issue(user, now, new Session(used.getSessionId(), used.getSessionStartedAt()), client);
    }

    /**
     * Ends one session.
     *
     * <p>Never fails, whatever it is handed: signing out has to work from a
     * client whose token is already expired, already revoked, or simply
     * garbage. Reporting an error would only leave the UI unsure whether it may
     * clear its stored tokens — and it may, always.
     */
    @Transactional
    /** Trả id tài khoản vừa đăng xuất (rỗng nếu token không có / đã hỏng) — cho nhật ký hoạt động. */
    public Long logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            return refreshTokenService.revoke(refreshToken, Instant.now());
        }
        return null;
    }

    /** The signed-in identity, re-read from the database rather than from the token. */
    public CurrentUserResponse me() {
        return CurrentUserResponse.from(currentUser());
    }

    /**
     * The roles and permission codes the caller currently holds.
     *
     * <p>The client asks for this once it has a token, instead of unpacking it
     * from one: the token carries no permissions any more, so this is where the
     * UI first learns what to offer. After that it is told — over the live
     * channel, or by the {@code X-Auth-Version} stamp on any response — and only
     * comes back here when it has nothing cached.
     *
     * <p>Answered from {@link AuthorityCache}, so it reflects a role changed a
     * second ago without costing a query.
     */
    public AuthoritiesResponse authorities() {
        Long id = CurrentUser.id().orElseThrow(() -> new BadCredentialsException("Chưa đăng nhập"));
        return authorizationService.entryOf(id)
                .map(entry -> AuthoritiesResponse.from(entry, rowLevel.scopedResourcesFor(id)))
                .orElseThrow(() -> new BadCredentialsException("Tài khoản này không còn tồn tại"));
    }

    /**
     * Changes the signed-in user's own password and issues a fresh pair.
     *
     * <p>Every other session under the account ends. Handing back a new pair
     * here is what stops that from signing out the person who just made the
     * change.
     */
    @Transactional
    public TokenResponse changePassword(ChangePasswordRequest request, Client client) {
        User user = currentUser();
        User updated = userService.changeOwnPassword(
                user.getId(), request.currentPassword(), request.newPassword());
        Instant now = Instant.now();
        // Giữ mã phiên đang dùng: đổi mật khẩu đăng xuất các phiên KHÁC, không phải phiên này.
        Session session = CurrentUser.sessionId().map(id -> new Session(id, now)).orElseGet(() -> Session.open(now));
        return issue(updated, now, session, client);
    }

    /** Các phiên đang mở của chính mình (QLTB-242); phiên của request này được đánh dấu. */
    @Transactional(readOnly = true)
    public List<MySession> mySessions() {
        Long id = currentUser().getId();
        String current = CurrentUser.sessionId().orElse(null);
        return refreshTokenService.sessions(id, Instant.now()).stream()
                .map(s -> new MySession(s, s.sessionId().equals(current)))
                .toList();
    }

    public record MySession(@JsonUnwrapped SessionView session, boolean current) {
    }

    /** Đăng xuất một phiên của chính mình — thiết bị kia mất phiên ở lần làm mới token kế tiếp (tối đa 15 phút). */
    @Transactional
    public boolean endMySession(String sessionId) {
        return refreshTokenService.revokeSession(currentUser().getId(), sessionId, Instant.now());
    }

    /** Đăng xuất mọi phiên khác của chính mình, giữ phiên đang dùng. */
    @Transactional
    public int endOtherSessions() {
        return refreshTokenService.revokeOtherSessions(currentUser().getId(),
                CurrentUser.sessionId().orElse(""), Instant.now());
    }

    private TokenResponse issue(User user, Instant now, Session session, Client client) {
        return TokenResponse.of(
                jwtService.issueAccessToken(user, now, session.id()),
                refreshTokenService.issue(user, now, session, client),
                jwtService.accessTokenTtlSeconds(),
                CurrentUserResponse.from(user));
    }

    /**
     * The account behind the current request.
     *
     * <p>The id comes from a token this application signed, so an id with no
     * row behind it means the account was deleted mid-session; that is a
     * credentials failure, not a 404 about a resource the caller asked for.
     */
    private User currentUser() {
        Long id = CurrentUser.id()
                .orElseThrow(() -> new BadCredentialsException("Chưa đăng nhập"));
        try {
            return userService.get(id);
        } catch (ResourceNotFoundException e) {
            throw new BadCredentialsException("Tài khoản này không còn tồn tại");
        }
    }
}
