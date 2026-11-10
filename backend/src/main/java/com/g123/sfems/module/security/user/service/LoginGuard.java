package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khoá tạm sau nhiều lần sai mật khẩu (QLTB-509): sai {@value #MAX_FAILURES} lần liên tiếp thì tài khoản khoá
 * 15 phút. Đăng nhập đúng xoá bộ đếm.
 *
 * <p>Lần sai được ghi trong giao dịch RIÊNG ({@code REQUIRES_NEW}): lần đăng nhập ném lỗi làm giao dịch ngoài lùi
 * lại, và nếu đếm trong đó thì bộ đếm không bao giờ tăng — cùng lý do với {@code MfaService.verifyForLogin}.
 */
@Service
@Transactional(readOnly = true)
public class LoginGuard {

    public static final int MAX_FAILURES = 5;
    public static final Duration LOCK = Duration.ofMinutes(15);

    private final UserRepository repository;

    public LoginGuard(UserRepository repository) {
        this.repository = repository;
    }

    /**
     * Tài khoản đang bị khoá tạm thì từ chối, kể cả mật khẩu đúng.
     *
     * <p>Câu báo là {@code message} — đúng câu của lần sai mật khẩu (GBR-01, MSG02). Báo riêng "tài khoản tạm khoá"
     * thì người ngoài biết tên đăng nhập đó có thật. Người gọi phải so mật khẩu TRƯỚC khi gọi hàm này, để tài khoản
     * đang khoá không trả lời nhanh hơn tài khoản thường.
     */
    public void requireNotLocked(User user, Instant now, String message) {
        if (user.getLoginLockedUntil() != null && user.getLoginLockedUntil().isAfter(now)) {
            throw new BadCredentialsException(message);
        }
    }

    /** Ghi một lần sai mật khẩu; lần thứ {@value #MAX_FAILURES} thì khoá. Luôn ném lỗi đăng nhập với {@code message}. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BadCredentialsException.class)
    public void recordFailure(Long userId, String message) {
        Instant now = Instant.now();
        User user = repository.lockById(userId).orElse(null);
        if (user != null) {
            int failures = user.getFailedLoginCount() + 1;
            if (failures >= MAX_FAILURES) {
                user.setFailedLoginCount(0);
                user.setLoginLockedUntil(now.plus(LOCK));
                repository.save(user);
                throw new BadCredentialsException(message);
            }
            user.setFailedLoginCount(failures);
            repository.save(user);
        }
        throw new BadCredentialsException(message);
    }

    /** Đăng nhập đúng, hoặc đặt lại mật khẩu xong: xoá bộ đếm và khoá cũ. */
    @Transactional
    public void recordSuccess(User user) {
        if (user.getFailedLoginCount() != 0 || user.getLoginLockedUntil() != null) {
            user.setFailedLoginCount(0);
            user.setLoginLockedUntil(null);
            repository.save(user);
        }
    }
}
