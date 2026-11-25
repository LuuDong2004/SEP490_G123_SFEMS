package com.g123.sfems.domain.security.user;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.security.permission.Permission;
import com.g123.sfems.domain.security.role.Role;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorColumn;
import jakarta.persistence.DiscriminatorType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import org.hibernate.annotations.DynamicUpdate;

/**
 * An account that can sign in.
 *
 * <p>The password is only ever held as {@link #getPasswordHash()} and never
 * leaves this class in any other form: no DTO exposes it, and the service layer
 * only ever writes an already-encoded value into it.
 *
 * <p>Ba loại tài khoản ({@link UserType}) là ba lớp con JOINED (docs/kien-truc/11, theo khung qlvb-app):
 * {@code users} chỉ giữ phần đăng nhập (tên, mật khẩu, khoá, xác thực qua email, vai); phần riêng từng loại ở bảng con —
 * {@link SystemUser} ({@code user_systems}), {@link SoUser} ({@code user_sos}), {@link SchoolUser} ({@code user_schools}). Trường / cơ quan quản lý là cột NOT NULL, không
 * đổi được của bảng con: tài khoản Sở không có ô "trường" để đọc nhầm. {@code users.user_type} là cột phân loại.
 * Loại cố định từ lúc tạo — tạo bằng {@link #create}.
 *
 * <p>{@code @DynamicUpdate}: lưu chỉ ghi những cột đã đổi. Các bước đăng nhập ghi bộ đếm sai, mã email trong
 * giao dịch RIÊNG ({@code LoginGuard}, {@code EmailMfaService}); không có nó, lần lưu
 * {@code lastLoginAt} của giao dịch đăng nhập ghi đè cả hàng bằng bản trong bộ nhớ — mã email vừa dùng sống lại.
 */
@Entity
@DynamicUpdate
@Table(name = "users")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "user_type", discriminatorType = DiscriminatorType.STRING, length = 16)
public abstract class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String username;

    @Column(nullable = false, length = 255, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    /** Lần đặt / đổi mật khẩu gần nhất — nhắc đổi định kỳ. Đặt cùng lúc với {@link #passwordHash}. */
    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private UserStatus status = UserStatus.ACTIVE;

    // Eager: the list view renders the role badges on every row, and signing in
    // needs the whole role graph to mint a token, so a lazy proxy here would
    // only turn one query into N.
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    /** Số lần nhập sai mã qua email liên tiếp; đủ 5 thì khoá nhập mã 5 phút ({@code mfaLockedUntil}). */
    @Column(name = "mfa_failed_attempts", nullable = false)
    private int mfaFailedAttempts;

    @Column(name = "mfa_locked_until")
    private Instant mfaLockedUntil;

    /** Số lần sai mật khẩu liên tiếp; đủ 5 thì khoá tạm ({@code loginLockedUntil}) và đếm lại từ 0. */
    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount;

    @Column(name = "login_locked_until")
    private Instant loginLockedUntil;

    /** Xác thực qua email: mã 6 số gửi tới {@code email} mỗi lần đăng nhập. */
    @Column(name = "mfa_email", nullable = false)
    private boolean mfaEmail;

    /** Băm SHA-256 của mã email đang chờ nhập — không bao giờ lưu mã. */
    @Column(name = "email_code_hash", length = 64)
    private String emailCodeHash;

    @Column(name = "email_code_expires_at")
    private Instant emailCodeExpiresAt;

    @Column(name = "email_code_sent_at")
    private Instant emailCodeSentAt;

    public int getFailedLoginCount() {
        return failedLoginCount;
    }

    public void setFailedLoginCount(int failedLoginCount) {
        this.failedLoginCount = failedLoginCount;
    }

    public Instant getLoginLockedUntil() {
        return loginLockedUntil;
    }

    public void setLoginLockedUntil(Instant loginLockedUntil) {
        this.loginLockedUntil = loginLockedUntil;
    }

    public boolean isMfaEmail() {
        return mfaEmail;
    }

    public void setMfaEmail(boolean mfaEmail) {
        this.mfaEmail = mfaEmail;
    }

    public String getEmailCodeHash() {
        return emailCodeHash;
    }

    public void setEmailCodeHash(String emailCodeHash) {
        this.emailCodeHash = emailCodeHash;
    }

    public Instant getEmailCodeExpiresAt() {
        return emailCodeExpiresAt;
    }

    public void setEmailCodeExpiresAt(Instant emailCodeExpiresAt) {
        this.emailCodeExpiresAt = emailCodeExpiresAt;
    }

    public Instant getEmailCodeSentAt() {
        return emailCodeSentAt;
    }

    public void setEmailCodeSentAt(Instant emailCodeSentAt) {
        this.emailCodeSentAt = emailCodeSentAt;
    }

    public int getMfaFailedAttempts() {
        return mfaFailedAttempts;
    }

    public void setMfaFailedAttempts(int mfaFailedAttempts) {
        this.mfaFailedAttempts = mfaFailedAttempts;
    }

    public Instant getMfaLockedUntil() {
        return mfaLockedUntil;
    }

    public void setMfaLockedUntil(Instant mfaLockedUntil) {
        this.mfaLockedUntil = mfaLockedUntil;
    }

    protected User() {
        // for JPA
    }

    /**
     * Tài khoản mới đúng lớp của {@code type}, gắn đúng đơn vị của loại đó: SCHOOL cần {@code school}, SO cần
     * {@code managingBody}, SYSTEM không cần gì. Đơn vị thừa / thiếu so với loại là lỗi lập trình — báo ngay.
     */
    public static User create(UserType type, String username, String email, String passwordHash, String fullName,
            UserStatus status, School school, DepartmentOfEducation managingBody) {
        boolean needsSchool = type == UserType.SCHOOL;
        boolean needsBody = type == UserType.SO;
        if (needsSchool != (school != null) || needsBody != (managingBody != null)) {
            throw new IllegalArgumentException("Đơn vị không khớp loại tài khoản " + type);
        }
        return switch (type) {
            case SYSTEM -> new SystemUser(username, email, passwordHash, fullName, status);
            case SO -> new SoUser(username, email, passwordHash, fullName, status, managingBody);
            case SCHOOL -> new SchoolUser(username, email, passwordHash, fullName, status, school);
        };
    }

    /** Loại tài khoản — cố định theo lớp con. */
    public abstract UserType getUserType();

    protected User(String username, String email, String passwordHash, String fullName, UserStatus status) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.passwordChangedAt = Instant.now();
        this.fullName = fullName;
        this.status = status;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    /**
     * Every permission code this user holds, from every role, de-duplicated.
     *
     * <p>This is what is stamped into the access token at login, which is why
     * authorising a request never touches the database.
     */
    public Set<String> permissionCodes() {
        Set<String> codes = new TreeSet<>();
        for (Role role : roles) {
            for (Permission permission : role.getPermissions()) {
                codes.add(permission.getCode());
            }
        }
        return codes;
    }

    /** Role codes, in the same shape and for the same reason as above. */
    public Set<String> roleCodes() {
        Set<String> codes = new TreeSet<>();
        for (Role role : roles) {
            codes.add(role.getCode());
        }
        return codes;
    }

    /** Only an active account may authenticate. */
    public boolean canSignIn() {
        return status == UserStatus.ACTIVE;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    /** Takes an already-encoded hash; encoding is the service layer's job. */
    public Instant getPasswordChangedAt() {
        return passwordChangedAt;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordChangedAt = Instant.now();
        this.passwordHash = passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public void setRoles(Set<Role> roles) {
        this.roles.clear();
        this.roles.addAll(roles);
    }

    /**
     * Trường của tài khoản — chỉ {@link SchoolUser} có, loại khác trả null. Dành cho chỗ phải đọc đơn vị của MỌI loại
     * tài khoản (token, bộ đệm quyền, danh sách tài khoản); code chỉ làm việc với tài khoản trường dùng
     * {@link SchoolUser#getSchool()}.
     */
    public School schoolOrNull() {
        return null;
    }

    /** Cơ quan quản lý (Sở) — chỉ {@link SoUser} có, loại khác trả null. */
    public DepartmentOfEducation managingBodyOrNull() {
        return null;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof User user)) {
            return false;
        }
        return id != null && id.equals(user.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
