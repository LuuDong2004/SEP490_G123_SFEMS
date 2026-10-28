package com.g123.sfems.module.security.user.service;

import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.security.role.Role;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.role.service.RoleService;
import com.g123.sfems.module.security.token.service.RefreshTokenService;
import com.g123.sfems.module.security.user.api.dto.ManagingBodyRef;
import com.g123.sfems.module.security.user.api.dto.SchoolRef;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
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
import java.util.Optional;
import java.util.Set;
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
                        .and((root, query, cb) -> cb.equal(root.get("school").get("id"), schoolId)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public User get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
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
        PasswordPolicy.check("password", request.password(), username);

        User user = new User(
                username,
                email,
                passwordEncoder.encode(request.password()),
                request.fullName().trim(),
                request.status() == null ? UserStatus.ACTIVE : request.status());
        user.setRoles(resolveRoles(request.roles()));

        user.setSchool(resolveSchool(request.school(), null));
        user.setManagingBody(resolveManagingBody(request.managingBody(), null));

        return repository.save(user);
    }

    @Transactional
    public User update(Long id, UserPatchRequest request) {
        User user = get(id);

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

        // Một request có thể đổi trường, giữ nguyên, hoặc gỡ hẳn khỏi trường.
        user.setSchool(resolveSchool(request.school(), user.getSchool()));
        user.setManagingBody(resolveManagingBody(request.managingBody(), user.getManagingBody()));

        // Both of these can take the last administrator away, so they are
        // checked against the state the request is asking for, not the state
        // the row is currently in.
        Set<Role> roles = request.roles() == null ? user.getRoles() : resolveRoles(request.roles());
        UserStatus status = request.status() == null ? user.getStatus() : request.status();
        requireAdminSurvives(user, roles, status);

        if (request.roles() != null) {
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
        if (request.roles() != null || request.status() != null
                || request.school() != null || request.managingBody() != null) {
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
        PasswordPolicy.check("password", rawPassword, user.getUsername());
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
        PasswordPolicy.check("newPassword", newPassword, user.getUsername());
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
