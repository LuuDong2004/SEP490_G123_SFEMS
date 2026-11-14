package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload tạo môn học: năm trường chung + mã dạy học + danh sách cấp học. */
public record SubjectRequest(
        // Mã danh mục không còn nhập tay: máy chủ gán bằng mã môn dạy học —
        // hai ô mã trên form làm người nhập không biết ô nào là thật. Để trống
        // ("" của form ẩn ô Mã) hay vắng hẳn đều là "máy chủ cấp".
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotBlank(message = "Mã môn dạy học là bắt buộc")
        @Pattern(regexp = "^\\d{2}$", message = "Mã môn dạy học gồm đúng hai chữ số")
        String teachingCode,
        @Valid
        List<SubjectLevelInput> educationLevels) implements CatalogInput {
}
