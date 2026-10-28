package com.g123.sfems.domain.security.user;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.security.permission.Permission;
import com.g123.sfems.domain.security.role.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
 * <p>{@code @DynamicUpdate}: lưu chỉ ghi những cột đã đổi. Các bước đăng nhập ghi bộ đếm sai, mã email trong
 * giao dịch RIÊNG ({@code LoginGuard}, {@code EmailMfaService}, {@code MfaService}); không có nó, lần lưu
 * {@code lastLoginAt} của giao dịch đăng nhập ghi đè cả hàng bằng bản trong bộ nhớ — mã email vừa dùng sống lại.
 */
@Entity
@DynamicUpdate
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String username;

    @Column(nullable = false, length = 255, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    /** Lần đặt / đổi mật khẩu gần nhất — nhắc đổi định kỳ (QLTB-243). Đặt cùng lúc với {@link #passwordHash}. */
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

    /**
     * Trường mà tài khoản này thuộc về. Cho phép rỗng.
     *
     * <p>Rỗng được vì một tài khoản là cách đăng nhập trước khi là một người
     * trong sơ đồ tổ chức: tài khoản quản trị seed sẵn, tài khoản dịch vụ, hay
     * một người chưa xác định nơi công tác. Bắt buộc sẽ đồng nghĩa với việc
     * phải bịa ra một trường cho mọi tài khoản đã tồn tại.
     *
     * <p><b>Đây là cột mà toàn bộ phân quyền dòng dựa vào.</b> Nó đi lên
     * {@code AuthorityCache.Entry} rồi thành {@code RowLevelPrincipal}, và từ
     * đó thành khoá ngữ cảnh {@code user.schoolId} mà mọi chính sách "chỉ thấy
     * dữ liệu trường mình" đọc. Rỗng nghĩa là KHÔNG thuộc trường nào, và dưới
     * {@code defaultScope = NONE} thì điều đó có nghĩa là không thấy gì — fail
     * closed, ngược hẳn với bẫy {@code tenantId = NULL} của bản Jmix nơi rỗng
     * nghĩa là thấy tất cả.
     *
     * <p>Eager, như {@code roles}: màn danh sách tài khoản hiển thị nó trên mọi
     * dòng, nên một proxy lazy chỉ biến một truy vấn thành N. Là quan hệ
     * to-one nên nó nới rộng dòng chứ không nhân dòng lên.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "school_id")
    private School school;

    /**
     * Cơ quan quản lý mà tài khoản này thuộc về — Sở hoặc UBND. Cho phép rỗng.
     *
     * <p>Đi song song với {@link #school}, không thay thế nó, vì hai cột trả
     * lời hai câu hỏi khác nhau:
     *
     * <ul>
     *   <li>người của trường — {@code school} khác rỗng, {@code managingBody} rỗng</li>
     *   <li>người của Sở hoặc UBND — ngược lại</li>
     *   <li>quản trị viên hệ thống — cả hai rỗng, phạm vi do vai trò quyết định</li>
     * </ul>
     *
     * <p>Không có ràng buộc "đúng một trong hai khác rỗng": tài khoản quản trị
     * hợp lệ mà cả hai đều rỗng, và một người kiêm nhiệm cả hai phía là chuyện
     * có thật.
     *
     * <p><b>Đây là cột làm cho "Sở quản lý thông qua UBND" viết ra được.</b>
     * Không có nó thì chính sách "UBND chỉ thấy trường trên địa bàn mình"
     * không có gì để so sánh với {@code schools.department_of_education_id}.
     * Nó đi lên {@code AuthorityCache.Entry} rồi thành
     * {@code RowLevelPrincipal}, và từ đó thành khoá ngữ cảnh
     * {@code user.managingBodyId}.
     *
     * <p>Eager cùng lý do với {@code school}: màn danh sách tài khoản hiển thị
     * nó trên mọi dòng.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "managing_body_id")
    private DepartmentOfEducation managingBody;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    /** Bí mật TOTP, đã mã hoá bằng {@code SecretBox}. Có mà chưa bật = đang thiết lập. */
    @Column(name = "mfa_secret", length = 255)
    private String mfaSecret;

    @Column(name = "mfa_enabled", nullable = false)
    private boolean mfaEnabled;

    @Column(name = "mfa_failed_attempts", nullable = false)
    private int mfaFailedAttempts;

    @Column(name = "mfa_locked_until")
    private Instant mfaLockedUntil;

    /** Số lần sai mật khẩu liên tiếp; đủ 5 thì khoá tạm ({@code loginLockedUntil}) và đếm lại từ 0 (QLTB-509). */
    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount;

    @Column(name = "login_locked_until")
    private Instant loginLockedUntil;

    /** Xác thực hai lớp qua email: mã 6 số gửi tới {@code email} mỗi lần đăng nhập. */
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

    public String getMfaSecret() {
        return mfaSecret;
    }

    public void setMfaSecret(String mfaSecret) {
        this.mfaSecret = mfaSecret;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
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

    public User(String username, String email, String passwordHash, String fullName, UserStatus status) {
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

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }


    public DepartmentOfEducation getManagingBody() {
        return managingBody;
    }

    public void setManagingBody(DepartmentOfEducation managingBody) {
        this.managingBody = managingBody;
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
