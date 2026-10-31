package com.g123.sfems.module.security.token.service;

import com.g123.sfems.domain.security.token.RefreshToken;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.token.repo.RefreshTokenRepository;
import com.g123.sfems.shared.cache.SharedCache;
import com.g123.sfems.shared.security.JwtProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issues, rotates and revokes refresh tokens.
 *
 * <p>Its own feature rather than a part of {@code auth}, because the user
 * feature needs it too: disabling an account or resetting its password has to
 * end the sessions already open under it. Keeping it separate is what lets both
 * {@code AuthService} and {@code UserService} depend on it without the two of
 * them depending on each other.
 *
 * <p>The token is 32 random bytes, not a JWT. There is nothing to read inside
 * it — its only job is to be unguessable and to name a row in this table — so
 * signing and claims would be weight without purpose.
 */
@Service
@Transactional(readOnly = true)
public class RefreshTokenService {

    /** 256 bits of entropy: not guessable, and short enough to sit in a header. */
    private static final int TOKEN_BYTES = 32;

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

    /**
     * Token đã đốt mà được trình lại trong khoảng này thì coi là hai tab cùng làm mới bằng một token (chúng dùng
     * chung localStorage) — từ chối, không phạt. Muộn hơn là dấu hiệu token bị đánh cắp: thu hồi cả phiên.
     */
    static final Duration REUSE_GRACE = Duration.ofSeconds(60);

    private final RefreshTokenRepository repository;
    private final JwtProperties properties;
    private final SharedCache shared;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository repository, JwtProperties properties, SharedCache shared) {
        this.repository = repository;
        this.properties = properties;
        this.shared = shared;
    }

    /**
     * Mints a token for {@code user} and returns it in the clear.
     *
     * <p>This is the only moment the raw value exists on the server. What is
     * stored is its SHA-256, so a dump of the table cannot be replayed against
     * the refresh endpoint.
     */
    @Transactional
    public String issue(User user, Instant now, Session session, Client client) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        repository.save(new RefreshToken(user, hash(raw), now.plus(properties.refreshTokenTtl()), session.id(),
                session.startedAt(), truncate(client.ip(), 64), truncate(client.userAgent(), 300)));
        opened(session.id(), now.plus(properties.refreshTokenTtl()), now);
        return raw;
    }

    // ------------------------------------------------------------------ sổ phiên dùng chung (Redis)

    /**
     * Phiên còn mở không — hỏi ở mỗi yêu cầu mang access token có {@code sid}, để đăng xuất, đăng xuất phiên khác,
     * khoá tài khoản hay đổi mật khẩu cắt phiên NGAY trên mọi node, không đợi access token hết 15 phút.
     *
     * <p>Sổ nằm ở Redis ({@code session:<sid>} = {@code 1} mở / {@code 0} đã đóng); CSDL vẫn là nguồn sự thật. Sổ
     * không có câu trả lời (Redis khởi động lại, bỏ khoá khi đầy) thì hỏi bảng refresh token rồi ghi lại vào sổ.
     * Không có Redis thì không hỏi gì — trả {@code true}, như trước khi có sổ.
     */
    // NOT_SUPPORTED đè @Transactional(readOnly) của lớp: chạy ở MỌI yêu cầu, và trúng sổ thì không được mượn kết
    // nối CSDL nào. Hỏi CSDL (trượt sổ) thì câu của repository tự mở giao dịch ngắn của nó.
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public boolean isSessionOpen(String sessionId, Instant now) {
        if (sessionId == null || !shared.available()) {
            return true;
        }
        String mark = shared.getRaw(SESSION + sessionId);
        if (mark != null) {
            return OPEN.equals(mark);
        }
        boolean open = repository.existsBySessionIdAndRevokedAtIsNullAndExpiresAtAfter(sessionId, now);
        if (open) {
            shared.putRawIfAbsent(SESSION + sessionId, OPEN, SESSION_MARK);
        } else {
            shared.putRaw(SESSION + sessionId, CLOSED, properties.accessTokenTtl());
        }
        return open;
    }

    private static final String SESSION = "session:";
    private static final String OPEN = "1";
    private static final String CLOSED = "0";
    /** Cờ "mở" sống ngắn hơn phiên: hết hạn thì hỏi lại CSDL một lần, không giữ cờ sai lâu. */
    private static final Duration SESSION_MARK = Duration.ofHours(1);

    private void opened(String sessionId, Instant expiresAt, Instant now) {
        Duration left = Duration.between(now, expiresAt);
        Duration ttl = left.compareTo(SESSION_MARK) < 0 ? left : SESSION_MARK;
        // Không đè: phiên vừa bị đóng ("0") mà một lần làm mới chậm chân ghi "1" sau thì phiên sống lại.
        shared.afterCommit(() -> shared.putRawIfAbsent(SESSION + sessionId, OPEN, ttl));
    }

    /** Cờ "đã đóng" chỉ cần sống bằng access token dài nhất còn có thể mang {@code sid} này. */
    private void closed(String sessionId) {
        shared.afterCommit(() -> shared.putRaw(SESSION + sessionId, CLOSED, properties.accessTokenTtl()));
    }

    /** Một phiên đăng nhập: mã phiên và lúc mở. Đăng nhập mở phiên mới; làm mới token đi tiếp phiên cũ. */
    public record Session(String id, Instant startedAt) {

        public static Session open(Instant now) {
            return new Session(UUID.randomUUID().toString(), now);
        }
    }

    /** Máy đang gọi — IP và trình duyệt — ghi lên token để người dùng nhận ra phiên của mình. */
    public record Client(String ip, String userAgent) {

        public static final Client UNKNOWN = new Client(null, null);
    }

    /** Một phiên đang mở, như màn "Phiên đăng nhập" hiện ra. {@code lastActiveAt}: lần làm mới token gần nhất. */
    public record SessionView(String sessionId, Instant startedAt, Instant lastActiveAt, Instant expiresAt, String ip,
            String userAgent) {
    }

    /** Các phiên đang mở của một tài khoản, mới dùng nhất trước. */
    @Transactional(readOnly = true)
    public List<SessionView> sessions(Long userId, Instant now) {
        return repository.findOpen(userId, now).stream()
                .map(t -> new SessionView(t.getSessionId(), t.getSessionStartedAt(), t.getCreatedAt(), t.getExpiresAt(),
                        t.getIp(), t.getUserAgent()))
                .toList();
    }

    /** Đăng xuất MỘT phiên của tài khoản (thu hồi token đang mở của phiên đó). Trả {@code false} nếu không có. */
    @Transactional
    public boolean revokeSession(Long userId, String sessionId, Instant now) {
        List<RefreshToken> open = repository.findOpen(userId, now).stream()
                .filter(t -> t.getSessionId().equals(sessionId)).toList();
        open.forEach(t -> t.revoke(now));
        repository.saveAll(open);
        closed(sessionId);
        return !open.isEmpty();
    }

    /** Đăng xuất mọi phiên KHÁC của tài khoản, giữ phiên đang dùng. Trả số phiên đã đăng xuất. */
    @Transactional
    public int revokeOtherSessions(Long userId, String keepSessionId, Instant now) {
        List<RefreshToken> open = repository.findOpen(userId, now).stream()
                .filter(t -> !t.getSessionId().equals(keepSessionId)).toList();
        open.forEach(t -> t.revoke(now));
        repository.saveAll(open);
        open.stream().map(RefreshToken::getSessionId).distinct().forEach(this::closed);
        return (int) open.stream().map(RefreshToken::getSessionId).distinct().count();
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    /**
     * Exchanges a presented token for the user it belongs to, and burns it.
     *
     * <p>Rotation on every use is what makes a stolen refresh token detectable
     * in principle and short-lived in practice: the thief and the legitimate
     * client cannot both keep using it, because the first one to refresh
     * invalidates the copy the other holds.
     *
     * @throws BadCredentialsException if the token is unknown, already used,
     *                                 revoked or expired — all four are the
     *                                 same answer to whoever presented it.
     */
    /**
     * Thu hồi phiên khi thấy token bị dùng lại nằm trong CHÍNH giao dịch này, nên người gọi phải để giao dịch commit
     * khi từ chối ({@code noRollbackFor} — {@code AuthService.refresh} cũng vậy).
     */
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public RefreshToken consume(String rawToken, Instant now) {
        RefreshToken token = repository.lockByTokenHash(hash(rawToken))
                .orElseThrow(RefreshTokenService::expired);
        if (!token.isUsable(now)) {
            if (token.getRevokedAt() != null && token.getRevokedAt().isBefore(now.minus(REUSE_GRACE))) {
                revokeReusedSession(token, now);
            }
            throw expired();
        }

        token.revoke(now);
        repository.save(token);
        return token;
    }

    private static BadCredentialsException expired() {
        return new BadCredentialsException("Phiên đăng nhập đã hết hạn — hãy đăng nhập lại");
    }

    /**
     * Token đã thu hồi lại được trình: một trong hai bên — người dùng hay kẻ giữ bản sao — đang cầm token cũ, và
     * không biết bên nào. Đóng cả phiên, cả hai cùng phải đăng nhập lại; người thật đăng nhập được, kẻ kia thì không.
     */
    private void revokeReusedSession(RefreshToken reused, Instant now) {
        String sessionId = reused.getSessionId();
        List<RefreshToken> open = repository.findBySessionIdAndRevokedAtIsNull(sessionId);
        open.forEach(t -> t.revoke(now));
        repository.saveAll(open);
        closed(sessionId);
        log.warn("Refresh token đã thu hồi bị dùng lại — đóng phiên {} của tài khoản {}", sessionId,
                reused.getUser().getId());
    }

    /** Ends one session. Unknown tokens are ignored: signing out cannot fail. */
    @Transactional
    /** Thu hồi một refresh token; trả id tài khoản của nó (rỗng nếu token không có) — cho nhật ký đăng xuất. */
    public Long revoke(String rawToken, Instant now) {
        Optional<RefreshToken> token = repository.findByTokenHash(hash(rawToken));
        token.ifPresent(found -> {
            found.revoke(now);
            repository.save(found);
            closed(found.getSessionId());
        });
        return token.map(t -> t.getUser().getId()).orElse(null);
    }

    /**
     * Ends every session open under an account.
     *
     * <p>Called when an account is disabled or its password is reset. Access
     * tokens already issued keep working until they expire — that is the
     * trade-off stateless authorisation makes — so the window this closes is
     * bounded by {@code app.security.jwt.access-token-ttl}, not by zero.
     */
    @Transactional
    public void revokeAllFor(User user, Instant now) {
        List<RefreshToken> open = repository.findByUserAndRevokedAtIsNull(user);
        open.forEach(token -> token.revoke(now));
        repository.saveAll(open);
        open.stream().map(RefreshToken::getSessionId).distinct().forEach(this::closed);
    }

    /** Housekeeping: removes rows that can no longer affect any decision. */
    @Transactional
    public int purgeSpent(Instant now) {
        return repository.deleteSpent(now);
    }

    private static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required of every Java platform; if it is missing the
            // JVM is broken in a way no fallback here could paper over.
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
