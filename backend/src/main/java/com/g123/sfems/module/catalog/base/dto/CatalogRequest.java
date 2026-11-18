package com.g123.sfems.module.catalog.base.dto;

import jakarta.validation.constraints.NotBlank;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload tạo mới, dùng chung cho mọi danh mục cùng hình dạng. */
public record CatalogRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã; danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,

        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,

        Boolean active,

        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note) implements CatalogInput {
}
