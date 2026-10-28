package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.mail.MailService;
import com.g123.sfems.shared.security.Hashes;
import com.g123.sfems.shared.security.MfaRequiredException;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xác thực hai lớp QUA EMAIL (QLTB-509): mật khẩu đúng thì máy chủ gửi một mã 6 số tới email của tài khoản,
 * người dùng nhập mã đó mới vào được. Tài khoản tự bật / tắt ở trang Hồ sơ (phải nhập lại mật khẩu).
 *
 * <p>Mã chỉ lưu băm SHA-256 (gắn với id tài khoản), hết hạn sau {@code CODE_TTL}, dùng một lần. Nhập sai đếm
 * chung bộ đếm và khoá 5 phút với mã ứng dụng ({@code mfa_failed_attempts}). Đăng nhập lại trong vòng
 * {@code RESEND_AFTER} thì không gửi thư mới — mã vừa gửi vẫn dùng được.
 */
@Service
@Transactional(readOnly = true)
public class EmailMfaService {

    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration RESEND_AFTER = Duration.ofSeconds(60);
    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK = Duration.ofMinutes(5);

    private final UserRepository repository;
    private final MailService mail;
    private final PasswordEncoder passwordEncoder;

    public EmailMfaService(UserRepository repository, MailService mail, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.mail = mail;
        this.passwordEncoder = passwordEncoder;
    }

    /** Bật / tắt cho chính mình — đòi mật khẩu hiện tại, để một phiên bị chiếm không tắt được lớp bảo vệ. */
    @Transactional
    public boolean setEnabled(Long userId, boolean enabled, String password) {
        User user = user(userId);
        if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new FieldValidationException("password", "Mật khẩu không đúng");
        }
        if (enabled && (user.getEmail() == null || user.getEmail().isBlank())) {
            throw new FieldValidationException("email", "Tài khoản chưa có email — nhờ quản trị viên khai email trước");
        }
        user.setMfaEmail(enabled);
        user.setEmailCodeHash(null);
        user.setEmailCodeExpiresAt(null);
        repository.save(user);
        return enabled;
    }

    /**
     * Gửi mã (mật khẩu vừa đúng, chưa có mã) rồi báo màn đăng nhập hiện ô nhập mã. Giao dịch RIÊNG: mã phải được
     * lưu dù lần đăng nhập kết thúc bằng lỗi "cần mã".
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BadCredentialsException.class)
    public void sendForLogin(Long userId) {
        User user = user(userId);
        Instant now = Instant.now();
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new BadCredentialsException(
                    "Tài khoản bật xác thực qua email nhưng chưa có email — liên hệ quản trị viên");
        }
        boolean fresh = user.getEmailCodeSentAt() != null && user.getEmailCodeSentAt().plus(RESEND_AFTER).isAfter(now)
                && user.getEmailCodeExpiresAt() != null && user.getEmailCodeExpiresAt().isAfter(now);
        if (!fresh) {
            String code = Hashes.digits(6);
            user.setEmailCodeHash(Hashes.sha256(user.getId() + ":" + code));
            user.setEmailCodeExpiresAt(now.plus(CODE_TTL));
            user.setEmailCodeSentAt(now);
            repository.save(user);
            mail.send(user.getEmail(), "Mã đăng nhập hệ thống quản lý CSVC & thiết bị",
                    "Mã đăng nhập của tài khoản " + user.getUsername() + " là: " + code + "\n\n"
                            + "Mã có hiệu lực " + CODE_TTL.toMinutes() + " phút và chỉ dùng một lần. "
                            + "Nếu không phải bạn đang đăng nhập, hãy đổi mật khẩu ngay.");
        }
        throw new MfaRequiredException("Đã gửi mã 6 số tới " + MailService.mask(user.getEmail())
                + " — nhập mã để đăng nhập (hiệu lực " + CODE_TTL.toMinutes() + " phút)", "email");
    }

    /** Kiểm mã lúc đăng nhập — giao dịch riêng, như {@code MfaService.verifyForLogin}, để lần sai được đếm. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BadCredentialsException.class)
    public void verifyForLogin(Long userId, String code) {
        User user = user(userId);
        Instant now = Instant.now();
        if (user.getMfaLockedUntil() != null && user.getMfaLockedUntil().isAfter(now)) {
            throw new BadCredentialsException("Nhập sai mã quá nhiều lần — thử lại sau ít phút");
        }
        boolean live = user.getEmailCodeHash() != null && user.getEmailCodeExpiresAt() != null
                && user.getEmailCodeExpiresAt().isAfter(now);
        if (live && user.getEmailCodeHash().equals(Hashes.sha256(user.getId() + ":" + code.trim()))) {
            user.setEmailCodeHash(null);
            user.setEmailCodeExpiresAt(null);
            user.setMfaFailedAttempts(0);
            user.setMfaLockedUntil(null);
            repository.save(user);
            return;
        }
        int failures = user.getMfaFailedAttempts() + 1;
        user.setMfaFailedAttempts(failures >= MAX_FAILURES ? 0 : failures);
        if (failures >= MAX_FAILURES) {
            user.setMfaLockedUntil(now.plus(LOCK));
        }
        repository.save(user);
        throw new BadCredentialsException(live ? "Mã xác thực không đúng" : "Mã đã hết hạn — bấm Gửi lại mã");
    }

    private User user(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
}
