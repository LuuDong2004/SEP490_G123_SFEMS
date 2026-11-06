package com.g123.sfems.module.catalog.norm;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.math.BigDecimal;

public record EquipmentNormResponse(
        @JsonUnwrapped CatalogResponse base, RefSummary standard, RefSummary catalog,
        RefSummary equipmentType, RefSummary subject, RefSummary grade, RefSummary roomType,
        BigDecimal minQuantity, Integer basisSize, String quantityText, String unitText,
        RefSummary unit, NormBasis normBasis, String itemNo, String topic,
        String purpose, String description, boolean forTeacher, boolean forStudent, boolean optional) {
    public static EquipmentNormResponse from(EquipmentNorm item, RowLevelSecurity rowLevel) {
        return new EquipmentNormResponse(CatalogResponse.from(item, rowLevel),
                RefSummary.of(item.getStandard()), RefSummary.of(item.getCatalog()),
                RefSummary.of(item.getEquipmentType()), RefSummary.of(item.getSubject()),
                RefSummary.of(item.getGrade()), RefSummary.of(item.getRoomType()),
                item.getMinQuantity(), item.getBasisSize(), item.getQuantityText(),
                item.getUnitText(), RefSummary.of(item.getUnit()), item.getNormBasis(),
                item.getItemNo(), item.getTopic(), item.getPurpose(), item.getDescription(),
                item.isForTeacher(), item.isForStudent(), item.isOptional());
    }
}
