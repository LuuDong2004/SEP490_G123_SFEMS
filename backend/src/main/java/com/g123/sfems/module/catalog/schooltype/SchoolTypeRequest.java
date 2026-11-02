package com.g123.sfems.module.catalog.schooltype;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Payload tạo loại hình trường: năm trường chung cộng tên viết tắt. */
public record SchoolTypeRequest(
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,

        @Size(max = 64, message = "Tên viết tắt tối đa 64 ký tự")
        String shortName) implements CatalogInput {
}
