package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.DeployStack;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bản chính thức tự khoá tài khoản demo còn giữ mật khẩu công khai.
 *
 * <p>{@code 005-seed-security.sql} và {@code 056-seed-demo-operations.sql} tạo các tài khoản này trên MỌI
 * database, mật khẩu nằm trong repo và tài liệu. Changeset đã chạy thì không sửa được, nên chặn ở đây: mỗi lần
 * khởi động trên {@link DeployStack#production()}, tài khoản nào trong danh sách còn ĐÚNG mật khẩu seed thì
 * thành {@code LOCKED}. Đã đổi mật khẩu thì để yên — đó là tài khoản người ta đã nhận về dùng thật.
 *
 * <p>{@code admin} bị khoá là mất lối vào quản trị duy nhất (mở lại chỉ còn bằng SQL). Việc đúng là đổi mật khẩu
 * {@code admin} trước khi deploy; lỡ chưa đổi thì đặt {@code APP_KEEP_SEEDED_ADMIN=true} một lần cho node khởi
 * động lại mà không khoá {@code admin}, đăng nhập đổi mật khẩu, rồi bỏ biến đó đi.
 */
@Component
public class DemoAccountGuard {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountGuard.class);

    /** Mật khẩu chung của mọi tài khoản seed (changelog 005 và 012). */
    private static final String SEED_PASSWORD = "Admin@123";

    /** Tên đăng nhập → mật khẩu seed. Phải khớp đúng danh sách tài khoản mẫu ở changelog 012. */
    private static final Map<String, String> SEEDED = Map.ofEntries(
            Map.entry("admin", SEED_PASSWORD),
            Map.entry("so.lanhdao", SEED_PASSWORD),
            Map.entry("so.chuyenvien", SEED_PASSWORD),
            Map.entry("mk.hieutruong", SEED_PASSWORD),
            Map.entry("mk.thietbi", SEED_PASSWORD),
            Map.entry("lqd.hieutruong", SEED_PASSWORD),
            Map.entry("lqd.thietbi", SEED_PASSWORD),
            Map.entry("btx.thietbi", SEED_PASSWORD));

    private final DeployStack stack;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final boolean keepAdmin;

    public DemoAccountGuard(DeployStack stack, UserRepository users, PasswordEncoder encoder,
                            @Value("${app.security.keep-seeded-admin:false}") boolean keepAdmin) {
        this.stack = stack;
        this.users = users;
        this.encoder = encoder;
        this.keepAdmin = keepAdmin;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void lockSeededAccounts() {
        if (!stack.production()) {
            return;
        }
        SEEDED.forEach((username, password) -> users.findByUsernameIgnoreCase(username).ifPresent(user -> {
            if (user.getStatus() == UserStatus.LOCKED || !encoder.matches(password, user.getPasswordHash())) {
                return;
            }
            if (keepAdmin && "admin".equals(username)) {
                log.error("Tài khoản 'admin' còn mật khẩu seed công khai — giữ mở theo APP_KEEP_SEEDED_ADMIN. "
                        + "Đổi mật khẩu ngay rồi bỏ biến đó.");
                return;
            }
            lock(user);
        }));
    }

    private void lock(User user) {
        user.setStatus(UserStatus.LOCKED);
        users.save(user);
        log.warn("Khoá tài khoản demo '{}' — còn mật khẩu seed công khai. Đổi mật khẩu rồi mở khoá nếu cần dùng.",
                user.getUsername());
    }
}
