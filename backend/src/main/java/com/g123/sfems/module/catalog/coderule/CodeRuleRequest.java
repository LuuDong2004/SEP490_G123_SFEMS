package com.g123.sfems.module.catalog.coderule;

import jakarta.validation.constraints.PositiveOrZero;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Payload tạo quy tắc sinh mã: năm trường chung + danh mục đích và định dạng mã. */
public record CodeRuleRequest(
        @NotBlank(message = "Mã là bắt buộc")
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,
        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,
        Boolean active,
        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,
        @NotBlank(message = "Danh mục áp dụng là bắt buộc")
        String target,
        @Size(max = 20, message = "Tiền tố tối đa 20 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]*$",
                message = "Tiền tố chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String prefix,
        @Size(max = 20, message = "Hậu tố tối đa 20 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]*$",
                message = "Hậu tố chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String suffix,
        @NotNull(message = "Độ dài phần số là bắt buộc")
        @Min(value = 1, message = "Độ dài phần số từ 1 đến 10")
        @Max(value = 10, message = "Độ dài phần số từ 1 đến 10")
        Integer numberLength,
        @Min(value = 0, message = "Số hiện tại không được âm")
        Long currentNumber) implements CatalogInput {
}
