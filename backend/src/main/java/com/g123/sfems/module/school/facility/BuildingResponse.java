package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.Building;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một khối nhà. */
public record BuildingResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        RefSummary campus,
        Integer floorCount,
        Integer builtYear,
        BigDecimal floorArea,
        FacilityCondition condition,
        RefSummary managingStaff,
        FacilityStructure structure,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static BuildingResponse from(Building item, RowLevelSecurity rowLevel) {
        return new BuildingResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), FacilityRefs.school(item),
                RefSummary.of(item.getCampus()), item.getFloorCount(), item.getBuiltYear(),
                item.getFloorArea(), item.getCondition(), RefSummary.of(item.getManagingStaff()),
                item.getStructure(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
