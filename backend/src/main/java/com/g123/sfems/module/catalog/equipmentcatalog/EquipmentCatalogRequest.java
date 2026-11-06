package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record EquipmentCatalogRequest(
        @Size(max = 64) @Pattern(regexp = "^[A-Za-z0-9._-]*$") String code,
        @NotBlank @Size(max = 255) String name,
        @PositiveOrZero Integer sortOrder, Boolean active, @Size(max = 500) String note,
        @Pattern(regexp = "^$|^[A-Z]{3}$") String teachingCode,
        IdRef parent, IdRef equipmentType, IdRef subject, IdRef educationLevel, IdRef grade, IdRef unit,
        @Size(max = 255) String model, @Size(max = 255) String manufacturer,
        TrackingType trackingType, AssetCategory assetCategory, PhysicalDigitalType physicalOrDigital,
        @Min(0) @Max(100) Integer usefulLifeYears,
        @Size(max = 64) String statisticalCode, @Size(max = 255) String legalBasis,
        @Size(max = 20000) String description, Boolean usedByTeacher, Boolean usedByStudent) implements CatalogInput {
}
