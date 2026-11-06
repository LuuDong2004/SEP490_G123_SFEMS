package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record EquipmentStandardRequest(
        @Size(max = 64) String code, @NotBlank @Size(max = 255) String name,
        @PositiveOrZero Integer sortOrder, Boolean active, @Size(max = 500) String note,
        IdRef educationLevel, IdRef startSchoolYear, IdRef endSchoolYear,
        @Size(max = 50) String standardVersion) implements CatalogInput {
}
