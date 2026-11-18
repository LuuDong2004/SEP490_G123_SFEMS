package com.g123.sfems.module.security.user.service;

import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.domain.security.role.Role;
import com.g123.sfems.domain.security.user.SchoolUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.module.security.role.service.RoleService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.school.facility.CampusService;
import com.g123.sfems.module.security.user.api.dto.CampusRef;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.SchoolRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
import com.g123.sfems.module.security.user.api.dto.UserRequest;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.AuthoritiesChanged;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.context.ApplicationEventPublisher;
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
 *   <li>chỉ thấy / sửa tài khoản thuộc trường đó và chỉ mang vai loại trường ({@code roles.role_type = SCHOOL}) —
 *       tài khoản có vai Sở, UBND, quản trị là 404, kể cả khi nó gắn trường này;</li>
 *   <li>chỉ gán được vai phía trường;</li>
 *   <li>không tự đổi vai hay trạng thái của chính mình (tự khoá mình là mất lối vào).</li>
 * </ul>
 */
@Service
public class SchoolUserService {


    private final UserService users;
    private final PasswordResetService invites;
    private final RoleService roles;
    private final RowLevelPrincipalResolver principals;
    private final CampusService campuses;
    private final ApplicationEventPublisher events;

    public SchoolUserService(UserService users, RoleService roles, RowLevelPrincipalResolver principals,
            CampusService campuses, ApplicationEventPublisher events, PasswordResetService invites) {
        this.invites = invites;
        this.users = users;
        this.roles = roles;
        this.principals = principals;
        this.campuses = campuses;
        this.events = events;
    }

    /** Tài khoản vừa tạo / vừa đặt lại mật khẩu, kèm mật khẩu tạm (trả MỘT lần). */
    /** {@code invitedEmail}: email (đã che) nhận thư mời tự đặt mật khẩu; {@code null} = không gửi thư. */
    public record Issued(User user, String temporaryPassword, String invitedEmail) {
    }

    @Transactional(readOnly = true)
    public Page<User> list(ListParams params) {
        return users.listInSchool(params, schoolId());
    }

    @Transactional(readOnly = true)
    public User get(Long id) {
        User user = users.get(id);
        if (!(user instanceof SchoolUser member) || !member.getSchool().getId().equals(schoolId())
                || !onlySchoolRoles(user)) {
            throw new ResourceNotFoundException("User", id);
        }
        return user;
    }

    @Transactional
    public Issued create(String username, String fullName, String email, String role, CampusRef campus) {
        String cleanUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        String password = temporaryPassword();
        User user = users.create(new UserRequest(
                cleanUsername,
                email == null || email.isBlank() ? cleanUsername + PasswordResetService.PLACEHOLDER_DOMAIN : email.trim(),
                fullName == null ? "" : fullName.trim(),
                password,
                UserStatus.ACTIVE,
                new SchoolRef(schoolId()),
                null,
                List.of(new RoleRef(schoolRole(role).getId())),
                null));
        if (campus != null) {
            assignCampus(user, campus.id());
        }
        // Có email thật: gửi thư mời tự đặt mật khẩu (đi sau commit). Mật khẩu tạm vẫn trả về cho người cấp — lối
        // dự phòng khi máy chủ thư chưa cấu hình hoặc thư không tới.
        return new Issued(user, password, invites.invite(user));
    }

    @Transactional
    public User update(Long id, String fullName, String email, String role, UserStatus status, CampusRef campus) {
        User target = get(id);
        boolean self = CurrentUser.id().filter(target.getId()::equals).isPresent();
        if (self && (role != null || status != null)) {
            throw new FieldValidationException("role", "Không tự đổi vai trò hay trạng thái của chính mình");
        }
        if (campus != null) {
            Long current = target instanceof SchoolUser m && m.getCampus() != null ? m.getCampus().getId() : null;
            if (self && !Objects.equals(current, campus.id())) {
                throw new FieldValidationException("campus", "Không tự đổi phạm vi của chính mình");
            }
            assignCampus(target, campus.id());
        }
        return users.update(id, new UserPatchRequest(
                null,
                email == null || email.isBlank() ? null : email.trim(),
                fullName == null || fullName.isBlank() ? null : fullName.trim(),
                status,
                null,
                null,
                role == null ? null : List.of(new RoleRef(schoolRole(role).getId())),
                null));
    }

    @Transactional
    public Issued resetPassword(Long id) {
        get(id);
        String password = temporaryPassword();
        return new Issued(users.setPassword(id, password), password, null);
    }

    @Transactional
    public User delete(Long id) {
        get(id);
        return users.delete(id);
    }

    /**
     * Gán phạm vi cơ sở (270): {@code null} = cả trường. Cơ sở phải cùng trường với tài khoản và còn dùng. Đổi phạm vi
     * là đổi quyền: phát {@link AuthoritiesChanged.ForUser} như đổi vai, để yêu cầu kế tiếp của tài khoản đó (và tab
     * đang mở, qua {@code X-Auth-Version}) thấy phạm vi mới. Lối cấp tài khoản cho cán bộ cũng đi qua đây.
     */
    @Transactional
    public void assignCampus(User user, Long campusId) {
        if (!(user instanceof SchoolUser member)) {
            throw new FieldValidationException("campus", "Chỉ tài khoản trường có phạm vi cơ sở");
        }
        Campus campus = null;
        if (campusId != null) {
            try {
                campus = campuses.get(campusId);
            } catch (ResourceNotFoundException e) {
                throw new FieldValidationException("campus", "Cơ sở không thuộc trường");
            }
            if (!campus.getSchool().getId().equals(member.getSchool().getId())) {
                throw new FieldValidationException("campus", "Cơ sở không thuộc trường");
            }
            if (!Boolean.TRUE.equals(campus.getActive())) {
                throw new FieldValidationException("campus", "Cơ sở đã ngừng sử dụng");
            }
        }
        Long before = member.getCampus() == null ? null : member.getCampus().getId();
        if (Objects.equals(before, campusId)) {
            return;
        }
        member.setCampus(campus);
        events.publishEvent(new AuthoritiesChanged.ForUser(member.getId()));
    }

    private Long schoolId() {
        return principals.current()
                .map(RowLevelPrincipal::schoolId)
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không thuộc trường nào"));
    }

    private Role schoolRole(String code) {
        String c = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        return roles.getByCode(c, UserType.SCHOOL);
    }

    /** Tài khoản chỉ mang vai phía trường — điều kiện để lãnh đạo trường được đụng tới nó. */
    public static boolean onlySchoolRoles(User user) {
        return user.getRoles().stream().allMatch(r -> r.getRoleType() == UserType.SCHOOL);
    }

    /** Mật khẩu tạm do máy sinh, đạt {@code PasswordPolicy}. */
    public static String temporaryPassword() {
        return PasswordPolicy.temporary();
    }
}
