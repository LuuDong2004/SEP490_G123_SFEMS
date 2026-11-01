package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Payload sửa năm học. Trường {@code null} là để nguyên. */
public record SchoolYearPatchRequest(
        @Size(min = 1, max = 64, message = "Mã phải từ 1 đến 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(min = 1, max = 255, message = "Tên phải từ 1 đến 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,

        LocalDate startDate,

        LocalDate endDate,

        Boolean current) implements CatalogInput {
}
