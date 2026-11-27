package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

/**
 * Trang "Học sinh" của tệp dữ liệu đầu vào (304): nhận dòng đúng (lớp ở trang Lớp học của tệp hoặc lớp đã có), báo lỗi
 * dòng sai (lớp không có, ngày sinh sai, giới tính lạ, trùng mã trong lớp); ghi xong sĩ số lớp khớp danh sách; hoàn
 * tác gỡ học sinh và trả lại sĩ số nhập tay. Tài khoản Sở tải tệp thì trang Học sinh không vào lô.
 */
@SpringBootTest
@Transactional
class StudentImportTest {

    @Autowired
    OnboardingService onboarding;

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
    void studentSheetChecksRowsAndCountsClassesOnCommit() {
        long school = signIn("SCHOOL_STAFF");
        String year = currentYearLabel();
        List<Long> existing = jdbc.queryForList("""
                SELECT k.id FROM school_classes k JOIN school_years y ON y.id = k.school_year_id AND y.is_current
                WHERE k.school_id = ? AND NOT EXISTS (SELECT 1 FROM students s WHERE s.class_id = k.id)
                ORDER BY k.id LIMIT 1""", Long.class, school);
        Assumptions.assumeTrue(!existing.isEmpty(), "Trường mẫu cần một lớp năm hiện hành chưa có học sinh");
        long oldClass = existing.get(0);
        String oldCode = jdbc.queryForObject("SELECT code FROM school_classes WHERE id = ?", String.class, oldClass);
        jdbc.update("UPDATE school_classes SET student_count = 40 WHERE id = ?", oldClass);
        String grade = jdbc.queryForObject("SELECT g.name FROM school_classes k JOIN grades g ON g.id = k.grade_id"
                + " WHERE k.id = ?", String.class, oldClass);

        byte[] file = XlsxWriter.writeAll(List.of(
                tab(OnboardingSheet.CLASS, List.of(
                        Map.of("code", "ZT-HS1", "grade", grade, "year", year, "students", "5"))),
                tab(OnboardingSheet.STUDENT, List.of(
                        student("ZT-0001", "Nguyễn Văn An", "ZT-HS1", "14/05/2010", "Nam"),
                        student("ZT-0002", "Trần Thị Bình", "ZT-HS1", "02/11/2010", "Nữ"),
                        student("ZT-0003", "Lê Minh Châu", "zt-hs1", "", ""),
                        student("ZT-0004", "Phạm Văn Dũng", oldCode, "20/01/2010", "Nam"),
                        student("ZT-0009", "Hoàng Thị Em", "KHONG-CO-LOP", "01/01/2010", "Nữ"),
                        student("ZT-0010", "Đỗ Văn Giang", "ZT-HS1", "31/02/2010", "Nam"),
                        student("ZT-0011", "Vũ Thị Hà", "ZT-HS1", "12/12/2010", "Khác"),
                        student("ZT-0002", "Bùi Văn Khoa", "ZT-HS1", "", "Nam")))));
        OnboardingService.Batch batch = onboarding.upload(null, "hoc-sinh-thu.xlsx", file);
        assertThat(batch.sheets()).anySatisfy(s -> {
            assertThat(s.sheet()).isEqualTo("student");
            assertThat(s.total()).isEqualTo(8);
        });

        Map<String, OnboardingService.StagedRow> byCode = new HashMap<>();
        List<OnboardingService.StagedRow> rows = onboarding.rows(batch.id(), "student");
        rows.forEach(r -> byCode.putIfAbsent(r.data().get("code") + "@" + r.data().get("class"), r));
        assertThat(byCode.get("ZT-0001@ZT-HS1").status()).isEqualTo(OnboardingValidator.OK);
        assertThat(byCode.get("ZT-0003@zt-hs1").status()).isEqualTo(OnboardingValidator.OK);
        // Lớp đã có trên hệ thống nhận được. (Mã học sinh duy nhất trong cả năm học — xem test dưới.)
        assertThat(byCode.get("ZT-0004@" + oldCode).status()).isEqualTo(OnboardingValidator.OK);
        assertThat(byCode.get("ZT-0009@KHONG-CO-LOP").messages())
                .anySatisfy(m -> assertThat(m.text()).contains("Không có lớp"));
        assertThat(byCode.get("ZT-0010@ZT-HS1").messages())
                .anySatisfy(m -> assertThat(m.text()).contains("không có thật"));
        assertThat(byCode.get("ZT-0011@ZT-HS1").messages())
                .anySatisfy(m -> assertThat(m.text()).contains("Giới tính"));
        assertThat(rows.stream().filter(r -> "ZT-0002".equals(r.data().get("code"))))
                .allSatisfy(r -> assertThat(r.messages()).anySatisfy(m -> assertThat(m.text()).contains("lặp lại")));
        // Sĩ số ghi 5 mà trang Học sinh có 2 em không lỗi của lớp: nhắc, không chặn.
        assertThat(onboarding.rows(batch.id(), "class").get(0).messages())
                .anySatisfy(m -> assertThat(m.text()).contains("sĩ số tự đếm"));

        // Còn dòng lỗi thì không ghi. Bỏ các dòng lỗi (giữ dòng ZT-0002 đầu — bỏ bản trùng thì nó hết lỗi) rồi ghi.
        assertThatThrownBy(() -> onboarding.commit(batch.id())).isInstanceOf(FieldValidationException.class);
        long keep = byCode.get("ZT-0002@ZT-HS1").id();
        List<OnboardingService.RowEdit> skips = new ArrayList<>();
        rows.stream().filter(r -> OnboardingValidator.ERROR.equals(r.status()) && r.id() != keep)
                .forEach(r -> skips.add(new OnboardingService.RowEdit(r.id(), null, true, null)));
        assertThat(skips).hasSize(4);
        onboarding.updateRows(batch.id(), skips);
        OnboardingService.Batch committed = onboarding.commit(batch.id());
        assertThat(committed.created()).containsEntry("students", 4).containsEntry("school_classes", 1);

        Long newClass = jdbc.queryForObject("SELECT id FROM school_classes WHERE school_id = ? AND code = 'ZT-HS1'",
                Long.class, school);
        assertThat(count(newClass)).isEqualTo(3);
        assertThat(count(oldClass)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT gender || ' ' || to_char(birth_date, 'DD/MM/YYYY') FROM students"
                + " WHERE class_id = ? AND code = 'ZT-0002'", String.class, newClass)).isEqualTo("FEMALE 02/11/2010");

        // Hoàn tác: học sinh, lớp mới gỡ hết; lớp cũ về lại sĩ số nhập tay.
        onboarding.rollback(batch.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM students WHERE code LIKE 'ZT-%' AND school_id = ?",
                Integer.class, school)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM school_classes WHERE school_id = ? AND code = 'ZT-HS1'",
                Integer.class, school)).isZero();
        assertThat(count(oldClass)).isEqualTo(40);
    }

    /** Mã học sinh duy nhất trong cả năm học (mọi lớp), tuổi 3–25 — cùng luật form, báo ngay ở bước kiểm. */
    @Test
    void studentCodeIsUniqueAcrossClassesOfTheYearAndAgeIsPlausible() {
        long school = signIn("SCHOOL_STAFF");
        String year = currentYearLabel();
        List<String> existing = jdbc.queryForList("""
                SELECT k.code FROM school_classes k JOIN school_years y ON y.id = k.school_year_id AND y.is_current
                WHERE k.school_id = ? ORDER BY k.id LIMIT 1""", String.class, school);
        Assumptions.assumeTrue(!existing.isEmpty(), "Trường mẫu cần một lớp năm hiện hành");
        String oldCode = existing.get(0);
        String grade = jdbc.queryForObject("SELECT g.name FROM school_classes k JOIN grades g ON g.id = k.grade_id"
                + " WHERE k.school_id = ? AND k.code = ? LIMIT 1", String.class, school, oldCode);
        byte[] file = XlsxWriter.writeAll(List.of(
                tab(OnboardingSheet.CLASS, List.of(
                        Map.of("code", "ZT-HS2", "grade", grade, "year", year, "students", "5"))),
                tab(OnboardingSheet.STUDENT, List.of(
                        student("ZT-1001", "Nguyễn Văn An", "ZT-HS2", "14/05/2012", "Nam"),
                        student("ZT-1001", "Phạm Văn Dũng", oldCode, "20/01/2012", "Nam"),
                        student("ZT-1002", "Trần Thị Bình", "ZT-HS2", "02/11/1990", "Nữ")))));
        OnboardingService.Batch batch = onboarding.upload(null, "hs-trung-ma.xlsx", file);
        List<OnboardingService.StagedRow> rows = onboarding.rows(batch.id(), "student");
        assertThat(rows.stream().filter(r -> "ZT-1001".equals(r.data().get("code"))))
                .hasSize(2)
                .allSatisfy(r -> assertThat(r.messages()).anySatisfy(m -> assertThat(m.text()).contains("lặp lại ở các lớp")));
        assertThat(rows.stream().filter(r -> "ZT-1002".equals(r.data().get("code"))))
                .allSatisfy(r -> assertThat(r.messages())
                        .anySatisfy(m -> assertThat(m.text()).contains("Ngày sinh không hợp lý")));
    }

    @Test
    void templateHasTheStudentSheetRightAfterClasses() {
        List<OnboardingSheet> order = List.of(OnboardingSheet.values());
        assertThat(order.indexOf(OnboardingSheet.STUDENT)).isEqualTo(order.indexOf(OnboardingSheet.CLASS) + 1);
        signIn("SCHOOL_STAFF");
        OnboardingService.Batch batch = onboarding.upload(null, "mau.xlsx", onboarding.template());
        assertThat(batch.sheets()).extracting(OnboardingService.SheetCount::sheet).contains("class", "student");
    }

    @Test
    void soAccountUploadDropsTheStudentSheet() {
        long school = signIn("SCHOOL_STAFF");
        SecurityContextHolder.clearContext();
        List<String> so = jdbc.queryForList("""
                SELECT u.username FROM users u JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id AND r.code = 'SO_SPECIALIST' ORDER BY u.username LIMIT 1""",
                String.class);
        Assumptions.assumeTrue(!so.isEmpty(), "Thiếu tài khoản chuyên viên Sở");
        signInAs(so.get(0));
        byte[] onlyStudents = XlsxWriter.writeAll(List.of(tab(OnboardingSheet.STUDENT,
                List.of(student("ZT-0001", "Nguyễn Văn An", "10A1", "14/05/2010", "Nam")))));
        assertThatThrownBy(() -> onboarding.upload(school, "hs.xlsx", onlyStudents))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("học sinh");
    }

    private static Map<String, Object> student(String code, String name, String cls, String birth, String gender) {
        Map<String, Object> m = new HashMap<>();
        m.put("code", code);
        m.put("name", name);
        m.put("class", cls);
        m.put("birthDate", birth);
        m.put("gender", gender);
        return m;
    }

    private static XlsxWriter.Tab tab(OnboardingSheet sheet, List<Map<String, Object>> rows) {
        List<XlsxWriter.Column> columns = sheet.columns().stream()
                .map(c -> new XlsxWriter.Column(c.key(), c.label(), "text")).toList();
        return new XlsxWriter.Tab(sheet.title(), new XlsxWriter.Sheet(sheet.title(), "", columns, rows));
    }

    private String currentYearLabel() {
        return jdbc.query("SELECT code, name FROM school_years WHERE is_current",
                rs -> rs.next() ? OnboardingValidator.schoolYearLabel(rs.getString(1), rs.getString(2)) : null);
    }

    private int count(long classId) {
        return jdbc.queryForObject("SELECT coalesce(student_count, -1) FROM school_classes WHERE id = ?", Integer.class,
                classId);
    }

    /** Một tài khoản mang vai {@code role}, không giới hạn cơ sở, của trường có lớp năm hiện hành; trả id trường. */
    private long signIn(String role) {
        List<String> names = jdbc.queryForList("""
                SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id
                JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id AND r.code = ?
                WHERE us.campus_id IS NULL AND EXISTS (SELECT 1 FROM school_classes k JOIN school_years y
                      ON y.id = k.school_year_id AND y.is_current WHERE k.school_id = us.school_id)
                ORDER BY u.username LIMIT 1""", String.class, role);
        Assumptions.assumeTrue(!names.isEmpty(), "Thiếu tài khoản " + role + " của trường có lớp");
        User user = signInAs(names.get(0));
        return jdbc.queryForObject("SELECT school_id FROM user_schools WHERE id = ?", Long.class, user.getId());
    }

    private User signInAs(String username) {
        User user = users.findByUsernameOrEmail(username).orElseThrow();
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
        return user;
    }
}
