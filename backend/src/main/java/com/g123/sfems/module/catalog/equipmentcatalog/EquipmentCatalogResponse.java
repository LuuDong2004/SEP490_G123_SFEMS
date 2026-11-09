package com.g123.sfems.module.catalog.equipmentcatalog;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.DepreciationMethod;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Thiết bị trên đường truyền. {@code subjects}, {@code grades} là MỌI môn, khối của thiết bị — mục đầu là môn,
 * khối chính ({@code subject}, {@code grade}), các mục sau là môn, khối thêm.
 */
public record EquipmentCatalogResponse(
        @JsonUnwrapped CatalogResponse base,
        String teachingCode, RefSummary parent, RefSummary equipmentType, RefSummary subject,
        List<RefSummary> subjects, RefSummary educationLevel, RefSummary grade, List<RefSummary> grades,
        RefSummary unit, String model, String manufacturer, TrackingType trackingType, AssetCategory assetCategory,
        PhysicalDigitalType physicalOrDigital, DepreciationMethod depreciationMethod, Integer usefulLifeYears,
        Boolean minimumRequired, String statisticalCode, String legalBasis, String description,
        Boolean usedByTeacher, Boolean usedByStudent, Boolean selfMade, RefSummary ownerSchool, String origin) {

    public static EquipmentCatalogResponse from(EquipmentCatalog item, RowLevelSecurity rowLevel) {
        return new EquipmentCatalogResponse(CatalogResponse.from(item, rowLevel),
                item.getTeachingCode(), RefSummary.of(item.getParent()),
                RefSummary.of(item.getEquipmentType()), RefSummary.of(item.getSubject()),
                withPrimary(item.getSubject(), item.getExtraSubjects()),
                RefSummary.of(item.getEducationLevel()), RefSummary.of(item.getGrade()),
                withPrimary(item.getGrade(), item.getExtraGrades()),
                RefSummary.of(item.getUnit()), item.getModel(), item.getManufacturer(),
                item.getTrackingType(), item.getAssetCategory(), item.getPhysicalOrDigital(),
                item.getDepreciationMethod(), item.getUsefulLifeYears(), item.getMinimumRequired(),
                item.getStatisticalCode(), item.getLegalBasis(), item.getDescription(), item.getUsedByTeacher(),
                item.getUsedByStudent(), item.getSelfMade(),
                item.getOwnerSchool() == null ? null
                        : new RefSummary(item.getOwnerSchool().getId(), item.getOwnerSchool().getCode(),
                                item.getOwnerSchool().getName()),
                item.getOrigin() == null ? null : item.getOrigin().name());
    }

    /** Mục chính đứng đầu, rồi các mục thêm. */
    private static List<RefSummary> withPrimary(CatalogEntity primary, Collection<? extends CatalogEntity> extras) {
        List<RefSummary> all = new ArrayList<>();
        if (primary != null) {
            all.add(RefSummary.of(primary));
        }
        extras.forEach(extra -> all.add(RefSummary.of(extra)));
        return all;
    }
}
