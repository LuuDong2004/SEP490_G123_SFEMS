package com.g123.sfems.module.catalog.semester;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Payload tạo học kỳ: năm trường chung cộng năm học ({@code {"id": 3}}) và khoảng ngày. */
public record SemesterRequest(
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,

        @NotNull(message = "Chọn năm học")
        IdRef schoolYear,

        @NotNull(message = "Ngày bắt đầu là bắt buộc")
        LocalDate startDate,

        @NotNull(message = "Ngày kết thúc là bắt buộc")
        LocalDate endDate) implements CatalogInput {
}
