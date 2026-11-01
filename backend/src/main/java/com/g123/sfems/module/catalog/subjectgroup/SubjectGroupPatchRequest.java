package com.g123.sfems.module.catalog.subjectgroup;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Payload sửa tổ chuyên môn. Trường {@code null} là để nguyên. */
public record SubjectGroupPatchRequest(
        @Size(min = 1, max = 64, message = "Mã phải từ 1 đến 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(min = 1, max = 255, message = "Tên phải từ 1 đến 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,

        IdRef educationLevel) implements CatalogInput {
}
