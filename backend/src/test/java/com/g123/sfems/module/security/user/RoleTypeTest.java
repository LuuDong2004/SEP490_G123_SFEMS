package com.g123.sfems.module.security.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.permission.Permission;
import com.g123.sfems.domain.security.permission.PermissionScope;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.module.security.permission.repo.PermissionRepository;
import com.g123.sfems.module.security.role.api.dto.PermissionRef;
import com.g123.sfems.module.security.role.api.dto.RoleRequest;
import com.g123.sfems.module.security.role.service.RoleService;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.portal.Portal;
import com.g123.sfems.shared.web.portal.PortalRoutes;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Vai và quyền có loại (docs/kien-truc/11 §11, changelog 235): phạm vi của quyền khớp bảng cổng; vai chỉ mang quyền
 * hợp loại; tài khoản chỉ mang vai cùng loại — ở service lẫn ở CSDL. Chạy trong giao dịch, lùi hết sau mỗi test.
 */
@SpringBootTest
@Transactional
class RoleTypeTest {

    private static final Set<String> READ_ACTIONS = Set.of("read", "export");

    @Autowired
    PermissionRepository permissions;

    @Autowired
    RoleService roles;

    @Autowired
    UserService users;

    @Autowired
    UserRepository userRepository;

    @Autowired
    JdbcTemplate jdbc;

    /** Quyền SYSTEM ⟺ chỉ cổng Admin mở thao tác đó; quyền mở ở cổng nghiệp vụ nào đó thì không phải SYSTEM. */
    @Test
    void permissionScopeFollowsPortalRoutes() {
        List<String> wrong = new ArrayList<>();
        for (Permission permission : permissions.findAll()) {
            String[] parts = permission.getCode().split(":");
            PortalRoutes.Rule rule = PortalRoutes.rule(parts[0]);
            if (rule == null) {
                continue;
            }
            Set<Portal> open = READ_ACTIONS.contains(parts[1]) ? rule.read() : rule.write();
            boolean adminOnly = open.equals(EnumSet.of(Portal.ADMIN));
            if (adminOnly != (permission.getScope() == PermissionScope.SYSTEM) && !open.isEmpty()) {
                wrong.add(permission.getCode() + " là " + permission.getScope() + ", cổng mở " + open);
            }
        }
        assertThat(wrong).isEmpty();
    }

    @Test
    void everyRoleHoldsOnlyFittingPermissions() {
        Long misfits = jdbc.queryForObject("""
                SELECT count(*) FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
                WHERE r.role_type <> 'SYSTEM' AND p.scope = 'SYSTEM'""", Long.class);
        assertThat(misfits).isZero();
        Long wrongHolders = jdbc.queryForObject("""
                SELECT count(*) FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id
                WHERE r.role_type <> u.user_type""", Long.class);
        assertThat(wrongHolders).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM roles WHERE code IN ('TEACHER', 'SUBJECT_HEAD')",
                Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE username = 'viewer'", Long.class)).isZero();
        // Quản trị viên chỉ cấu hình, hỗ trợ, quản trị hệ thống (284): dữ liệu nghiệp vụ chỉ xem, xuất.
        assertThat(adminHas("users:write")).isTrue();
        assertThat(adminHas("roles:write")).isTrue();
        assertThat(adminHas("approval_flows:write")).isTrue();
        assertThat(adminHas("equipment:read")).isTrue();
        assertThat(adminHas("purchase_proposals:read")).isTrue();
        assertThat(adminHas("inventory_sessions:export")).isTrue();
        assertThat(adminHas("equipment:write")).isFalse();
        assertThat(adminHas("equipment_intakes:approve")).isFalse();
        assertThat(adminHas("purchase_proposals:write")).isFalse();
        assertThat(adminHas("procurement_plans:approve")).isFalse();
        assertThat(adminHas("inventory_sessions:write")).isFalse();
        assertThat(adminHas("school_year_profiles:confirm")).isFalse();
    }

    private boolean adminHas(String code) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id WHERE r.code = 'ADMIN' AND p.code = ?)""",
                Boolean.class, code));
    }

    @Test
    void roleRefusesPermissionOfAnotherScope() {
        Long equipmentRead = permissionId("equipment:read");
        Long usersRead = permissionId("users:read");
        Long notifications = permissionId("notifications:read");
        // Vai quản trị mang được quyền nghiệp vụ (237); vai trường không mang quyền quản trị.
        assertThat(roles.create(new RoleRequest("QT_THU", "Quản trị thử", null, UserType.SYSTEM,
                List.of(new PermissionRef(equipmentRead), new PermissionRef(usersRead)))).getPermissions()).hasSize(2);
        assertThatThrownBy(() -> roles.create(new RoleRequest("TRUONG_THU", "Trường thử", null, UserType.SCHOOL,
                List.of(new PermissionRef(usersRead)))))
                .isInstanceOf(FieldValidationException.class);
        assertThat(roles.create(new RoleRequest("TRUONG_THU", "Trường thử", null, UserType.SCHOOL,
                List.of(new PermissionRef(equipmentRead), new PermissionRef(notifications)))).getRoleType())
                .isEqualTo(UserType.SCHOOL);
    }

    @Test
    void accountRefusesRoleOfAnotherType() {
        User member = userRepository.findByUsernameOrEmail("thcs.canbo").orElse(null);
        Assumptions.assumeTrue(member != null, "Thiếu tài khoản demo thcs.canbo");
        Long soLeader = jdbc.queryForObject("SELECT id FROM roles WHERE code = 'SO_LEADER'", Long.class);
        assertThatThrownBy(() -> users.update(member.getId(), new UserPatchRequest(null, null, null, null, null, null,
                List.of(new RoleRef(soLeader)), null)))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void databaseRefusesMisfits() {
        Long soLeader = jdbc.queryForObject("SELECT id FROM roles WHERE code = 'SO_LEADER'", Long.class);
        Long schoolUser = jdbc.queryForObject("SELECT min(id) FROM user_schools", Long.class);
        Long schoolStaff = jdbc.queryForObject("SELECT id FROM roles WHERE code = 'SCHOOL_STAFF'", Long.class);
        assertRefused("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", schoolStaff,
                permissionId("users:read"));
        assertRefused("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", schoolUser, soLeader);
        assertRefused("UPDATE roles SET role_type = 'SCHOOL' WHERE id = ?", soLeader);
    }

    /** Mỗi câu bị chặn trong một điểm lưu riêng — lỗi làm hỏng giao dịch, câu sau sẽ "đỏ" vì lý do khác. */
    private void assertRefused(String sql, Object... args) {
        jdbc.execute("SAVEPOINT refused");
        assertThatThrownBy(() -> jdbc.update(sql, args)).isInstanceOf(DataAccessException.class)
                .hasMessageContaining("loại");
        jdbc.execute("ROLLBACK TO SAVEPOINT refused");
    }

    private Long permissionId(String code) {
        return jdbc.queryForObject("SELECT id FROM permissions WHERE code = ?", Long.class, code);
    }
}
