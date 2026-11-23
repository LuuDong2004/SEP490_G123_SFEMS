package com.g123.sfems.module.security.role.api.dto;

import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
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

        @Size(min = 1, message = "Tên vai trò là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên vai trò")
        String name,

        @Text(value = FieldRule.NOTE, label = "Mô tả")
        String description,

        @Valid
        List<PermissionRef> permissions) {
}
