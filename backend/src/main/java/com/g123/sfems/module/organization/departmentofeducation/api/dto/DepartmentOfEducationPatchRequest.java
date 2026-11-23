package com.g123.sfems.module.organization.departmentofeducation.api.dto;

import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Size;

/**
 * Payload của {@code PATCH /departments_of_education/{id}}.
 *
 * <p>Trường {@code null} nghĩa là "để nguyên"; chuỗi rỗng ở các trường tuỳ
 * chọn thì XOÁ giá trị, vì đó là cách duy nhất một ô vừa bị xoá trắng nói được
 * điều đó.
 */
public record DepartmentOfEducationPatchRequest(
        @Size(min = 1, message = "Mã là bắt buộc")
        @Text(value = FieldRule.CODE, label = "Mã")
        String code,

        @Size(min = 1, message = "Tên đơn vị là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên đơn vị")
        String name,

        @Text(value = FieldRule.SHORT_TEXT, label = "Tỉnh/Thành phố", max = 128)
        String province,

        @Text(value = FieldRule.ADDRESS, label = "Địa chỉ")
        String address,

        /** Bo trong giu nguyen loai hien tai. */
        ManagingBodyType type,

        OrgStatus status) {
}
