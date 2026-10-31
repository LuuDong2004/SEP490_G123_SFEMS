package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.SecretBox;
import com.g123.sfems.shared.security.Totp;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xác thực hai yếu tố bằng ứng dụng xác thực (TOTP).
 *
 * <p>Ba bước thiết lập, và bước giữa là cái hay bị bỏ: tạo bí mật → người dùng
 * quét QR → NHẬP MỘT MÃ để bật. Bật ngay khi tạo bí mật thì một lần quét hỏng
 * (sai ứng dụng, chụp màn hình mờ) khoá người đó ra khỏi tài khoản của chính mình.
 *
 * <p>Năm lần sai liên tiếp khoá 5 phút: mã 6 số chỉ có một triệu khả năng, và
 * mỗi lần thử đã phải kèm đúng mật khẩu, nhưng không giới hạn thì mật khẩu lộ
 * cộng vài giờ thử là đủ.
 */
@Service
@Transactional(readOnly = true)
public class MfaService {

    /** Vai trò bắt buộc bật xác thực hai yếu tố — tài khoản đặc quyền. */
    public static final Set<String> PRIVILEGED_ROLES = Set.of("ADMIN");

    private static final String ISSUER = "QLTB";
    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK = Duration.ofMinutes(5);

    public record Setup(String secret, String otpauthUri) {
    }

    /** {@code email}: đang bật xác thực hai lớp qua email ({@code EmailMfaService}, QLTB-509). */
    public record Status(boolean enabled, boolean required, boolean pending, boolean email, String emailAddress) {
    }

    private final UserRepository repository;
    private final SecretBox box;

    public MfaService(UserRepository repository, SecretBox box) {
        this.repository = repository;
        this.box = box;
    }

    public static boolean required(User user) {
        return user.getRoles().stream().anyMatch(r -> PRIVILEGED_ROLES.contains(r.getCode()));
    }

    public Status status(Long userId) {
        User user = user(userId);
        return new Status(user.isMfaEnabled(), required(user), !user.isMfaEnabled() && user.getMfaSecret() != null,
                user.isMfaEmail(), user.getEmail());
    }

    /** Sinh bí mật mới (chưa bật). Gọi lại thì bí mật cũ bị thay — QR cũ hết dùng được. */
    @Transactional
    public Setup setup(Long userId) {
        User user = user(userId);
        if (user.isMfaEnabled()) {
            throw new FieldValidationException("mfa", "Xác thực hai yếu tố đang bật — tắt trước khi thiết lập lại");
        }
        String secret = Totp.newSecret();
        user.setMfaSecret(box.seal(secret));
        repository.save(user);
        return new Setup(secret, Totp.otpauthUri(ISSUER, user.getUsername(), secret));
    }

    @Transactional
    public Status enable(Long userId, String code) {
        User user = user(userId);
        if (user.getMfaSecret() == null) {
            throw new FieldValidationException("code", "Chưa thiết lập — quét mã QR trước");
        }
        if (!Totp.verify(box.open(user.getMfaSecret()), code, Instant.now().getEpochSecond())) {
            throw new FieldValidationException("code", "Mã không đúng — kiểm tra giờ trên điện thoại và thử lại");
        }
        user.setMfaEnabled(true);
        user.setMfaFailedAttempts(0);
        repository.save(user);
        return status(userId);
    }

    /** Tắt — phải nhập được một mã đúng, để một phiên bị chiếm không tắt được lớp bảo vệ. */
    @Transactional
    public Status disable(Long userId, String code) {
        User user = user(userId);
        if (!user.isMfaEnabled()) {
            return status(userId);
        }
        if (!Totp.verify(box.open(user.getMfaSecret()), code, Instant.now().getEpochSecond())) {
            throw new FieldValidationException("code", "Mã không đúng");
        }
        clear(user);
        return status(userId);
    }

    /** Quản trị viên đặt lại cho người mất điện thoại. */
    @Transactional
    public void reset(Long userId) {
        clear(user(userId));
    }

    /**
     * Kiểm mã lúc đăng nhập. Chạy trong giao dịch RIÊNG: lần sai phải được đếm
     * dù lần đăng nhập ném lỗi và giao dịch ngoài lùi lại — nếu không, bộ đếm
     * không bao giờ tăng và khoá tạm không bao giờ xảy ra.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BadCredentialsException.class)
    public void verifyForLogin(Long userId, String code) {
        // Khoá dòng: bộ đếm sai mã và bước TOTP đã dùng phải đọc-rồi-ghi tuần tự, nếu không thử song song là vượt
        // ngưỡng khoá, và cùng một mã lọt hai lần.
        User user = repository.lockById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
        Instant now = Instant.now();
        if (user.getMfaLockedUntil() != null && user.getMfaLockedUntil().isAfter(now)) {
            throw new BadCredentialsException("Nhập sai mã quá nhiều lần — thử lại sau ít phút");
        }
        long step = Totp.matchedStep(box.open(user.getMfaSecret()), code, now.getEpochSecond());
        boolean replay = step >= 0 && user.getMfaLastStep() != null && step <= user.getMfaLastStep();
        if (step >= 0 && !replay) {
            user.setMfaLastStep(step);
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
        throw new BadCredentialsException("Mã xác thực không đúng");
    }

    private void clear(User user) {
        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaFailedAttempts(0);
        user.setMfaLockedUntil(null);
        repository.save(user);
    }

    private User user(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
}
