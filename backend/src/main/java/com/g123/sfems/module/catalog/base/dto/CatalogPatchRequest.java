package com.g123.sfems.module.catalog.base.dto;

import jakarta.validation.constraints.PositiveOrZero;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload sửa. Trường {@code null} là "để nguyên"; chuỗi rỗng ở ghi chú là XOÁ,
 * vì đó là cách duy nhất một ô vừa bị xoá trắng nói được điều đó.
 */
public record CatalogPatchRequest(
        @Size(min = 1, max = 64, message = "Mã phải từ 1 đến 64 ký tự")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(min = 1, max = 255, message = "Tên phải từ 1 đến 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note) implements CatalogInput {
}
