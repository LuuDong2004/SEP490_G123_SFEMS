package com.g123.sfems.module.organization.departmentofeducation.api.dto;

import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.OrgStatus;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload của {@code PATCH /departments_of_education/{id}}.
 *
 * <p>Trường {@code null} nghĩa là "để nguyên"; chuỗi rỗng ở các trường tuỳ
 * chọn thì XOÁ giá trị, vì đó là cách duy nhất một ô vừa bị xoá trắng nói được
 * điều đó.
 */
public record DepartmentOfEducationPatchRequest(
        @Size(min = 1, max = 64, message = "Mã phải từ 1 đến 64 ký tự")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(min = 1, max = 255, message = "Tên đơn vị phải từ 1 đến 255 ký tự")
        String name,

        @Size(max = 128, message = "Tỉnh/Thành phố tối đa 128 ký tự")
        String province,

        @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
        String address,

        /** Bo trong giu nguyen loai hien tai. */
        ManagingBodyType type,

        OrgStatus status) {
}
