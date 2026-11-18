package com.g123.sfems.module.catalog.educationlevel.api.dto;

import jakarta.validation.constraints.NotBlank;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Payload của {@code POST /education_levels}.
 *
 * <p>{@code active} để trống thì bản ghi mới đang hoạt động — đúng cái mà giá
 * trị mặc định của form vẫn gửi lên.
 */
public record EducationLevelRequest(
        @NotBlank(message = "Mã là bắt buộc")
        // Cùng hình dạng với mã vai trò và mã tổ chức: thứ gõ được vào ô lọc
        // hay dán vào bảng tính mà không phải nghĩ đến quy tắc trích dẫn.
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,

        @Text(value = FieldRule.SHORT_TEXT, label = "Tên rút gọn", max = 64)
        String shortName,

        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,

        Boolean active,

        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note) {
}
