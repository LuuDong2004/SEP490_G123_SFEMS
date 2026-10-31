package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.mail.MailService;
import com.g123.sfems.shared.security.Hashes;
import com.g123.sfems.shared.security.MfaRequiredException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final TransactionTemplate tx;

    public EmailMfaService(UserRepository repository, MailService mail, PasswordEncoder passwordEncoder,
                           PlatformTransactionManager transactionManager) {
        this.tx = new TransactionTemplate(transactionManager);
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
     * Gửi mã (mật khẩu vừa đúng, chưa có mã) rồi báo màn đăng nhập hiện ô nhập mã. Mã được lưu và COMMIT trong một
     * giao dịch ngắn TRƯỚC khi gửi thư — mã phải còn dù lần đăng nhập kết thúc bằng lỗi "cần mã", và SMTP (có khi
     * vài giây) không được giữ kết nối CSDL. Gửi hỏng thì gỡ mã vừa lưu, để lần thử lại gửi thư mới thay vì bảo
     * "đã gửi" một thư không hề đi.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void sendForLogin(Long userId) {
        Instant now = Instant.now();
        Outgoing outgoing = tx.execute(status -> issueCode(userId, now));
        if (outgoing.code() != null) {
            try {
                mail.send(outgoing.email(), "Mã đăng nhập hệ thống quản lý CSVC & thiết bị",
                        "Mã đăng nhập của tài khoản " + outgoing.username() + " là: " + outgoing.code() + "\n\n"
                                + "Mã có hiệu lực " + CODE_TTL.toMinutes() + " phút và chỉ dùng một lần. "
                                + "Nếu không phải bạn đang đăng nhập, hãy đổi mật khẩu ngay.");
            } catch (RuntimeException e) {
                tx.executeWithoutResult(status -> repository.findById(userId).ifPresent(user -> {
                    user.setEmailCodeHash(null);
                    user.setEmailCodeExpiresAt(null);
                    user.setEmailCodeSentAt(null);
                    repository.save(user);
                }));
                throw e;
            }
        }
        throw new MfaRequiredException("Đã gửi mã 6 số tới " + MailService.mask(outgoing.email())
                + " — nhập mã để đăng nhập (hiệu lực " + CODE_TTL.toMinutes() + " phút)", "email");
    }

    /** Thư cần gửi; {@code code} rỗng = mã vừa gửi trong {@code RESEND_AFTER} còn dùng được, không gửi lại. */
    private record Outgoing(String email, String username, String code) {
    }

    private Outgoing issueCode(Long userId, Instant now) {
        User user = user(userId);
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new BadCredentialsException(
                    "Tài khoản bật xác thực qua email nhưng chưa có email — liên hệ quản trị viên");
        }
        boolean fresh = user.getEmailCodeSentAt() != null && user.getEmailCodeSentAt().plus(RESEND_AFTER).isAfter(now)
                && user.getEmailCodeExpiresAt() != null && user.getEmailCodeExpiresAt().isAfter(now);
        if (fresh) {
            return new Outgoing(user.getEmail(), user.getUsername(), null);
        }
        String code = Hashes.digits(6);
        user.setEmailCodeHash(Hashes.sha256(user.getId() + ":" + code));
        user.setEmailCodeExpiresAt(now.plus(CODE_TTL));
        user.setEmailCodeSentAt(now);
        repository.save(user);
        return new Outgoing(user.getEmail(), user.getUsername(), code);
    }

    /** Kiểm mã lúc đăng nhập — giao dịch riêng, như {@code MfaService.verifyForLogin}, để lần sai được đếm. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BadCredentialsException.class)
    public void verifyForLogin(Long userId, String code) {
        // Khoá dòng: bộ đếm sai mã và việc đốt mã phải tuần tự giữa các lần thử song song.
        User user = repository.lockById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
        Instant now = Instant.now();
        if (user.getMfaLockedUntil() != null && user.getMfaLockedUntil().isAfter(now)) {
            throw new BadCredentialsException("Nhập sai mã quá nhiều lần — thử lại sau ít phút");
        }
        boolean live = user.getEmailCodeHash() != null && user.getEmailCodeExpiresAt() != null
                && user.getEmailCodeExpiresAt().isAfter(now);
        if (live && MessageDigest.isEqual(user.getEmailCodeHash().getBytes(StandardCharsets.US_ASCII),
                Hashes.sha256(user.getId() + ":" + code.trim()).getBytes(StandardCharsets.US_ASCII))) {
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
