package com.g123.sfems.module.security.user.service;

import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.security.role.Role;
import com.g123.sfems.domain.security.user.AgencyUser;
import com.g123.sfems.domain.security.user.SchoolUser;
import com.g123.sfems.domain.security.user.SystemUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.shared.security.AdminIps;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.role.service.RoleService;
import com.g123.sfems.module.security.token.service.RefreshTokenService;
import com.g123.sfems.module.security.user.api.dto.ManagingBodyRef;
import com.g123.sfems.module.security.user.api.dto.SchoolRef;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
import com.g123.sfems.module.security.user.api.dto.UserProfileRequest;
import com.g123.sfems.module.security.user.api.dto.UserRequest;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.module.security.user.repo.UserSpecifications;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.AuthoritiesChanged;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.ListParams;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    /**
     * The role the system cannot afford to have nobody holding.
     *
     * <p>Only {@code users:write} and {@code roles:write} can restore access
     * once they are gone, and both are granted through this role in the seed
     * data — so the last active holder of it is protected from being demoted,
     * disabled or deleted.
     */
    private static final String ADMIN_ROLE_CODE = "ADMIN";

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE =
            Set.of("id", "username", "email", "fullName", "status", "createdAt", "lastLoginAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final UserRepository repository;

    // Roles are resolved through the role feature's own service rather than its
    // repository, which also means an unknown role id produces the same 404 the
    // role endpoints would.
    private final RoleService roleService;

    // Placement is resolved the same way roles are: through each feature's own
    // service, so an unknown id produces the same 404 that resource's endpoints
    // would. Neither of these depends on this service, so there is no cycle to
    // route around the way AuthorityCache needs an event.
    private final SchoolService schoolService;
    private final DepartmentOfEducationService managingBodyService;


    // Disabling an account or resetting its password has to end the sessions
    // already open under it, or the change would not take effect until the
    // refresh token expired days later.
    private final RefreshTokenService refreshTokenService;

    private final PasswordEncoder passwordEncoder;

    // Announces that somebody's grants moved, for the auth feature's cache to
    // act on. An event rather than a call to that cache, because the cache
    // needs this service to populate itself: a direct dependency each way is a
    // cycle Spring would refuse to construct. See AuthoritiesChanged.
    private final ApplicationEventPublisher events;

    public UserService(UserRepository repository,
                       RoleService roleService,
                       SchoolService schoolService,
                       DepartmentOfEducationService managingBodyService,
                       RefreshTokenService refreshTokenService,
                       PasswordEncoder passwordEncoder,
                       ApplicationEventPublisher events) {
        this.repository = repository;
        this.roleService = roleService;
        this.schoolService = schoolService;
        this.managingBodyService = managingBodyService;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
    }

    public Page<User> list(ListParams params) {
        return repository.findAll(
                UserSpecifications.from(params),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    /** Danh sách tài khoản của MỘT trường — cho màn "Tài khoản của trường" (SchoolUserService). */
    public Page<User> listInSchool(ListParams params, Long schoolId) {
        return repository.findAll(
                UserSpecifications.from(params)
                        .and((root, query, cb) -> cb.equal(cb.treat(root, SchoolUser.class).get("school").get("id"),
                                schoolId)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public User get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    /**
     * Những gì bộ nhớ đệm quyền cần biết về một tài khoản, đọc bằng ba câu chiếu hẹp thay vì
     * nạp cả thực thể (vai EAGER → quyền, trường, cơ quan). Rỗng khi không có tài khoản.
     */
    public Optional<AuthorityFacts> authorityFacts(long id) {
        List<Object[]> header = repository.authorityHeader(id);
        if (header.isEmpty()) {
            return Optional.empty();
        }
        Object[] h = header.get(0);
        Set<Long> roleIds = new TreeSet<>();
        Set<String> roleCodes = new TreeSet<>();
        for (Object[] role : repository.authorityRoles(id)) {
            roleIds.add(((Number) role[0]).longValue());
            roleCodes.add((String) role[1]);
        }
        Set<String> permissions = new TreeSet<>(repository.authorityPermissionCodes(id));
        return Optional.of(new AuthorityFacts(
                h[0] == UserStatus.ACTIVE, roleCodes, roleIds, permissions,
                h[1] == null ? null : ((Number) h[1]).longValue(),
                h[2] == null ? null : ((Number) h[2]).longValue(),
                (Instant) h[3],
                Boolean.TRUE.equals(h[4]) || Boolean.TRUE.equals(h[5])));
    }

    /** Tài khoản dưới dạng bộ nhớ đệm quyền đọc — xem {@link #authorityFacts}. Các tập đã sắp xếp. */
    public record AuthorityFacts(boolean canSignIn, Set<String> roleCodes, Set<Long> roleIds,
                                 Set<String> permissionCodes, Long schoolId, Long managingBodyId,
                                 Instant passwordChangedAt,
                                 /* Đã có lớp xác thực thứ hai (ứng dụng hoặc email) — cổng Admin bắt buộc. */
                                 boolean secondFactor) {
    }

    public List<User> getMany(List<Long> ids) {
        return repository.findAllById(ids);
    }

    /**
     * Resolves the identifier typed into the sign-in form, which may be a
     * username or an email address. Used by the auth feature.
     */
    public Optional<User> findForAuthentication(String identifier) {
        return repository.findByUsernameOrEmail(identifier.trim());
    }

    @Transactional
    public User create(UserRequest request) {
        String username = request.username().trim();
        String email = request.email().trim().toLowerCase();

        requireUsernameAvailable(username, null);
        requireEmailAvailable(email, null);
        Set<Role> roles = resolveRoles(request.roles());
        PasswordPolicy.check("password", request.password(), username, privileged(roles));

        School school = resolveSchool(request.school(), null);
        DepartmentOfEducation managingBody = resolveManagingBody(request.managingBody(), null);
        if (school != null && managingBody != null) {
            throw new FieldValidationException("managingBody", "Tài khoản trường không gắn cơ quan quản lý");
        }
        // Loại tài khoản theo đơn vị công tác (docs/kien-truc/11): trường → SCHOOL, Sở → SO, UBND → UBND, không → SYSTEM.
        UserType type = UserType.of(school, managingBody);
        requireRolesFitType(type, roles);
        if (type == UserType.SYSTEM) {
            requireSuperAdminCaller();
        }
        User user = User.create(
                type,
                username,
                email,
                passwordEncoder.encode(request.password()),
                request.fullName().trim(),
                request.status() == null ? UserStatus.ACTIVE : request.status(),
                school,
                managingBody);
        user.setRoles(roles);
        applyProfile(user, request.profile());

        return repository.save(user);
    }

    @Transactional
    public User update(Long id, UserPatchRequest request) {
        User user = get(id);
        requireMayManage(user);

        if (request.username() != null) {
            String username = request.username().trim();
            requireUsernameAvailable(username, user.getId());
            user.setUsername(username);
        }
        if (request.email() != null) {
            String email = request.email().trim().toLowerCase();
            requireEmailAvailable(email, user.getId());
            user.setEmail(email);
        }
        if (request.fullName() != null) {
            user.setFullName(request.fullName().trim());
        }

        // Đơn vị công tác cố định từ lúc tạo (docs/kien-truc/11, cột updatable = false ở bảng con): gửi lại đúng đơn vị
        // đang có thì được, đổi sang trường / cơ quan khác — hay đổi LOẠI — là tạo tài khoản mới.
        requireSameUnit("school", request.school() == null ? null : request.school().id(), request.school() != null,
                user.schoolOrNull() == null ? null : user.schoolOrNull().getId());
        requireSameUnit("managingBody", request.managingBody() == null ? null : request.managingBody().id(),
                request.managingBody() != null,
                user.managingBodyOrNull() == null ? null : user.managingBodyOrNull().getId());
        applyProfile(user, request.profile());

        // Both of these can take the last administrator away, so they are
        // checked against the state the request is asking for, not the state
        // the row is currently in.
        Set<Role> roles = request.roles() == null ? user.getRoles() : resolveRoles(request.roles());
        UserStatus status = request.status() == null ? user.getStatus() : request.status();
        requireAdminSurvives(user, roles, status);

        if (request.roles() != null) {
            requireRolesFitType(user.getUserType(), roles);
            user.setRoles(roles);
        }

        boolean wasActive = user.canSignIn();
        user.setStatus(status);
        User saved = repository.save(user);

        // An account that just stopped being able to sign in must also stop
        // being able to renew a token it already holds.
        if (wasActive && !saved.canSignIn()) {
            refreshTokenService.revokeAllFor(saved, Instant.now());
        }

        // Only when the request touched something authorisation depends on.
        // Correcting a surname changes nothing about what the account may do,
        // and evicting on it would throw away a cache entry for no reason.
        //
        // Trường công tác có mặt trong danh sách này vì nó giờ là ĐẦU VÀO của
        // phân quyền, không chỉ là thông tin tổ chức: một phạm vi dữ liệu đọc
        // user.schoolId, và principal trong cache được dựng từ entry này.
        // Không phát sự kiện ở đây thì chuyển một người sang trường khác chỉ có
        // hiệu lực khi cache hết hạn -- suy giảm chứ không sai, nhưng là một
        // phút họ vẫn còn thấy dữ liệu của trường cũ.
        if (request.roles() != null || request.status() != null) {
            events.publishEvent(new AuthoritiesChanged.ForUser(saved.getId()));
        }
        return saved;
    }

    /**
     * Sets somebody else's password, as an administrator.
     *
     * <p>Every session open under the account is ended, because the usual
     * reason to do this is that the account may be in the wrong hands.
     */
    @Transactional
    public User setPassword(Long id, String rawPassword) {
        User user = get(id);
        requireMayManage(user);
        PasswordPolicy.check("password", rawPassword, user.getUsername(), privileged(user.getRoles()));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        User saved = repository.save(user);
        refreshTokenService.revokeAllFor(saved, Instant.now());
        return saved;
    }

    /** Mật khẩu có đúng của tài khoản này không — xác nhận lại trước việc nguy hiểm (khôi phục sao lưu). */
    @Transactional(readOnly = true)
    public boolean passwordMatches(Long id, String rawPassword) {
        return rawPassword != null && passwordEncoder.matches(PasswordPolicy.strip(rawPassword), get(id).getPasswordHash());
    }

    /**
     * Changes the signed-in user's own password, having checked the current one.
     *
     * <p>Requiring the current password is what makes this safe on a machine
     * somebody walked away from: a stolen session alone should not be enough to
     * lock the real owner out of their account.
     */
    @Transactional
    public User changeOwnPassword(Long id, String currentPassword, String newPassword) {
        User user = get(id);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ConflictException("Mật khẩu hiện tại không đúng");
        }
        PasswordPolicy.check("newPassword", newPassword, user.getUsername(), privileged(user.getRoles()));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        User saved = repository.save(user);
        // Other sessions end; the one making the change gets a fresh pair back
        // from the controller, so the person changing their password is not
        // signed out by their own action.
        refreshTokenService.revokeAllFor(saved, Instant.now());
        return saved;
    }

    /** Stamps the successful sign-in. Called by the auth feature. */
    @Transactional
    public void recordLogin(User user, Instant when) {
        user.setLastLoginAt(when);
        repository.save(user);
    }

    @Transactional
    public User delete(Long id) {
        User user = get(id);
        requireMayManage(user);

        // Deleting the account you are signed in as is almost always a slip,
        // and it is unrecoverable. Disabling it is the reversible version of
        // whatever was intended.
        if (CurrentUser.id().filter(user.getId()::equals).isPresent()) {
            throw new ConflictException("Không xoá được chính tài khoản bạn đang đăng nhập");
        }
        requireAdminSurvives(user, Set.of(), UserStatus.INACTIVE);

        repository.delete(user);
        // The cache would find no row and drop the entry on its own, but only
        // when something next asks for it. Saying so outright means a token
        // held by the deleted account stops working immediately rather than at
        // the next lookup.
        events.publishEvent(new AuthoritiesChanged.ForUser(user.getId()));

        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return user;
    }

    private static boolean privileged(Set<Role> roles) {
        return PasswordPolicy.privileged(roles.stream().map(Role::getCode).toList());
    }

    private Set<Role> resolveRoles(List<RoleRef> refs) {
        List<Long> ids = refs.stream().map(RoleRef::id).toList();
        return new LinkedHashSet<>(roleService.resolveAll(ids));
    }

    /**
     * Trường mà request muốn gán, đã phân giải.
     *
     * <p>Tham chiếu có BA trạng thái, và chúng không phải một: vắng mặt là để
     * nguyên, {@code {"id": null}} là gỡ khỏi trường đang thuộc, {@code
     * {"id": n}} là gán. Phân biệt này không thể nằm ở mức trường của record —
     * Jackson báo cáo một đối tượng vắng mặt và một {@code null} tường minh
     * giống hệt nhau — nên {@link SchoolRef} mang id cho phép null thay vì một
     * id {@code @NotNull}.
     *
     * <p>Đi qua {@code SchoolService} chứ không qua repository của nó, nên một
     * id không tồn tại sinh ra đúng lỗi 404 mà endpoint của resource trường
     * sinh ra, thay vì một lỗi ràng buộc lúc flush.
     *
     * <p>Khối này trước đây là ba quy tắc để giữ bất biến "phòng ban phải
     * thuộc đúng tổ chức của người đó". Với một tham chiếu duy nhất thì bất
     * biến ấy không còn tồn tại, nên quy tắc cũng không.
     */
    /** Đơn vị gửi lên phải trùng đơn vị đang có — đơn vị không đổi được sau khi tạo. */
    private static void requireSameUnit(String field, Long requested, boolean present, Long current) {
        if (present && !Objects.equals(requested, current)) {
            throw new FieldValidationException(field,
                    "Không đổi được đơn vị công tác của tài khoản — tạo tài khoản mới");
        }
    }

    /**
     * Ghi phần riêng theo loại (bảng con). Ô không thuộc loại của tài khoản bị từ chối. Quản trị cấp cao và IP được
     * đăng nhập chỉ quản trị cấp cao đặt được — một quản trị thường không tự nâng mình hay nới IP của mình.
     */
    private void applyProfile(User user, UserProfileRequest profile) {
        if (profile == null) {
            return;
        }
        switch (user) {
            case SystemUser admin -> {
                rejectField("workPhone", profile.workPhone());
                // Form gửi lại nguyên giá trị đang có thì không phải là "đặt" — chỉ thay đổi thật mới cần quản trị cấp cao.
                String ips = profile.allowedIps() == null ? null : AdminIps.normalize(profile.allowedIps());
                boolean superChanges = profile.superAdmin() != null && profile.superAdmin() != admin.isSuperAdmin();
                boolean ipsChange = profile.allowedIps() != null && !Objects.equals(ips, admin.getAllowedIps());
                if (superChanges || ipsChange) {
                    requireSuperAdminCaller();
                }
                if (superChanges) {
                    if (admin.isSuperAdmin() && !profile.superAdmin() && admin.getId() != null
                            && repository.countActiveSuperAdmins() <= 1) {
                        throw new ConflictException("Phải còn ít nhất một quản trị cấp cao đang hoạt động");
                    }
                    admin.setSuperAdmin(profile.superAdmin());
                }
                if (ipsChange) {
                    admin.setAllowedIps(ips);
                }
                if (profile.jobTitle() != null) {
                    admin.setJobTitle(blankToNull(profile.jobTitle()));
                }
                if (profile.note() != null) {
                    admin.setNote(blankToNull(profile.note()));
                }
            }
            case AgencyUser agency -> {
                rejectAdminFields(profile);
                rejectField("note", profile.note());
                if (profile.jobTitle() != null) {
                    agency.setJobTitle(blankToNull(profile.jobTitle()));
                }
                if (profile.workPhone() != null) {
                    agency.setWorkPhone(blankToNull(profile.workPhone()));
                }
            }
            case SchoolUser member -> {
                rejectAdminFields(profile);
                rejectField("note", profile.note());
                rejectField("workPhone", profile.workPhone());
                if (profile.jobTitle() != null) {
                    member.setJobTitle(blankToNull(profile.jobTitle()));
                }
            }
            default -> throw new IllegalStateException("Loại tài khoản chưa xử lý: " + user.getUserType());
        }
    }

    private static void rejectAdminFields(UserProfileRequest profile) {
        rejectField("superAdmin", profile.superAdmin());
        rejectField("allowedIps", profile.allowedIps());
    }

    private static void rejectField(String field, Object value) {
        if (value != null) {
            throw new FieldValidationException("profile." + field, "Ô này không dùng cho loại tài khoản này");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Tài khoản quản trị của NGƯỜI KHÁC chỉ quản trị cấp cao được sửa / đặt mật khẩu / xoá; tự sửa mình thì được. */
    private void requireMayManage(User target) {
        if (target instanceof SystemUser && CurrentUser.id().filter(target.getId()::equals).isEmpty()) {
            requireSuperAdminCaller();
        }
    }

    /** Người đang gọi phải là quản trị cấp cao. Không có người gọi (job, seed) thì cho qua. */
    private void requireSuperAdminCaller() {
        Optional<Long> caller = CurrentUser.id();
        if (caller.isEmpty()) {
            return;
        }
        boolean superAdmin = repository.findById(caller.get())
                .filter(SystemUser.class::isInstance)
                .map(u -> ((SystemUser) u).isSuperAdmin())
                .orElse(false);
        if (!superAdmin) {
            throw new ConflictException("Chỉ quản trị cấp cao được đặt quyền quản trị cấp cao và IP được đăng nhập");
        }
    }

    /** Tài khoản chỉ mang vai cùng loại (vd. ADMIN chỉ cho quản trị, SO_LEADER chỉ cho Sở) — docs/kien-truc/11 §11. */
    private static void requireRolesFitType(UserType type, Set<Role> roles) {
        for (Role role : roles) {
            if (role.getRoleType() != type) {
                throw new FieldValidationException("roles",
                        "Vai \"" + role.getName() + "\" không dùng cho tài khoản " + type.label().toLowerCase());
            }
        }
    }

    private School resolveSchool(SchoolRef ref, School current) {
        if (ref == null) {
            return current;
        }
        return ref.id() == null ? null : schoolService.get(ref.id());
    }

    /**
     * Cơ quan quản lý mà request muốn gán, đã phân giải.
     *
     * <p>Ba trạng thái và lý do đi qua service chứ không qua repository: giống
     * hệt {@link #resolveSchool}.
     *
     * <p>Không kiểm "chỉ một trong hai được khác rỗng": tài khoản quản trị hợp
     * lệ mà cả hai đều rỗng, và một người kiêm nhiệm cả hai phía là chuyện có
     * thật. Phạm vi dữ liệu xử lý được cả hai vì mỗi chính sách chỉ đọc khoá
     * ngữ cảnh của riêng nó.
     */
    private DepartmentOfEducation resolveManagingBody(ManagingBodyRef ref, DepartmentOfEducation current) {
        if (ref == null) {
            return current;
        }
        return ref.id() == null ? null : managingBodyService.get(ref.id());
    }

    /**
     * Refuses a change that would leave no active administrator.
     *
     * @param user   the account being changed
     * @param roles  the roles it would hold afterwards
     * @param status the status it would have afterwards
     */
    private void requireAdminSurvives(User user, Set<Role> roles, UserStatus status) {
        boolean wasAdmin = user.roleCodes().contains(ADMIN_ROLE_CODE) && user.canSignIn();
        boolean staysAdmin = roles.stream().anyMatch(role -> ADMIN_ROLE_CODE.equals(role.getCode()))
                && status == UserStatus.ACTIVE;

        if (wasAdmin && !staysAdmin && repository.countActiveWithRole(ADMIN_ROLE_CODE) <= 1) {
            throw new ConflictException(
                    "Đây là quản trị viên đang hoạt động cuối cùng — cấp quyền quản trị cho một tài khoản khác trước");
        }
    }

    private void requireUsernameAvailable(String username, Long selfId) {
        repository.findByUsernameIgnoreCase(username).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Tên đăng nhập %s đã có người dùng".formatted(username));
            }
        });
    }

    private void requireEmailAvailable(String email, Long selfId) {
        repository.findByEmailIgnoreCase(email).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Email %s đã được dùng cho một tài khoản khác".formatted(email));
            }
        });
    }

    /** Các phiên đăng nhập đang mở của một tài khoản — quản trị viên xem (QLTB-242). */
    @Transactional(readOnly = true)
    public List<RefreshTokenService.SessionView> sessions(Long id) {
        return refreshTokenService.sessions(get(id).getId(), Instant.now());
    }

    /** Quản trị viên đăng xuất một phiên của tài khoản. */
    @Transactional
    public boolean endSession(Long id, String sessionId) {
        return refreshTokenService.revokeSession(get(id).getId(), sessionId, Instant.now());
    }
}
