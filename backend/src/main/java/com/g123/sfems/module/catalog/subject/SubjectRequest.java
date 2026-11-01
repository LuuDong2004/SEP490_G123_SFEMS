package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Payload tạo môn học: năm trường chung cộng mã môn ngắn, cấp học giảng dạy và tổ chuyên môn. */
public record SubjectRequest(
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

        @Size(max = 10, message = "Mã môn tối đa 10 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9]*$", message = "Mã môn chỉ gồm chữ và số")
        String shortCode,

        @NotNull(message = "Chọn cấp học giảng dạy")
        IdRef educationLevel,

        /** Tổ chuyên môn phụ trách; vắng hoặc {@code {"id": null}} là chưa xếp tổ. */
        IdRef subjectGroup) implements CatalogInput {
}
