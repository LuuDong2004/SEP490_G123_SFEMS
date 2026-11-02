package com.g123.sfems.module.catalog.movementreason;

import com.g123.sfems.domain.catalog.movementreason.MovementDirection;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Payload tạo lý do biến động: năm trường chung cộng chiều tăng/giảm ("increase" | "decrease"). */
public record MovementReasonRequest(
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

        @NotNull(message = "Chọn lý do tăng hay giảm")
        MovementDirection direction) implements CatalogInput {
}
