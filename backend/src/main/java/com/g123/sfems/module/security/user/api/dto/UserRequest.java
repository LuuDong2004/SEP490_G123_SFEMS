package com.g123.sfems.module.security.user.api.dto;

import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.shared.security.PasswordPolicy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /users} payload.
 *
 * <p>The password is set by whoever creates the account, because there is no
 * self-registration and no mail server to send an invitation through. It is
 * accepted here in the clear over the transport and hashed before it reaches
 * the database — it is never stored, echoed or logged.
 */
public record UserRequest(
        @NotBlank(message = "Nhập tên đăng nhập")
        @Size(min = 3, max = 100, message = "Tên đăng nhập phải từ 3 đến 100 ký tự")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                message = "Tên đăng nhập chỉ gồm chữ không dấu, chữ số, dấu chấm, gạch dưới và gạch nối")
        String username,

        @NotBlank(message = "Nhập email")
        @Email(message = "Email không đúng định dạng")
        @Size(max = 255, message = "Email tối đa 255 ký tự")
        String email,

        @NotBlank(message = "Nhập họ tên")
        @Size(max = 255, message = "Họ tên tối đa 255 ký tự")
        String fullName,

        @NotBlank(message = "Nhập mật khẩu")
        // Length is the only rule worth enforcing here. Composition rules push
        // people towards predictable substitutions without adding real entropy,
        // and a longer minimum buys more than a required symbol does.
        @Size(min = 8, max = 100, message = "Mật khẩu phải từ 8 đến 100 ký tự")
        String password,

        /** Optional; a user created without one starts active. */
        UserStatus status,

        /**
         * Trường công tác, tuỳ chọn.
         *
         * <p>Bỏ trống nghĩa là tài khoản chưa thuộc trường nào, và dưới
         * {@code defaultScope = NONE} thì tài khoản đó không thấy dòng dữ liệu
         * nào. Đó là hành vi ĐÚNG — fail closed — chứ không phải một thiếu sót.
         */
        @Valid
        SchoolRef school,

        /**
         * Cơ quan quản lý, tuỳ chọn — dành cho tài khoản của Sở hoặc UBND.
         *
         * <p>Đi song song với {@code school}: người của trường điền trường,
         * người của Sở hoặc UBND điền cơ quan, quản trị viên bỏ trống cả hai.
         */
        @Valid
        ManagingBodyRef managingBody,

        @NotEmpty(message = "Chọn ít nhất một vai trò")
        @Valid
        List<RoleRef> roles) {

    /** Mật khẩu bỏ khoảng trắng (QLTB-508). */
    public UserRequest {
        password = PasswordPolicy.strip(password);
    }
}
