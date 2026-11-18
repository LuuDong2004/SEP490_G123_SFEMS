package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.mail.MailService;
import com.g123.sfems.shared.security.Hashes;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Quên mật khẩu: người dùng nhập tên đăng nhập hoặc email, máy chủ gửi link đặt lại tới email của
 * tài khoản; mở link, đặt mật khẩu mới (qua {@code PasswordPolicy}) là xong, mọi phiên cũ bị đăng xuất.
 *
 * <p>Câu trả lời cho yêu cầu luôn GIỐNG NHAU dù tài khoản có tồn tại, có email hay không — form quên mật khẩu
 * không được thành chỗ dò tài khoản. Token chỉ lưu băm SHA-256, hạn {@code TTL}, dùng một lần; mỗi tài khoản
 * tối đa một thư trong {@code THROTTLE}. Đặt lại xong cũng mở khoá tạm do sai mật khẩu.
 */
@Service
@Transactional(readOnly = true)
public class PasswordResetService {

    /** Email giả khi cán bộ chưa có email ({@code StaffAccountService}): không gửi thư tới đó. */
    public static final String PLACEHOLDER_DOMAIN = "@qltb.local";
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Duration TTL = Duration.ofMinutes(30);
    private static final Duration THROTTLE = Duration.ofMinutes(2);
    /** Thư mời tài khoản mới: người nhận có thể vài hôm sau mới mở thư. */
    private static final Duration INVITE_TTL = Duration.ofDays(3);

    private final UserService users;
    private final LoginGuard guard;
    private final MailService mail;
    private final JdbcTemplate jdbc;
    private final String frontendUrl;
    private final TransactionTemplate tx;

    public PasswordResetService(UserService users, LoginGuard guard, MailService mail, JdbcTemplate jdbc,
                                @Value("${app.frontend-url:http://localhost:5555}") String frontendUrl,
                                PlatformTransactionManager transactionManager) {
        this.tx = new TransactionTemplate(transactionManager);
        this.users = users;
        this.guard = guard;
        this.mail = mail;
        this.jdbc = jdbc;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /**
     * Không giữ giao dịch bao ngoài: token được lưu và commit trước, thư gửi SAU — SMTP (có khi vài giây) không
     * giữ kết nối CSDL. Gửi hỏng thì xoá token vừa lưu, để lần thử lại không bị chặn {@code THROTTLE} vì một thư
     * không hề đi.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void request(String login) {
        if (login == null || login.isBlank()) {
            throw new FieldValidationException("login", "Nhập tên đăng nhập hoặc email");
        }
        Optional<User> found = users.findForAuthentication(login.trim()).filter(User::canSignIn);
        if (found.isEmpty() || found.get().getEmail() == null || found.get().getEmail().isBlank()) {
            log.info("Yêu cầu đặt lại mật khẩu cho '{}': không có tài khoản hoạt động có email, không gửi thư", login);
            return;
        }
        User user = found.get();
        Instant now = Instant.now();
        String token = Hashes.urlToken(32);
        String tokenHash = Hashes.sha256(token);
        // Mọi câu SQL nằm TRONG tx.execute: gọi JdbcTemplate thẳng trong phạm vi NOT_SUPPORTED thì Spring buộc kết
        // nối vào luồng tới hết phương thức — tức là giữ nó suốt lúc gửi thư.
        Boolean issued = tx.execute(status -> {
            Integer recent = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = ? AND created_at > ?",
                    Integer.class, user.getId(), Timestamp.from(now.minus(THROTTLE)));
            if (recent != null && recent > 0) {
                return false;
            }
            jdbc.update("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)"
                            + " VALUES (?, ?, ?, ?)",
                    user.getId(), tokenHash, Timestamp.from(now.plus(TTL)), Timestamp.from(now));
            return true;
        });
        if (!Boolean.TRUE.equals(issued)) {
            return;
        }
        try {
            sendLink(user, token);
        } catch (RuntimeException e) {
            tx.executeWithoutResult(status ->
                    jdbc.update("DELETE FROM password_reset_tokens WHERE token_hash = ?", tokenHash));
            throw e;
        }
    }

    private void sendLink(User user, String token) {
        mail.send(user.getEmail(), "Đặt lại mật khẩu hệ thống quản lý CSVC & thiết bị",
                "Có yêu cầu đặt lại mật khẩu cho tài khoản " + user.getUsername() + ".\n\n"
                        + "Mở link sau để đặt mật khẩu mới (hiệu lực " + TTL.toMinutes() + " phút, dùng một lần):\n"
                        + frontendUrl + "/reset-password?token=" + token + "\n\n"
                        + "Nếu không phải bạn yêu cầu, bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.");
    }

    /**
     * Thư mời cho tài khoản vừa cấp: tên đăng nhập + link tự đặt mật khẩu (cùng cơ chế link đặt lại, hạn
     * {@code INVITE_TTL}). KHÔNG gửi mật khẩu qua thư. Đang trong giao dịch thì thư đi SAU khi commit — tài khoản
     * chưa ghi thì không mời. Gửi hỏng chỉ ghi log, không làm hỏng việc cấp tài khoản: người cấp còn mật khẩu tạm
     * hoặc gửi lại bằng "Quên mật khẩu".
     *
     * @return email đã che (để màn hình báo "đã gửi tới …"), hoặc {@code null} khi tài khoản không có email thật
     */
    @Transactional(propagation = Propagation.REQUIRED, readOnly = false)
    public String invite(User user) {
        String email = user.getEmail();
        if (email == null || email.isBlank() || email.endsWith(PLACEHOLDER_DOMAIN)) {
            return null;
        }
        String token = Hashes.urlToken(32);
        Instant now = Instant.now();
        jdbc.update("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
                user.getId(), Hashes.sha256(token), Timestamp.from(now.plus(INVITE_TTL)), Timestamp.from(now));
        Runnable send = () -> {
            try {
                mail.send(email, "Tài khoản hệ thống quản lý CSVC & thiết bị",
                        "Chào " + user.getFullName() + ",\n\n"
                                + "Bạn đã được cấp tài khoản trên hệ thống quản lý cơ sở vật chất và thiết bị.\n"
                                + "Tên đăng nhập: " + user.getUsername() + "\n\n"
                                + "Mở link sau để tự đặt mật khẩu (hiệu lực " + INVITE_TTL.toDays() + " ngày, dùng một lần):\n"
                                + frontendUrl + "/reset-password?token=" + token + "&invite=1\n\n"
                                + "Link hết hạn thì dùng \"Quên mật khẩu\" ở màn đăng nhập để nhận link mới.");
            } catch (RuntimeException e) {
                log.error("Không gửi được thư mời tới tài khoản {}: {}", user.getUsername(), e.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
        return MailService.mask(email);
    }

    @Transactional
    public void reset(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new FieldValidationException("token", "Link đặt lại mật khẩu không hợp lệ");
        }
        Instant now = Instant.now();
        List<Long> ids = jdbc.queryForList(
                "SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
                Long.class, Hashes.sha256(token.trim()), Timestamp.from(now));
        if (ids.isEmpty()) {
            throw new FieldValidationException("token",
                    "Link đặt lại mật khẩu đã hết hạn hoặc đã dùng — yêu cầu link mới");
        }
        User user = users.setPassword(ids.get(0), newPassword);
        guard.recordSuccess(user);
        jdbc.update("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
                Timestamp.from(now), user.getId());
    }
}
