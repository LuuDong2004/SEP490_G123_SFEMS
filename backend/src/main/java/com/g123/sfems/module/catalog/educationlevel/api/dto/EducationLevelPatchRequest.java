package com.g123.sfems.module.catalog.educationlevel.api.dto;

import jakarta.validation.constraints.PositiveOrZero;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload của {@code PATCH /education_levels/{id}}.
 *
 * <p>Trường {@code null} nghĩa là "để nguyên". Màn quản trị luôn gửi cả form,
 * nhưng giữ đúng ngữ nghĩa patch là thứ làm endpoint này dùng được từ bất cứ
 * client nào gửi cập nhật một phần thật sự.
 *
 * <p>Các trường văn bản tuỳ chọn là ngoại lệ theo một chiều: chuỗi rỗng sẽ XOÁ
 * giá trị, vì đó là cách duy nhất một ô input vừa bị xoá trắng nói được điều đó.
 */
public record EducationLevelPatchRequest(
        @Size(min = 1, max = 64, message = "Mã phải từ 1 đến 64 ký tự")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(min = 1, max = 255, message = "Tên phải từ 1 đến 255 ký tự")
        String name,

        @Size(max = 64, message = "Tên rút gọn tối đa 64 ký tự")
        String shortName,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note) {
}
