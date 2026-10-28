package com.g123.sfems.module.security.role.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code PATCH /roles/{id}} payload — a {@code null} field means "leave it
 * unchanged".
 *
 * <p>Note the difference between {@code null} and an empty list for
 * {@code permissions}: omitting it leaves the grants alone, sending {@code []}
 * revokes all of them. That distinction is the whole reason the field is a
 * nullable list rather than one defaulted to empty.
 */
public record RolePatchRequest(
        @Size(min = 1, max = 64, message = "Mã phải từ 1 đến 64 ký tự")
        @Pattern(regexp = "^[A-Z][A-Z0-9_]*$",
                message = "Mã chỉ gồm chữ in hoa không dấu, chữ số và dấu gạch dưới, bắt đầu bằng chữ")
        String code,

        @Size(min = 1, max = 255, message = "Tên phải từ 1 đến 255 ký tự")
        String name,

        @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
        String description,

        @Valid
        List<PermissionRef> permissions) {
}
