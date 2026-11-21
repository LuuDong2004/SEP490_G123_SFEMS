package com.g123.sfems.module.security.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import com.g123.sfems.shared.mail.FakeMailSenderConfig;
import com.g123.sfems.shared.mail.FakeMailSenderConfig.FakeMailSender;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản trị đặt lại mật khẩu qua email: mật khẩu cũ mất hiệu lực, một link được cấp, thư đi tới email thật — kể cả với
 * tài khoản quyền cao (luật mật khẩu ≥ 12 ký tự). Thư chỉ đi SAU commit, test lùi giao dịch nên không kiểm nội dung thư.
 */
@SpringBootTest(properties = FakeMailSenderConfig.PROPERTIES)
@Import(FakeMailSenderConfig.class)
@Transactional
class PasswordResetMailTest {


    @Autowired
    PasswordResetService resets;

    @Autowired
    JavaMailSender sender;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    EntityManager em;

    Long admin;
    String oldHash;

    @BeforeEach
    void setUp() {
        ((FakeMailSender) sender).sent.clear();
        admin = jdbc.queryForObject("""
                SELECT min(u.id) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                WHERE r.code = 'ADMIN'""", Long.class);
        jdbc.update("UPDATE users SET email = 'quantri.thu@example.com' WHERE id = ?", admin);
        oldHash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, admin);
    }

    @Test
    void privilegedAccountGetsALinkAndLosesTheOldPassword() {
        String sentTo = resets.resetByEmail(admin);
        em.flush();

        assertThat(sentTo).endsWith("@example.com").contains("*");
        assertThat(jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, admin))
                .isNotEqualTo(oldHash);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM password_reset_tokens WHERE user_id = ?", Long.class,
                admin)).isPositive();
    }

    @Test
    void accountWithoutRealEmailIsRefused() {
        jdbc.update("UPDATE users SET email = 'quantri@qltb.local' WHERE id = ?", admin);

        assertThatThrownBy(() -> resets.resetByEmail(admin)).isInstanceOf(FieldValidationException.class);
        assertThat(jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, admin))
                .isEqualTo(oldHash);
    }
}
