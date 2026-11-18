package com.g123.sfems.module.catalog.facilitygroup;

import com.g123.sfems.domain.catalog.facilitygroup.FacilityGroup;
import com.g123.sfems.domain.catalog.facilitygroup.FacilityLevels;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một khối CSVC. */
public record FacilityGroupResponse(
        Long id,
        String code,
        String name,
        List<String> levels,
        Integer sortOrder,
        Boolean active,
        String note,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static FacilityGroupResponse from(FacilityGroup item, RowLevelSecurity rowLevel) {
        return new FacilityGroupResponse(item.getId(), item.getCode(), item.getName(),
                FacilityLevels.split(item.getLevels()), item.getSortOrder(), item.getActive(), item.getNote(),
                item.getCreatedAt(), item.getUpdatedAt(), rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
