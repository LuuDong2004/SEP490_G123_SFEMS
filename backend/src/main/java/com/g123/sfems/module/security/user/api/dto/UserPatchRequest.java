package com.g123.sfems.module.security.user.api.dto;

import com.g123.sfems.domain.security.user.UserStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code PATCH /users/{id}} payload — a {@code null} field means "leave it
 * unchanged".
 *
 * <p>There is deliberately no password field. Changing someone else's password
 * is a different act from editing their profile, with a different permission
 * story and a different audit meaning, so it has its own endpoint
 * ({@code POST /users/{id}/password}) rather than hiding inside a form save.
 */
public record UserPatchRequest(
        @Size(min = 3, max = 100, message = "Tên đăng nhập phải từ 3 đến 100 ký tự")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                message = "Tên đăng nhập chỉ gồm chữ không dấu, chữ số, dấu chấm, gạch dưới và gạch nối")
        String username,

        @Email(message = "Email không đúng định dạng")
        @Size(max = 255, message = "Email tối đa 255 ký tự")
        String email,

        @Size(min = 1, max = 255, message = "Họ tên phải từ 1 đến 255 ký tự")
        String fullName,

        UserStatus status,

        /**
         * Trường công tác. Bỏ khoá này đi là để nguyên; gửi
         * {@code {"id": null}} là gỡ tài khoản khỏi trường đang thuộc.
         * Xem {@link SchoolRef} về việc vì sao phải bọc thêm một lớp.
         */
        @Valid
        SchoolRef school,

        /** Cơ quan quản lý. Ba trạng thái như {@code school}. */
        @Valid
        ManagingBodyRef managingBody,

        // Size rather than NotEmpty, because null and empty have to mean
        // different things here: omitting the field leaves the assignments
        // alone, while an empty list is rejected. NotEmpty would reject both.
        // An account with no role can sign in and do nothing, which reads as a
        // broken system rather than a deliberate one -- disabling the account
        // is what that is for.
        @Size(min = 1, message = "Chọn ít nhất một vai trò")
        @Valid
        List<RoleRef> roles) {
}
