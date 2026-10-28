package com.g123.sfems.module.catalog.educationlevel.api.dto;

import jakarta.validation.constraints.PositiveOrZero;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload của {@code POST /education_levels}.
 *
 * <p>{@code active} để trống thì bản ghi mới đang hoạt động — đúng cái mà giá
 * trị mặc định của form vẫn gửi lên.
 */
public record EducationLevelRequest(
        @NotBlank(message = "Mã là bắt buộc")
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        // Cùng hình dạng với mã vai trò và mã tổ chức: thứ gõ được vào ô lọc
        // hay dán vào bảng tính mà không phải nghĩ đến quy tắc trích dẫn.
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @Size(max = 64, message = "Tên rút gọn tối đa 64 ký tự")
        String shortName,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note) {
}
