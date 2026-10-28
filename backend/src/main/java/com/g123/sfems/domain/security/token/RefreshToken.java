package com.g123.sfems.domain.security.token;

import com.g123.sfems.domain.security.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One issued refresh token, recorded so that it can be taken away again.
 *
 * <p>Access tokens are deliberately unrevocable — that is what makes
 * authorising a request a signature check rather than a query. The refresh
 * token is where revocation lives instead: signing out, rotating on use, or
 * an admin disabling an account all end up here, and the longest a revoked
 * session can outlive the decision is one access token lifetime.
 *
 * <p>{@link #getTokenHash()} is a SHA-256 hex digest of the token that was
 * handed to the client. The token itself is never stored, so a dump of this
 * table cannot be replayed against the refresh endpoint.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Phiên đăng nhập: giữ nguyên qua mỗi lần xoay vòng — token mới của một lần làm mới thuộc cùng phiên (QLTB-242). */
    @Column(name = "session_id", nullable = false, length = 36)
    private String sessionId;

    @Column(name = "session_started_at", nullable = false)
    private Instant sessionStartedAt;

    /** IP và trình duyệt của lần dùng gần nhất — để người dùng nhận ra phiên nào là của mình. */
    @Column(name = "ip", length = 64)
    private String ip;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    protected RefreshToken() {
        // for JPA
    }

    public RefreshToken(User user, String tokenHash, Instant expiresAt, String sessionId, Instant sessionStartedAt,
            String ip, String userAgent) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.sessionId = sessionId;
        this.sessionStartedAt = sessionStartedAt;
        this.ip = ip;
        this.userAgent = userAgent;
    }

    public String getSessionId() {
        return sessionId;
    }

    public Instant getSessionStartedAt() {
        return sessionStartedAt;
    }

    public String getIp() {
        return ip;
    }

    public String getUserAgent() {
        return userAgent;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    /** True while the token may still be exchanged for a new access token. */
    public boolean isUsable(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void revoke(Instant when) {
        if (revokedAt == null) {
            revokedAt = when;
        }
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
