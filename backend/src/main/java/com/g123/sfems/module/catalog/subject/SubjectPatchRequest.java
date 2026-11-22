package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Payload sửa môn học. {@code educationLevels} vắng mặt là để nguyên; có mặt
 * (kể cả rỗng) là THAY THẾ toàn bộ danh sách — đó là cách một form gồm các ô
 * đánh dấu nói "đây là tập cấp học mới".
 */
public record SubjectPatchRequest(
        // Mã danh mục không còn nhập tay — vắng là để nguyên; gửi lên phải là mã
        // môn dạy học hai chữ số vì {@code code} luôn bằng {@code teaching_code}.
        @Pattern(regexp = "^\\d{2}$", message = "Mã môn gồm đúng hai chữ số")
        String code,
        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Pattern(regexp = "^\\d{2}$", message = "Mã môn dạy học gồm đúng hai chữ số")
        String teachingCode,
        @Valid
        List<SubjectLevelInput> educationLevels) implements CatalogInput {
}
