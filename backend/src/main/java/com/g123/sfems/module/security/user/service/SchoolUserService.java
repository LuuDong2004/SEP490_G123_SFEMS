package com.g123.sfems.module.security.user.service;

import com.g123.sfems.domain.security.role.Role;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.module.security.role.service.RoleService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.SchoolRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
import com.g123.sfems.module.security.user.api.dto.UserRequest;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản trị tài khoản DƯỚI CẤP TRƯỜNG — màn "Tài khoản của trường" của lãnh đạo trường.
 *
 * <p>Không phải {@code users:write}: mã quyền đó sửa được mọi tài khoản của mọi trường, kể cả tự
 * gán ADMIN, vì bảng {@code users} không có phạm vi dòng (CLAUDE.md, mục 072). Lối này tự giới hạn:
 *
 * <ul>
 *   <li>trường là trường của NGƯỜI GỌI, lấy từ principal — không nhận từ request;</li>
 *   <li>chỉ thấy / sửa tài khoản thuộc trường đó và chỉ mang vai phía trường ({@link #SCHOOL_ROLES}) —
 *       tài khoản có vai Sở, UBND, quản trị là 404, kể cả khi nó gắn trường này;</li>
 *   <li>chỉ gán được vai phía trường;</li>
 *   <li>không tự đổi vai hay trạng thái của chính mình (tự khoá mình là mất lối vào).</li>
 * </ul>
 */
@Service
public class SchoolUserService {

    /** Vai phía trường — lối quản trị cấp trường chỉ gán và chỉ chạm tới các vai này. */
    public static final Set<String> SCHOOL_ROLES = Set.of("TEACHER", "SCHOOL_STAFF", "SUBJECT_HEAD", "SCHOOL_LEADER");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserService users;
    private final RoleService roles;
    private final RowLevelPrincipalResolver principals;

    public SchoolUserService(UserService users, RoleService roles, RowLevelPrincipalResolver principals) {
        this.users = users;
        this.roles = roles;
        this.principals = principals;
    }

    /** Tài khoản vừa tạo / vừa đặt lại mật khẩu, kèm mật khẩu tạm (trả MỘT lần). */
    public record Issued(User user, String temporaryPassword) {
    }

    @Transactional(readOnly = true)
    public Page<User> list(ListParams params) {
        return users.listInSchool(params, schoolId());
    }

    @Transactional(readOnly = true)
    public User get(Long id) {
        User user = users.get(id);
        if (user.getSchool() == null || !user.getSchool().getId().equals(schoolId()) || !onlySchoolRoles(user)) {
            throw new ResourceNotFoundException("User", id);
        }
        return user;
    }

    @Transactional
    public Issued create(String username, String fullName, String email, String role) {
        String cleanUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        String password = temporaryPassword();
        User user = users.create(new UserRequest(
                cleanUsername,
                email == null || email.isBlank() ? cleanUsername + "@qltb.local" : email.trim(),
                fullName == null ? "" : fullName.trim(),
                password,
                UserStatus.ACTIVE,
                new SchoolRef(schoolId()),
                null,
                List.of(new RoleRef(schoolRole(role).getId()))));
        return new Issued(user, password);
    }

    @Transactional
    public User update(Long id, String fullName, String email, String role, UserStatus status) {
        User target = get(id);
        boolean self = CurrentUser.id().filter(target.getId()::equals).isPresent();
        if (self && (role != null || status != null)) {
            throw new FieldValidationException("role", "Không tự đổi vai trò hay trạng thái của chính mình");
        }
        return users.update(id, new UserPatchRequest(
                null,
                email == null || email.isBlank() ? null : email.trim(),
                fullName == null || fullName.isBlank() ? null : fullName.trim(),
                status,
                null,
                null,
                role == null ? null : List.of(new RoleRef(schoolRole(role).getId()))));
    }

    @Transactional
    public Issued resetPassword(Long id) {
        get(id);
        String password = temporaryPassword();
        return new Issued(users.setPassword(id, password), password);
    }

    @Transactional
    public User delete(Long id) {
        get(id);
        return users.delete(id);
    }

    private Long schoolId() {
        return principals.current()
                .map(RowLevelPrincipal::schoolId)
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không thuộc trường nào"));
    }

    private Role schoolRole(String code) {
        String c = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (!SCHOOL_ROLES.contains(c)) {
            throw new FieldValidationException("role", "Chỉ gán được vai Giáo viên, Cán bộ thiết bị, Trưởng bộ môn hoặc Lãnh đạo trường");
        }
        return roles.getByCode(c);
    }

    private static boolean onlySchoolRoles(User user) {
        return user.getRoles().stream().allMatch(r -> SCHOOL_ROLES.contains(r.getCode()));
    }

    /** Tám ký tự đủ bốn loại theo {@code PasswordPolicy}: hoa, thường, số, ký tự đặc biệt. */
    public static String temporaryPassword() {
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghijkmnpqrstuvwxyz";
        String digit = "23456789";
        String special = "@#!";
        StringBuilder sb = new StringBuilder();
        sb.append(upper.charAt(RANDOM.nextInt(upper.length())));
        for (int i = 0; i < 4; i++) {
            sb.append(lower.charAt(RANDOM.nextInt(lower.length())));
        }
        sb.append(special.charAt(RANDOM.nextInt(special.length())));
        for (int i = 0; i < 3; i++) {
            sb.append(digit.charAt(RANDOM.nextInt(digit.length())));
        }
        return sb.toString();
    }
}
