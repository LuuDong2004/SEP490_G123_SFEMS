package com.g123.sfems.module.school.student;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.permission.Permission;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.school.student.StudentGender;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.schoolclass.SchoolClassPatchRequest;
import com.g123.sfems.module.school.schoolclass.SchoolClassService;
import com.g123.sfems.module.security.permission.repo.PermissionRepository;
import com.g123.sfems.module.security.permission.service.PermissionGrants;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.JwtService;
import com.g123.sfems.shared.web.portal.Portal;
import com.g123.sfems.shared.web.portal.PortalRoutes;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/**
 * Danh sách học sinh (304): sĩ số lớp tự đếm khi thêm, chuyển lớp, ngừng, xoá học sinh; lớp chưa có học sinh giữ sĩ
 * số nhập tay; sĩ số lớp đã có danh sách không sửa tay. Quyền học sinh chỉ ở vai loại trường. Chạy trong giao dịch, lùi
 * hết sau mỗi test.
 */
@SpringBootTest
@Transactional
class StudentClassCountTest {

    @Autowired
    StudentService students;

    @Autowired
    SchoolClassService classes;

    @Autowired
    PermissionRepository permissions;

    @Autowired
    JdbcTemplate jdbc;

    @PersistenceContext
    EntityManager entityManager;

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
    void classSizeFollowsTheStudentList() {
        long school = signInLeader();
        List<Long> picked = jdbc.queryForList("""
                SELECT k.id FROM school_classes k JOIN school_years y ON y.id = k.school_year_id AND y.is_current
                WHERE k.school_id = ? AND NOT EXISTS (SELECT 1 FROM students s WHERE s.class_id = k.id)
                ORDER BY k.sort_order, k.id LIMIT 3""", Long.class, school);
        Assumptions.assumeTrue(picked.size() == 3, "Trường mẫu cần ít nhất ba lớp năm hiện hành chưa có học sinh");
        long a = picked.get(0);
        long b = picked.get(1);
        long untouched = picked.get(2);
        jdbc.update("UPDATE school_classes SET student_count = 40 WHERE id IN (?, ?)", a, untouched);

        // Thêm: lớp có học sinh đầu tiên thì sĩ số = số học sinh, bỏ số nhập tay.
        var s1 = students.create(request("TEST-HS-1", "Nguyễn Văn Thử", a));
        assertThat(count(a)).isEqualTo(1);
        var s2 = students.create(request("TEST-HS-2", "Trần Thị Thử", a));
        var s3 = students.create(request("TEST-HS-3", "Lê Minh Thử", b));
        assertThat(count(a)).isEqualTo(2);
        assertThat(count(b)).isEqualTo(1);
        // Mã trùng trong cùng lớp bị từ chối; lớp khác cùng mã thì được.
        assertThatThrownBy(() -> students.create(request("test-hs-1", "Phạm Văn Trùng", a)))
                .isInstanceOf(ConflictException.class);

        // Chuyển lớp: cả lớp đi lẫn lớp đến đếm lại.
        students.update(s2.getId(), patch(null, b));
        assertThat(count(a)).isEqualTo(1);
        assertThat(count(b)).isEqualTo(2);
        // Ngừng: không tính vào sĩ số, lớp vẫn là lớp có danh sách (0, không trả về số nhập tay).
        students.update(s1.getId(), patch(false, null));
        assertThat(count(a)).isZero();
        // Xoá.
        students.delete(s3.getId());
        assertThat(count(b)).isEqualTo(1);
        // Lớp không có học sinh nào giữ nguyên sĩ số nhập tay.
        assertThat(count(untouched)).isEqualTo(40);

        // Lớp đã có danh sách: sĩ số không sửa tay, không xoá được lớp.
        assertThatThrownBy(() -> classes.update(b, new SchoolClassPatchRequest(null, null, null, null, null, null, null,
                null, null, null, 35))).isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("tự đếm");
        assertThatThrownBy(() -> classes.delete(b)).isInstanceOf(ConflictException.class);
        // Gửi lại đúng sĩ số đang có (hộp sửa gửi đủ ô) thì vẫn lưu được.
        classes.update(b, new SchoolClassPatchRequest(null, null, null, null, "ghi chú thử", null, null, null, null,
                null, 1));
        // Lớp chưa có học sinh vẫn sửa tay như cũ.
        classes.update(untouched, new SchoolClassPatchRequest(null, null, null, null, null, null, null, null, null,
                null, 38));
        entityManager.flush();
        assertThat(count(untouched)).isEqualTo(38);
    }

    @Test
    void onlySchoolRolesHoldStudentPermissions() {
        for (String role : List.of("SO_LEADER", "SO_SPECIALIST", "ADMIN")) {
            assertThat(jdbc.queryForObject("""
                    SELECT count(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
                    JOIN permissions p ON p.id = rp.permission_id WHERE r.code = ? AND p.code LIKE 'students:%'""",
                    Long.class, role)).as(role).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM row_level_policy p JOIN roles r ON r.id = p.role_id"
                    + " WHERE r.code = ? AND p.resource = 'students'", Long.class, role)).as(role).isZero();
        }
        // Vai trường mang đúng như trên lớp học.
        for (String role : List.of("SCHOOL_LEADER", "SCHOOL_STAFF")) {
            List<String> onClasses = actions(role, "school_classes");
            assertThat(actions(role, "students")).as(role).isEqualTo(onClasses).contains("read");
        }
        // Cổng: chỉ cổng trường; quyền chỉ cấp được cho vai loại trường — ở service lẫn ở CSDL.
        assertThat(PortalRoutes.rule("students").read()).isEqualTo(EnumSet.of(Portal.SCHOOL));
        assertThat(PortalRoutes.rule("students").write()).isEqualTo(EnumSet.of(Portal.SCHOOL));
        for (Permission p : permissions.findAll()) {
            if (p.getCode().startsWith("students:")) {
                assertThat(PermissionGrants.grantable(p, UserType.SO)).as(p.getCode()).isFalse();
                assertThat(PermissionGrants.grantable(p, UserType.SYSTEM)).as(p.getCode()).isFalse();
                assertThat(PermissionGrants.grantable(p, UserType.SCHOOL)).as(p.getCode()).isTrue();
            }
        }
        Long read = jdbc.queryForObject("SELECT id FROM permissions WHERE code = 'students:read'", Long.class);
        for (String role : List.of("SO_LEADER", "ADMIN")) {
            Long roleId = jdbc.queryForObject("SELECT id FROM roles WHERE code = ?", Long.class, role);
            jdbc.execute("SAVEPOINT refused");
            assertThatThrownBy(() -> jdbc.update("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                    roleId, read)).isInstanceOf(DataAccessException.class).hasMessageContaining("học sinh");
            jdbc.execute("ROLLBACK TO SAVEPOINT refused");
        }
    }

    private List<String> actions(String role, String resource) {
        return jdbc.queryForList("""
                SELECT split_part(p.code, ':', 2) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id WHERE r.code = ? AND split_part(p.code, ':', 1) = ?
                ORDER BY 1""", String.class, role, resource);
    }

    private int count(long classId) {
        return jdbc.queryForObject("SELECT coalesce(student_count, -1) FROM school_classes WHERE id = ?", Integer.class,
                classId);
    }

    private static StudentRequest request(String code, String name, long classId) {
        return new StudentRequest(code, name, null, true, null, null, new IdRef(classId), LocalDate.of(2010, 5, 14),
                StudentGender.MALE);
    }

    private static StudentPatchRequest patch(Boolean active, Long classId) {
        return new StudentPatchRequest(null, null, null, active, null, null,
                classId == null ? null : new IdRef(classId), LocalDate.of(2010, 5, 14), StudentGender.FEMALE);
    }

    /** Lãnh đạo trường (không giới hạn cơ sở) của một trường có lớp năm học hiện hành; trả id trường. */
    private long signInLeader() {
        List<String> names = jdbc.queryForList("""
                SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id
                JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id AND r.code = 'SCHOOL_LEADER'
                WHERE us.campus_id IS NULL AND EXISTS (SELECT 1 FROM school_classes k JOIN school_years y
                      ON y.id = k.school_year_id AND y.is_current WHERE k.school_id = us.school_id)
                ORDER BY u.username LIMIT 1""", String.class);
        Assumptions.assumeTrue(!names.isEmpty(), "Thiếu tài khoản lãnh đạo trường có lớp");
        User user = users.findByUsernameOrEmail(names.get(0)).orElseThrow();
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
        return jdbc.queryForObject("SELECT school_id FROM user_schools WHERE id = ?", Long.class, user.getId());
    }
}
