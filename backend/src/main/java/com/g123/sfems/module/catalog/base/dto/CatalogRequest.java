package com.g123.sfems.module.catalog.base.dto;

import jakarta.validation.constraints.PositiveOrZero;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Payload tạo mới, dùng chung cho mọi danh mục cùng hình dạng. */
public record CatalogRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã (QLTB-178); danh mục không có quy tắc thì báo thiếu.
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]*$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note) implements CatalogInput {
}
