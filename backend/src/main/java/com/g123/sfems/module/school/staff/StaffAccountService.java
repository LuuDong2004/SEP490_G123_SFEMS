package com.g123.sfems.module.school.staff;

import com.g123.sfems.shared.security.PasswordPolicy;
import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.module.security.role.service.RoleService;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.SchoolRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
import com.g123.sfems.module.security.user.api.dto.UserRequest;
import com.g123.sfems.module.security.user.service.SchoolUserService;
import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấp tài khoản đăng nhập cho cán bộ, giáo viên của trường — lối HẸP thay cho {@code users:write}
 * (xem changelog 091): tài khoản luôn thuộc trường của cán bộ, cán bộ phải nằm trong phạm vi GHI
 * của người gọi, và vai chỉ là vai loại trường. Mật khẩu tạm do máy sinh, trả về
 * MỘT lần để người cấp đưa cho cán bộ; đăng nhập xong họ tự đổi.
 */
@Service
public class StaffAccountService {

    /** Vai được phép gán ở lối này — không bao giờ vai của Sở, UBND hay quản trị. */


    private final StaffService staff;
    private final UserService users;
    private final RoleService roles;

    public StaffAccountService(StaffService staff, UserService users, RoleService roles) {
        this.staff = staff;
        this.users = users;
        this.roles = roles;
    }

    /** Kết quả cấp / đặt lại: tài khoản kèm mật khẩu tạm (chỉ trả một lần, không lưu ở đâu). */
    public record Issued(Long userId, String username, String role, String temporaryPassword) {
    }

    @Transactional
    public Issued create(Long staffId, String requestedUsername, String requestedRole) {
        Staff person = staff.getWritable(staffId);
        if (person.getAccount() != null) {
            throw new ConflictException("Cán bộ này đã có tài khoản " + person.getAccount().getUsername());
        }
        String role = requestedRole == null || requestedRole.isBlank() ? defaultRole(person) : requestedRole.trim().toUpperCase(Locale.ROOT);
        if (role == null) {
            throw new FieldValidationException("role", "Chọn vai cho tài khoản");
        }
        Long roleId = roles.getByCode(role, UserType.SCHOOL).getId();
        String username = requestedUsername == null || requestedUsername.isBlank()
                ? suggestUsername(person)
                : requestedUsername.trim().toLowerCase(Locale.ROOT);
        String email = person.getEmail() != null && !person.getEmail().isBlank()
                ? person.getEmail().trim().toLowerCase(Locale.ROOT)
                : username + "@qltb.local";
        String password = temporaryPassword();

        User user = users.create(new UserRequest(
                username, email, person.getName(), password, UserStatus.ACTIVE,
                new SchoolRef(person.getSchool().getId()), null,
                List.of(new RoleRef(roleId)), null));
        staff.linkAccount(staffId, user);
        return new Issued(user.getId(), user.getUsername(), role, password);
    }

    @Transactional
    public Issued resetPassword(Long staffId) {
        User account = accountOf(staffId);
        String password = temporaryPassword();
        users.setPassword(account.getId(), password);
        return new Issued(account.getId(), account.getUsername(), null, password);
    }

    /** Khoá (không cho đăng nhập) hoặc mở lại tài khoản của cán bộ. */
    @Transactional
    public void setActive(Long staffId, boolean active) {
        User account = accountOf(staffId);
        users.update(account.getId(), new UserPatchRequest(
                null, null, null, active ? UserStatus.ACTIVE : UserStatus.INACTIVE, null, null, null, null));
    }

    private User accountOf(Long staffId) {
        Staff person = staff.getWritable(staffId);
        if (person.getAccount() == null) {
            throw new ConflictException("Cán bộ này chưa có tài khoản");
        }
        // Tài khoản về sau được cấp vai Sở / UBND / quản trị thì không còn là việc của trường: đặt lại mật khẩu ở
        // đây là chiếm được tài khoản đó.
        if (!SchoolUserService.onlySchoolRoles(person.getAccount())) {
            throw new ConflictException("Tài khoản này mang vai ngoài trường — liên hệ quản trị viên");
        }
        return person.getAccount();
    }

    /**
     * Vai mặc định theo chức vụ: hiệu trưởng / phó → Lãnh đạo trường; cán bộ thiết bị → Cán bộ thiết bị. Chức vụ
     * khác không có vai mặc định (đã bỏ vai Giáo viên / Trưởng bộ môn, changelog 234) — người cấp phải chọn vai.
     */
    static String defaultRole(Staff person) {
        StaffPosition position = person.getPosition();
        if (position == StaffPosition.HIEU_TRUONG || position == StaffPosition.PHO_HIEU_TRUONG) {
            return "SCHOOL_LEADER";
        }
        return position == StaffPosition.CAN_BO_THIET_BI ? "SCHOOL_STAFF" : null;
    }

    /** "thcsbinhanq2.gv01" — mã trường + mã cán bộ, không dấu; trùng thì thêm số. */
    private String suggestUsername(Staff person) {
        String base = (slug(person.getSchool().getCode()) + "." + slug(person.getCode())).replaceAll("^\\.|\\.$", "");
        if (base.length() < 3) {
            base = "canbo." + base;
        }
        String candidate = base;
        for (int i = 2; users.findForAuthentication(candidate).isPresent(); i++) {
            candidate = base + i;
        }
        return candidate;
    }

    private static String slug(String raw) {
        String plain = Normalizer.normalize(raw == null ? "" : raw, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        return plain.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
    }

    /** Mật khẩu tạm do máy sinh, đạt {@code PasswordPolicy}. */
    private static String temporaryPassword() {
        return PasswordPolicy.temporary();
    }
}
