package com.g123.sfems.module.security.token.repo;

import com.g123.sfems.domain.security.token.RefreshToken;
import com.g123.sfems.domain.security.user.User;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** Looks a presented token up by its digest; the token itself is never stored. */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Như trên, khoá dòng: hai lần làm mới đồng thời bằng cùng một token thì lần sau thấy nó đã bị đốt. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :tokenHash")
    Optional<RefreshToken> lockByTokenHash(@Param("tokenHash") String tokenHash);

    /** Phiên còn token dùng được — sổ phiên trên Redis hỏi lại đây khi không có câu trả lời của mình. */
    boolean existsBySessionIdAndRevokedAtIsNullAndExpiresAtAfter(String sessionId, Instant now);

    /** Token còn mở của một phiên. */
    List<RefreshToken> findBySessionIdAndRevokedAtIsNull(String sessionId);

    List<RefreshToken> findByUserAndRevokedAtIsNull(User user);

    /** Token còn dùng được của một tài khoản — mỗi cái là một phiên đang mở (QLTB-242). */
    @Query("select t from RefreshToken t where t.user.id = :userId and t.revokedAt is null and t.expiresAt > :now"
            + " order by t.createdAt desc")
    List<RefreshToken> findOpen(@Param("userId") Long userId, @Param("now") Instant now);

    /**
     * Drops tokens that are already spent, so the table does not grow forever.
     *
     * <p>A revoked or expired row has no further effect on any decision — the
     * only thing it could still answer is "was this token ever used", which
     * nothing asks.
     */
    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :before or t.revokedAt is not null")
    int deleteSpent(@Param("before") Instant before);
}
