package com.g123.sfems.module.security.role.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /roles} payload.
 *
 * <p>{@code systemRole} is not settable: it marks a role the application itself
 * depends on, so it is a property of the seed data rather than something an
 * admin can confer on a role they just invented.
 */
public record RoleRequest(
        @NotBlank(message = "Mã là bắt buộc")
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        // Upper snake case keeps the code usable as a ROLE_ authority and stops
        // two roles differing only by punctuation or case.
        @Pattern(regexp = "^[A-Z][A-Z0-9_]*$",
                message = "Mã chỉ gồm chữ in hoa không dấu, chữ số và dấu gạch dưới, bắt đầu bằng chữ")
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
        String description,

        @NotNull(message = "Thiếu danh sách quyền")
        @Valid
        List<PermissionRef> permissions) {
}
