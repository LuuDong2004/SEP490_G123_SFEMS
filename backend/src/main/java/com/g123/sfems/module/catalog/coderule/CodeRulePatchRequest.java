package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload sửa quy tắc sinh mã. {@code null} là để nguyên. */
public record CodeRulePatchRequest(
        @Size(min = 1, message = "Mã không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @Text(value = FieldRule.CODE, label = "Danh mục áp dụng", max = 64)
        String target,
        @Text(value = FieldRule.CODE, label = "Tiền tố", max = 20)
        String prefix,
        @Text(value = FieldRule.CODE, label = "Hậu tố", max = 20)
        String suffix,
        @Min(value = 1, message = "Độ dài phần số từ 1 đến 10")
        @Max(value = 10, message = "Độ dài phần số từ 1 đến 10")
        Integer numberLength,
        @Min(value = 0, message = "Số hiện tại không được âm")
        Long currentNumber) implements CatalogInput {
}
