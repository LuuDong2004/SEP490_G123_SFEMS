package com.g123.sfems.module.school.staff;

import com.g123.sfems.module.school.staff.StaffAccountService.Issued;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/staff/{id}/account} — tài khoản đăng nhập của một cán bộ. Mã quyền riêng
 * {@code staff_accounts:write} (091), không phải {@code users:write}: xem {@link StaffAccountService}.
 */
@RestController
@RequestMapping("/api/staff/{id}/account")
@PreAuthorize("hasAuthority('staff_accounts:write')")
public class StaffAccountController {

    private final StaffAccountService accounts;

    public StaffAccountController(StaffAccountService accounts) {
        this.accounts = accounts;
    }

    public record CreateRequest(
            @Text(value = FieldRule.USERNAME, label = "Tên đăng nhập") String username,
            @Text(value = FieldRule.CODE, label = "Vai trò") String role) {
    }

    public record StatusRequest(boolean active) {
    }

    /** Cấp tài khoản — trả về tên đăng nhập và mật khẩu tạm (chỉ lần này). */
    @PostMapping
    public Issued create(@PathVariable Long id, @Valid @RequestBody(required = false) CreateRequest request) {
        return accounts.create(id, request == null ? null : request.username(), request == null ? null : request.role());
    }

    /** Đặt lại mật khẩu — mật khẩu tạm mới, mọi phiên đang mở của tài khoản bị đăng xuất. */
    @PostMapping("/password")
    public Issued resetPassword(@PathVariable Long id) {
        return accounts.resetPassword(id);
    }

    /** Khoá / mở lại tài khoản. */
    @PostMapping("/status")
    public Map<String, Boolean> setStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        accounts.setActive(id, request.active());
        return Map.of("active", request.active());
    }
}
