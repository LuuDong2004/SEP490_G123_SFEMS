package com.g123.sfems.module.organization.departmentofeducation.api.dto;

import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Payload của {@code POST /departments_of_education}. */
public record DepartmentOfEducationRequest(
        @NotBlank(message = "Mã là bắt buộc")
        @Text(value = FieldRule.CODE, label = "Mã")
        String code,

        @NotBlank(message = "Tên đơn vị là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên đơn vị")
        String name,

        @Text(value = FieldRule.SHORT_TEXT, label = "Tỉnh/Thành phố", max = 128)
        String province,

        @Text(value = FieldRule.ADDRESS, label = "Địa chỉ")
        String address,

        /**
         * Sở, UBND hay cơ quan khác. Bắt buộc, không có mặc định: loại quyết
         * định phạm vi dữ liệu của mọi tài khoản thuộc cơ quan này, nên đoán
         * hộ người dùng ở đây là đoán hộ họ quyền truy cập.
         */
        @NotNull(message = "Loại cơ quan là bắt buộc")
        ManagingBodyType type,

        OrgStatus status) {
}
