package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/** Payload tạo bộ thông số kỹ thuật. */
public record EquipmentConfigRequest(
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

        @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
        String description,

        Boolean defaultConfig,

        List<IdRef> scopeTypes,

        @Size(max = 100, message = "Số hiệu tối đa 100 ký tự")
        String documentNo,

        @Size(max = 255, message = "Trích yếu tối đa 255 ký tự")
        String documentName,

        LocalDate issueDate,

        IdRef startSchoolYear,

        IdRef endSchoolYear,

        @Valid
        List<ConfigAttributeInput> attributes) implements CatalogInput {
}
