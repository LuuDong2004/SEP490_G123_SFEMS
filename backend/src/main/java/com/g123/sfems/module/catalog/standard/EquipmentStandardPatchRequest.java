package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record EquipmentStandardPatchRequest(
        @Size(min = 1, max = 64) String code, @Size(min = 1, max = 255) String name,
        @PositiveOrZero Integer sortOrder, Boolean active, @Size(max = 500) String note,
        IdRef educationLevel, IdRef startSchoolYear, IdRef endSchoolYear,
        @Size(max = 50) String standardVersion) implements CatalogInput {
}
