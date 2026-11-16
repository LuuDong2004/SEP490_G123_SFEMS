package com.g123.sfems.module.catalog.movementreason;

import com.g123.sfems.domain.catalog.movementreason.ReasonType;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/** Payload tạo lý do biến động: năm trường chung + loại lý do. */
public record MovementReasonRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã; danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotNull(message = "Loại lý do là bắt buộc")
        ReasonType reasonType) implements CatalogInput {
}
