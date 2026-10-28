package com.g123.sfems.module.organization.departmentofeducation.api.dto;

import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.OrgStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Payload của {@code POST /departments_of_education}. */
public record DepartmentOfEducationRequest(
        @NotBlank(message = "Mã là bắt buộc")
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên đơn vị là bắt buộc")
        @Size(max = 255, message = "Tên đơn vị tối đa 255 ký tự")
        String name,

        @Size(max = 128, message = "Tỉnh/Thành phố tối đa 128 ký tự")
        String province,

        @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
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
