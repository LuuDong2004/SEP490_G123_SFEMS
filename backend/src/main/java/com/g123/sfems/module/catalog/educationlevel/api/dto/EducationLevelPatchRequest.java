package com.g123.sfems.module.catalog.educationlevel.api.dto;

import jakarta.validation.constraints.Size;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

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
        @Size(min = 1, message = "Mã không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,

        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,

        @Text(value = FieldRule.SHORT_TEXT, label = "Tên rút gọn", max = 64)
        String shortName,

        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,

        Boolean active,

        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note) {
}
