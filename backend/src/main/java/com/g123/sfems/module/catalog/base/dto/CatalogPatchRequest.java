package com.g123.sfems.module.catalog.base.dto;

import jakarta.validation.constraints.Size;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Payload sửa. Trường {@code null} là "để nguyên"; chuỗi rỗng ở ghi chú là XOÁ,
 * vì đó là cách duy nhất một ô vừa bị xoá trắng nói được điều đó.
 */
public record CatalogPatchRequest(
        @Size(min = 1, message = "Mã không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã", max = 64)
        String code,

        @Size(min = 1, message = "Tên không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên")
        String name,

        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,

        Boolean active,

        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note) implements CatalogInput {
}
