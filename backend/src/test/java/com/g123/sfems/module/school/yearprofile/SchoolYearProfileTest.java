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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hồ sơ năm học (278): chốt lưu bản chốt và khoá dữ liệu A của năm đó; chỉ cơ quan quản lý của trường mở lại được,
 * phải có lý do.
 */
@SpringBootTest
@Transactional
class SchoolYearProfileTest {

    @Autowired
    SchoolYearProfileService profiles;

    @Autowired
    StaffAssignmentService assignments;

    @Autowired
    SchoolYearLock lock;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    Long school;
    Long year;

    @BeforeEach
    void setUp() {
        signIn("thcs.hieutruong");
        school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = 'thcs.hieutruong'", Long.class);
        year = jdbc.queryForObject("SELECT id FROM school_years WHERE is_current", Long.class);
        jdbc.update("DELETE FROM school_year_closings WHERE school_id = ? AND school_year_id = ?", school, year);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void closingNeedsEveryCampusConfirmed() {
        jdbc.update("DELETE FROM school_year_profiles WHERE school_id = ? AND school_year_id = ?", school, year);
        assertThatThrownBy(() -> profiles.close(new SchoolYearProfileService.YearRequest(year)))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("chưa xác nhận");
    }

    @Test
    void closedYearIsSnapshottedAndLocked() {
        confirmAll();
        SchoolYearProfileService.YearProfile p = profiles.close(new SchoolYearProfileService.YearRequest(year));
        assertThat(p.status()).isEqualTo("CLOSED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM school_year_closing_lines l JOIN school_year_closings c"
                + " ON c.id = l.closing_id WHERE c.school_id = ? AND c.school_year_id = ?", Long.class, school, year))
                .isPositive();
        assertThat(lock.isClosed(school, year)).isTrue();
        // Dữ liệu A của năm đã chốt: phân công không ghi được.
        List<StaffAssignmentService.Assignment> list = assignments.list(null, year, null, null, null);
        Assumptions.assumeTrue(!list.isEmpty(), "Trường mẫu chưa có phân công");
        StaffAssignmentService.Assignment a = list.get(0);
        assertThatThrownBy(() -> assignments.update(a.id(),
                new StaffAssignmentService.Input(null, null, null, null, null, "sửa sau khi chốt")))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("đã chốt");
        assertThatThrownBy(() -> assignments.delete(a.id())).isInstanceOf(FieldValidationException.class);
    }

    @Test
    void onlyTheManagingBodyReopensWithAReason() {
        confirmAll();
        profiles.close(new SchoolYearProfileService.YearRequest(year));
        // Trường không tự mở lại.
        assertThatThrownBy(() -> profiles.reopen(new SchoolYearProfileService.ReopenRequest(school, year, "sửa")))
                .isInstanceOf(AccessDeniedException.class);
        // Sở là cơ quan quản lý mọi trường (không có cổng UBND).
        signIn("so.chuyenvien");
        assertThatThrownBy(() -> profiles.reopen(new SchoolYearProfileService.ReopenRequest(school, year, "  ")))
                .isInstanceOf(FieldValidationException.class);
        SchoolYearProfileService.YearProfile p = profiles.reopen(
                new SchoolYearProfileService.ReopenRequest(school, year, "Trường khai thiếu sĩ số lớp 9"));
        assertThat(p.status()).isEqualTo("REOPENED");
        assertThat(p.history()).hasSize(1);
        assertThat(p.history().get(0).reopenReason()).isEqualTo("Trường khai thiếu sĩ số lớp 9");
        assertThat(lock.isClosed(school, year)).isFalse();
        assertThat(p.campuses()).allMatch(c -> "DRAFT".equals(c.status()));
    }

    @Test
    void editingDataOfAConfirmedCampusReturnsItToDraft() {
        confirmAll();
        List<StaffAssignmentService.Assignment> list = assignments.list(null, year, null, null, null);
        Assumptions.assumeTrue(!list.isEmpty(), "Trường mẫu chưa có phân công");
        signIn("thcs.canbo");
        StaffAssignmentService.Assignment a = list.get(0);
        assignments.update(a.id(), new StaffAssignmentService.Input(null, null, null,
                a.mainSubject() == null ? null : new IdRef(a.mainSubject().id()), null, "ghi chú mới"));
        signIn("thcs.hieutruong");
        assertThat(profiles.profile(null, year).campuses()).anyMatch(c -> "DRAFT".equals(c.status()));
    }

    /** Như lãnh đạo trường đã xác nhận mọi điểm (dữ liệu mẫu có thể còn việc thiếu). */
    private void confirmAll() {
        List<Long> campuses = jdbc.queryForList("SELECT id FROM campuses WHERE school_id = ? AND active", Long.class,
                school);
        jdbc.update("DELETE FROM school_year_profiles WHERE school_id = ? AND school_year_id = ?", school, year);
        if (campuses.isEmpty()) {
            jdbc.update("INSERT INTO school_year_profiles (school_id, school_year_id, status) VALUES (?, ?, 'CONFIRMED')",
                    school, year);
        }
        for (Long c : campuses) {
            jdbc.update("INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status)"
                    + " VALUES (?, ?, ?, 'CONFIRMED')", school, year, c);
        }
    }

    private void signIn(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        // Quyền đi kèm token như bộ lọc xác thực dựng (mã quyền của các vai).
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
    }
}
