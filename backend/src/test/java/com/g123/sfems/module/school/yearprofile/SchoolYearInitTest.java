package com.g123.sfems.module.school.yearprofile;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/** Khởi tạo năm học mới (§4): lên lớp tự động, khối cuối cấp ra trường; phân công chép, bỏ người đã nghỉ. */
@SpringBootTest
@Transactional
class SchoolYearInitTest {

    @Autowired
    SchoolYearInitService init;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void promoteMovesClassesUpAndGraduatesTheLastGrade() {
        assertThat(SchoolYearInitService.promote("6A1")).isEqualTo("7A1");
        assertThat(SchoolYearInitService.promote("10C12")).isEqualTo("11C12");
        assertThat(SchoolYearInitService.promote("Lop chuyen")).isEqualTo("Lop chuyen");
    }

    @Test
    void newYearGetsPromotedClassesAndCopiedAssignments() {
        signIn("thcs.hieutruong");
        Long school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = 'thcs.hieutruong'", Long.class);
        Long current = jdbc.queryForObject("SELECT id FROM school_years WHERE is_current", Long.class);
        // Năm học kế tiếp ngay sau năm hiện tại (đã có trong danh mục thì dùng, chưa có thì thêm).
        Long target = jdbc.queryForList("""
                SELECT n.id FROM school_years n, school_years c WHERE c.is_current AND n.start_date > c.start_date
                ORDER BY n.start_date LIMIT 1""", Long.class).stream().findFirst().orElseGet(() -> jdbc.queryForObject("""
                INSERT INTO school_years (code, name, start_date, end_date, created_at)
                VALUES ('TEST-2099', 'Năm học thử 2099', DATE '2099-09-05', DATE '2100-05-31', now()) RETURNING id""",
                Long.class));
        jdbc.update("DELETE FROM school_classes WHERE school_id = ? AND school_year_id = ?", school, target);
        jdbc.update("DELETE FROM staff_assignments WHERE school_id = ? AND school_year_id = ?", school, target);
        int notLast = jdbc.queryForObject("""
                SELECT count(*)::int FROM school_classes k JOIN grades g ON g.id = k.grade_id
                WHERE k.school_id = ? AND k.school_year_id = ? AND k.active AND g.code <> 'LOP_9'""", Integer.class,
                school, current);
        Assumptions.assumeTrue(notLast > 0, "Trường mẫu chưa có lớp dưới khối 9");
        int teachers = jdbc.queryForObject("""
                SELECT count(*)::int FROM staff_assignments a JOIN staff st ON st.id = a.staff_id
                WHERE a.school_id = ? AND a.school_year_id = ? AND st.active AND st.staff_type = 'TEACHER'""",
                Integer.class, school, current);
        SchoolYearInitService.InitResult r = init.init(new SchoolYearInitService.InitRequest(target,
                SchoolYearInitService.Classes.PROMOTE, true, true));
        assertThat(r.classes()).isEqualTo(notLast);
        assertThat(r.assignments()).isEqualTo(teachers);
        // Không còn lớp khối 6 (khối đầu chưa có ai lên); "8A1" năm trước thành "9A1" khối 9.
        List<String> codes = jdbc.queryForList("SELECT k.code || ':' || g.code FROM school_classes k JOIN grades g"
                + " ON g.id = k.grade_id WHERE k.school_id = ? AND k.school_year_id = ?", String.class, school, target);
        assertThat(codes).noneMatch(c -> c.endsWith(":LOP_6"));
        boolean had8A1 = jdbc.queryForObject("SELECT count(*) > 0 FROM school_classes WHERE school_id = ?"
                + " AND school_year_id = ? AND code = '8A1'", Boolean.class, school, current);
        if (had8A1) {
            assertThat(codes).contains("9A1:LOP_9");
        }
        // Chạy lại không nhân đôi lớp.
        assertThat(init.init(new SchoolYearInitService.InitRequest(target,
                SchoolYearInitService.Classes.PROMOTE, true, true)).classes()).isZero();
    }

    private void signIn(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
    }
}
