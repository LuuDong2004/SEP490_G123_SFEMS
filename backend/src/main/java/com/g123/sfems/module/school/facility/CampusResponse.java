package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một cơ sở. */
public record CampusResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        Boolean primaryCampus,
        String phone,
        String address,
        boolean branch,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static CampusResponse from(Campus item, RowLevelSecurity rowLevel) {
        return new CampusResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), FacilityRefs.school(item),
                item.getPrimaryCampus(), item.getPhone(), item.getAddress(),
                item.isBranch(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
