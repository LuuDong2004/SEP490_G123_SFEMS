package com.g123.sfems.module.school.yearprofile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.staff.StaffAssignmentService;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hồ sơ năm học (trưởng nhóm 25/11/2026): lãnh đạo trường xác nhận đã khai khi mọi điểm trường hết việc còn thiếu; xác
 * nhận không khoá — sửa sau đó vẫn được, hồ sơ giữ "Đã xác nhận" và ghi lần sửa cuối.
 */
@SpringBootTest
@Transactional
class SchoolYearProfileTest {

    @Autowired
    SchoolYearProfileService profiles;

    @Autowired
    StaffAssignmentService assignments;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    String leader;
    Long school;
    Long year;

    @BeforeEach
    void setUp() {
        // Lãnh đạo quản lý cả trường (không ghim cơ sở), có quyền xác nhận — không dựa vào tên tài khoản demo.
        List<String> found = jdbc.queryForList("""
                SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id
                JOIN user_roles ur ON ur.user_id = u.id JOIN role_permissions rp ON rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE p.code = 'school_year_profiles:confirm' AND us.campus_id IS NULL AND u.status = 'ACTIVE'
                ORDER BY u.id LIMIT 1""", String.class);
        Assumptions.assumeTrue(!found.isEmpty(), "Thiếu lãnh đạo trường có quyền xác nhận");
        leader = found.get(0);
        signIn(leader);
        school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = ?", Long.class, leader);
        List<Long> current = jdbc.queryForList("SELECT id FROM school_years WHERE is_current", Long.class);
        Assumptions.assumeTrue(!current.isEmpty(), "Chưa đặt năm học hiện hành");
        year = current.get(0);
        jdbc.update("DELETE FROM school_year_profiles WHERE school_id = ? AND school_year_id = ?", school, year);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void confirmNeedsEveryCampusReady() {
        SchoolYearProfileService.YearProfile p = profiles.profile(null, year);
        assertThat(p.status()).isEqualTo(SchoolYearProfileService.DRAFT);
        assertThat(p.canConfirm()).isTrue();
        if (!p.ready()) {
            assertThatThrownBy(() -> profiles.confirm(new SchoolYearProfileService.YearRequest(year)))
                    .isInstanceOf(FieldValidationException.class).hasMessageContaining("còn việc chưa xong");
            return;
        }
        SchoolYearProfileService.YearProfile done = profiles.confirm(new SchoolYearProfileService.YearRequest(year));
        assertThat(done.status()).isEqualTo(SchoolYearProfileService.CONFIRMED);
        assertThat(done.canConfirm()).isFalse();
        assertThatThrownBy(() -> profiles.confirm(new SchoolYearProfileService.YearRequest(year)))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("đã xác nhận");
    }

    @Test
    void confirmedYearStaysEditableAndRecordsTheLastEdit() {
        // Như trường đã xác nhận một giờ trước (dữ liệu mẫu có thể còn việc thiếu nên không gọi confirm()).
        jdbc.update("""
                INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at, updated_at)
                VALUES (?, ?, NULL, 'CONFIRMED', now() - interval '1 hour', now() - interval '1 hour')""", school, year);
        assertThat(profiles.profile(null, year).editedAt()).isNull();

        List<StaffAssignmentService.Assignment> list = assignments.list(null, year, null, null, null);
        Assumptions.assumeTrue(!list.isEmpty(), "Trường mẫu chưa có phân công");
        StaffAssignmentService.Assignment a = list.get(0);
        // Không khoá: sửa phân công sau khi xác nhận vẫn được.
        assignments.update(a.id(), new StaffAssignmentService.Input(null, null, null,
                a.mainSubject() == null ? null : new IdRef(a.mainSubject().id()), null, "sửa sau khi xác nhận"));

        SchoolYearProfileService.YearProfile p = profiles.profile(null, year);
        assertThat(p.status()).isEqualTo(SchoolYearProfileService.CONFIRMED);
        assertThat(p.editedAt()).isNotNull();
    }

    @Test
    void progressShowsConfirmedSchools() {
        jdbc.update("""
                INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at)
                VALUES (?, ?, NULL, 'CONFIRMED', now())""", school, year);
        assertThat(profiles.progress(year)).anySatisfy(r -> {
            assertThat(r.schoolId()).isEqualTo(school);
            assertThat(r.status()).isEqualTo(SchoolYearProfileService.CONFIRMED);
            assertThat(r.confirmedAt()).isNotNull();
        });
    }

    private void signIn(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản " + username);
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        // Quyền đi kèm token như bộ lọc xác thực dựng (mã quyền của các vai).
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
    }
}
