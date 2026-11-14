package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.NotBlank;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload tạo khối lớp: năm trường chung + teachingCode + tham chiếu cấp học. */
public record GradeRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã (QLTB-178); danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Text(value = FieldRule.CODE, label = "Mã khối dạy học", max = 32)
        String teachingCode,
        IdRef educationLevel) implements CatalogInput {
}
