package com.g123.sfems.module.catalog.equipmentcatalog;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

public record EquipmentCatalogResponse(
        @JsonUnwrapped CatalogResponse base,
        String teachingCode, RefSummary parent, RefSummary equipmentType, RefSummary subject,
        RefSummary educationLevel, RefSummary grade, RefSummary unit,
        String model, String manufacturer, TrackingType trackingType, AssetCategory assetCategory,
        PhysicalDigitalType physicalOrDigital, Integer usefulLifeYears, Boolean minimumRequired,
        String statisticalCode, String legalBasis, String description,
        Boolean usedByTeacher, Boolean usedByStudent, RefSummary ownerSchool, String origin) {

    public static EquipmentCatalogResponse from(EquipmentCatalog item, RowLevelSecurity rowLevel) {
        return new EquipmentCatalogResponse(CatalogResponse.from(item, rowLevel),
                item.getTeachingCode(), RefSummary.of(item.getParent()),
                RefSummary.of(item.getEquipmentType()), RefSummary.of(item.getSubject()),
                RefSummary.of(item.getEducationLevel()), RefSummary.of(item.getGrade()),
                RefSummary.of(item.getUnit()), item.getModel(), item.getManufacturer(),
                item.getTrackingType(), item.getAssetCategory(), item.getPhysicalOrDigital(),
                item.getUsefulLifeYears(), item.getMinimumRequired(), item.getStatisticalCode(),
                item.getLegalBasis(), item.getDescription(), item.getUsedByTeacher(),
                item.getUsedByStudent(), item.getOwnerSchool() == null ? null
                        : new RefSummary(item.getOwnerSchool().getId(), item.getOwnerSchool().getCode(),
                                item.getOwnerSchool().getName()),
                item.getOrigin() == null ? null : item.getOrigin().name());
    }
}
