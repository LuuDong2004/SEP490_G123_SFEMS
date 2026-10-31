package com.g123.sfems.module.security.user.repo;

import com.g123.sfems.domain.security.user.User;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Resolves the identifier typed into the sign-in form, which may be either.
     *
     * <p>Accepting both is a convenience for the person signing in; it is safe
     * because {@code username} and {@code email} are each unique and neither
     * can be blank, so no single value can address two accounts.
     */
    @Query("select u from User u where lower(u.username) = lower(:identifier) "
            + "or lower(u.email) = lower(:identifier)")
    Optional<User> findByUsernameOrEmail(@Param("identifier") String identifier);

    /**
     * How many active accounts hold a given role.
     *
     * <p>Used to refuse the last administrator being demoted or disabled: a
     * system with nobody able to manage users is one that needs a database
     * client to repair.
     */
    @Query("select count(u) from User u join u.roles r "
            + "where r.code = :roleCode and u.status = com.g123.sfems.domain.security.user.UserStatus.ACTIVE")
    long countActiveWithRole(@Param("roleCode") String roleCode);

    /**
     * Ba câu chiếu (projection) cho {@code AuthorityCache}: chỉ những cột bộ nhớ đệm quyền cần,
     * thay vì nạp cả đồ thị User → vai → quyền (|vai| × |quyền| dòng rộng, kéo theo trường và
     * cơ quan EAGER). Mỗi câu một bảng nối, dòng hẹp.
     */
    /**
     * Khoá dòng tài khoản — cho bộ đếm sai mật khẩu / sai mã: đọc rồi cộng một trên bản trong bộ nhớ mà không khoá
     * thì nhiều lần thử song song cùng đọc 0 và cùng ghi 1, vượt được ngưỡng khoá.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> lockById(@Param("id") Long id);

    @Query("select u.status, u.school.id, u.managingBody.id, u.passwordChangedAt from User u where u.id = :id")
    List<Object[]> authorityHeader(@Param("id") Long id);

    @Query("select r.id, r.code from User u join u.roles r where u.id = :id")
    List<Object[]> authorityRoles(@Param("id") Long id);

    @Query("select distinct p.code from User u join u.roles r join r.permissions p where u.id = :id")
    List<String> authorityPermissionCodes(@Param("id") Long id);
}
