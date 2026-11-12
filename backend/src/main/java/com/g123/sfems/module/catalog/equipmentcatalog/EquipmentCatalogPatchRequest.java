package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.DepreciationMethod;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record EquipmentCatalogPatchRequest(
        @Size(min = 1, max = 64) @Pattern(regexp = "^[A-Za-z0-9._-]+$") String code,
        @Size(min = 1, max = 255) String name,
        @PositiveOrZero Integer sortOrder, Boolean active, @Size(max = 500) String note,
        @Pattern(regexp = "^$|^[A-Z]{3}$") String teachingCode,
        IdRef parent, IdRef equipmentType, IdRef subject, IdRef educationLevel, IdRef grade, IdRef unit,
        @Size(max = 255) String model, @Size(max = 255) String manufacturer,
        TrackingType trackingType, AssetCategory assetCategory, PhysicalDigitalType physicalOrDigital,
        DepreciationMethod depreciationMethod, @Min(0) @Max(100) Integer usefulLifeYears,
        @Size(max = 64) String statisticalCode, @Size(max = 255) String legalBasis,
        @Size(max = 20000) String description, Boolean usedByTeacher, Boolean usedByStudent,
        Boolean selfMade,
        /**
         * Chọn NHIỀU môn, nhiều khối: mục đầu là cái chính (cột {@code subject_id}, {@code grade_id}), các mục
         * sau là môn, khối thêm. {@code null} là không đụng tới; danh sách rỗng là bỏ hết.
         */
        @Size(max = 20, message = "Chọn tối đa 20 môn") List<IdRef> subjects,
        @Size(max = 3, message = "Chọn tối đa 3 khối") List<IdRef> grades) implements CatalogInput {
}
