package com.g123.sfems.module.catalog.equipmentcatalog;

import java.util.stream.Stream;
import java.util.List;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.CatalogOrigin;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một nhóm thiết bị. */
public record EquipmentCatalogResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        String teachingCode,
        RefSummary parent,
        RefSummary equipmentType,
        RefSummary subject,
        /** Mọi môn dùng thiết bị này: môn chính đứng đầu, rồi các môn thêm. Rỗng = dùng chung. */
        List<RefSummary> subjects,
        RefSummary educationLevel,
        /** Mọi cấp học dùng thiết bị này: cấp chính đứng đầu, rồi các cấp thêm. Rỗng = dùng chung mọi cấp. */
        List<RefSummary> educationLevels,
        RefSummary grade,
        /** Mọi khối lớp dùng thiết bị này: khối chính đứng đầu, rồi các khối thêm. */
        List<RefSummary> grades,
        RefSummary unit,
        String model,
        String manufacturer,
        TrackingType trackingType,
        AssetCategory assetCategory,
        PhysicalDigitalType physicalOrDigital,
        Boolean minimumRequired,
        String statisticalCode,
        String legalBasis,
        String description,
        Boolean usedByTeacher,
        Boolean usedByStudent,
        Boolean selfMade,
        RefSummary ownerSchool,
        CatalogOrigin origin,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static EquipmentCatalogResponse from(EquipmentCatalog item, RowLevelSecurity rowLevel) {
        return new EquipmentCatalogResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.getTeachingCode(),
                RefSummary.of(item.getParent()),
                RefSummary.of(item.getEquipmentType()),
                RefSummary.of(item.getSubject()),
                Stream.concat(
                        Stream.ofNullable(item.getSubject()), item.getExtraSubjects().stream())
                        .map(RefSummary::of).toList(),
                RefSummary.of(item.getEducationLevel()),
                Stream.concat(
                        Stream.ofNullable(item.getEducationLevel()), item.getExtraLevels().stream())
                        .map(RefSummary::of).toList(),
                RefSummary.of(item.getGrade()),
                Stream.concat(
                        Stream.ofNullable(item.getGrade()), item.getExtraGrades().stream())
                        .map(RefSummary::of).toList(),
                RefSummary.of(item.getUnit()),
                item.getModel(), item.getManufacturer(), item.getTrackingType(),
                item.getAssetCategory(), item.getPhysicalOrDigital(),
                item.getMinimumRequired(),
                item.getStatisticalCode(), item.getLegalBasis(), item.getDescription(),
                item.getUsedByTeacher(), item.getUsedByStudent(), item.getSelfMade(),
                item.getOwnerSchool() == null ? null : new RefSummary(item.getOwnerSchool().getId(),
                        item.getOwnerSchool().getCode(), item.getOwnerSchool().getName()),
                item.getOrigin(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
