package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record EquipmentNormPatchRequest(
        @Size(min = 1, max = 64) String code, @Size(min = 1, max = 255) String name,
        @PositiveOrZero Integer sortOrder, Boolean active, @Size(max = 500) String note,
        IdRef standard, IdRef catalog, IdRef equipmentType, IdRef subject,
        IdRef grade, IdRef roomType, @DecimalMin("0") BigDecimal minQuantity,
        @Min(1) Integer basisSize, @Size(max = 100) String quantityText,
        @Size(max = 50) String unitText, IdRef unit, NormBasis normBasis,
        @Size(max = 20) String itemNo, @Size(max = 500) String topic,
        @Size(max = 20000) String purpose, @Size(max = 20000) String description,
        Boolean forTeacher, Boolean forStudent, Boolean optional) implements CatalogInput {
}
