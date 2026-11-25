package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload tạo quy tắc sinh mã: năm trường chung + danh mục đích và định dạng mã. */
public record CodeRuleRequest(
        @NotBlank(message = "Mã là bắt buộc")
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotBlank(message = "Danh mục áp dụng là bắt buộc")
        @Text(value = FieldRule.CODE, label = "Danh mục áp dụng", max = 64)
        String target,
        @Text(value = FieldRule.CODE, label = "Tiền tố", max = 20)
        String prefix,
        @Text(value = FieldRule.CODE, label = "Hậu tố", max = 20)
        String suffix,
        @NotNull(message = "Độ dài phần số là bắt buộc")
        @Min(value = 1, message = "Độ dài phần số từ 1 đến 10")
        @Max(value = 10, message = "Độ dài phần số từ 1 đến 10")
        Integer numberLength,
        @Min(value = 0, message = "Số hiện tại không được âm")
        Long currentNumber) implements CatalogInput {
}
