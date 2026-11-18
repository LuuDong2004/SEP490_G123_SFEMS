package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** Payload tạo lớp học. {@code code} là tên ngắn của lớp (6A1). */
public record SchoolClassRequest(
        @NotBlank(message = "Tên lớp là bắt buộc")
        @Text(value = FieldRule.SHORT_TEXT, label = "Tên lớp", max = 64)
        @Pattern(regexp = "^[\\p{L}\\p{N}._-][\\p{L}\\p{N}._ /-]*$",
                message = "Tên lớp chỉ gồm chữ, số, khoảng trắng, dấu chấm, gạch dưới và gạch nối")
        String code,
        @NotBlank(message = "Tên hiển thị là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên hiển thị")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        @NotNull(message = "Chọn khối lớp")
        IdRef grade,
        @NotNull(message = "Chọn năm học")
        IdRef schoolYear,
        IdRef homeroomTeacher,
        IdRef room,
        @Num(value = NumberRule.COUNT, label = "Sĩ số")
        @Max(value = 200, message = "Sĩ số tối đa 200")
        Integer studentCount) implements SchoolOwnedInput {
}
