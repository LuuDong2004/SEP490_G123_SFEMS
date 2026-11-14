package com.g123.sfems.shared.data.rls;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Lớp chặn thứ 4 — RLS PostgreSQL (changelog 230–231): SQL thuần KHÔNG lọc trường vẫn chỉ thấy / ghi được trường của
 * người gọi; không có người dùng (job) thì thấy hết; Sở thấy hết.
 */
@SpringBootTest
class DbRowSecurityTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate tx;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    long own;
    long other;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        Long school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id WHERE u.username = 'thcs.canbo'", Long.class);
        Assumptions.assumeTrue(school != null, "Thiếu tài khoản demo thcs.canbo");
        own = school;
        // Trường khác có tài sản, không phải đối tác điều chuyển của trường mình.
        Long found = jdbc.query("""
                SELECT e.school_id FROM equipment e
                WHERE e.school_id <> ? AND e.school_id NOT IN (
                    SELECT target_school_id FROM equipment_transfers WHERE school_id = ?
                    UNION SELECT school_id FROM equipment_transfers WHERE target_school_id = ?)
                GROUP BY e.school_id ORDER BY count(*) DESC LIMIT 1""",
                rs -> rs.next() ? rs.getLong(1) : null, own, own, own);
        Assumptions.assumeTrue(found != null, "Không có trường thứ hai có tài sản");
        other = found;
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void schoolUserSeesOnlyOwnSchoolThroughNativeSql() {
        signIn("thcs.canbo");
        assertThat(countEquipment(other)).isZero();
        assertThat(countEquipment(own)).isPositive();
        // Ngoài giao dịch (JdbcTemplate autocommit) cũng bị chặn.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM equipment WHERE school_id = ?", Long.class, other))
                .isZero();
        // Không lọc gì: chỉ ra trường mình (và trường đối tác điều chuyển).
        assertThat(inTx(() -> jdbc.queryForObject(
                "SELECT count(*) FROM rooms WHERE school_id <> ? AND school_id = ?", Long.class, own, other)))
                .isZero();
        assertThat(inTx(() -> jdbc.queryForObject("SELECT count(*) FROM disposals WHERE school_id <> ?",
                Long.class, own))).isZero();
        // Đã hạ vai: superuser thì RLS không áp.
        assertThat(jdbc.queryForObject("SELECT current_user", String.class)).isEqualTo(RowSecurityDataSource.APP_ROLE);
    }

    @Test
    void transferPartnerStaysReadableButNotWritable() {
        Long partner = jdbc.query("SELECT target_school_id FROM equipment_transfers WHERE school_id = ?"
                + " AND status <> 'DRAFT' LIMIT 1", rs -> rs.next() ? rs.getLong(1) : null, own);
        Assumptions.assumeTrue(partner != null, "Trường demo chưa có phiếu điều chuyển");
        signIn("thcs.canbo");
        // Trường nhận / trường chuyển còn mở lại được phiếu cũ: phòng, cán bộ của trường bên kia đọc được.
        assertThat(inTx(() -> jdbc.queryForObject("SELECT count(*) FROM rooms WHERE school_id = ?", Long.class,
                partner))).isPositive();
        // Nhưng không sửa được phòng, không thấy phiếu riêng (thanh lý) của trường bên kia.
        assertThat(rolledBack(() -> jdbc.update("UPDATE rooms SET note = note WHERE school_id = ?", partner)))
                .isZero();
        assertThat(inTx(() -> jdbc.queryForObject("SELECT count(*) FROM disposals WHERE school_id = ?", Long.class,
                partner))).isZero();
    }

    @Test
    void schoolUserCannotWriteAnotherSchool() {
        signIn("thcs.canbo");
        // UPDATE dòng trường khác: không thấy dòng nào để sửa.
        assertThat(rolledBack(() -> jdbc.update("UPDATE equipment SET note = note WHERE school_id = ?", other)))
                .isZero();
        assertThat(rolledBack(() -> jdbc.update("DELETE FROM rooms WHERE school_id = ?", other))).isZero();
        // Chuyển dòng của mình sang trường khác: WITH CHECK chặn.
        assertThatThrownBy(() -> rolledBack(() -> jdbc.update(
                "UPDATE campuses SET school_id = ? WHERE id = (SELECT min(id) FROM campuses WHERE school_id = ?)",
                other, own)))
                .isInstanceOf(DataAccessException.class)
                .rootCause().hasMessageContaining("row-level security");
        // Thêm dòng cho trường khác: WITH CHECK chặn.
        assertThatThrownBy(() -> rolledBack(() -> jdbc.update(
                "INSERT INTO campuses (school_id, code, name, created_at) VALUES (?, 'RLS-TEST', 'RLS', now())",
                other)))
                .isInstanceOf(DataAccessException.class)
                .rootCause().hasMessageContaining("row-level security");
    }

    @Test
    void noUserContextSeesEverything() {
        assertThat(countEquipment(other)).isPositive();
        assertThat(jdbc.queryForObject("SELECT current_setting('app.rls_mode', true)", String.class))
                .isEqualTo("bypass");
    }

    @Test
    void soUserSeesEverySchool() {
        signIn("so.chuyenvien");
        assertThat(countEquipment(other)).isPositive();
        assertThat(countEquipment(own)).isPositive();
    }

    @Test
    void adminSeesNoBusinessRows() {
        // Quản trị hệ thống chỉ quản trị (docs/kien-truc/11 §8): token người (có phiên) không thấy dòng nghiệp vụ.
        signIn("admin", "test-session");
        assertThat(countEquipment(own)).isZero();
        assertThat(countEquipment(other)).isZero();
    }

    @Test
    void contextDoesNotLeakBetweenCheckouts() {
        signIn("thcs.canbo");
        assertThat(countEquipment(other)).isZero();
        SecurityContextHolder.clearContext();
        assertThat(countEquipment(other)).isPositive();
        assertThat(jdbc.queryForObject("SELECT current_user", String.class)).isNotEqualTo(RowSecurityDataSource.APP_ROLE);
    }

    private long countEquipment(long schoolId) {
        return inTx(() -> jdbc.queryForObject("SELECT count(*) FROM equipment WHERE school_id = ?", Long.class,
                schoolId));
    }

    private <T> T inTx(Supplier<T> work) {
        return tx.execute(status -> work.get());
    }

    private <T> T rolledBack(Supplier<T> work) {
        return tx.execute(status -> {
            status.setRollbackOnly();
            return work.get();
        });
    }

    private void signIn(String username) {
        signIn(username, null);
    }

    private void signIn(String username, String sessionId) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        String token = jwt.issueAccessToken(user, Instant.now(), sessionId);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token)));
    }
}
