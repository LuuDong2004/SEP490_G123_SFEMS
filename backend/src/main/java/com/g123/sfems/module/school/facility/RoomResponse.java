package com.g123.sfems.module.school.facility;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một phòng (TC-02). */
public record RoomResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        RefSummary roomType,
        RefSummary subject,
        String building,
        String floor,
        String location,
        BigDecimal area,
        Integer capacity,
        FacilityCondition condition,
        RoomUsageStatus usageStatus,
        String managingUnit,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static RoomResponse from(Room item, RowLevelSecurity rowLevel) {
        return new RoomResponse(
                item.getId(),
                item.getCode(),
                item.getName(),
                item.getSortOrder(),
                item.getActive(),
                item.getNote(),
                FacilityRefs.school(item),
                RefSummary.of(item.getRoomType()),
                RefSummary.of(item.getSubject()),
                item.getBuilding(),
                item.getFloor(),
                item.getLocation(),
                item.getArea(),
                item.getCapacity(),
                item.getCondition(),
                item.getUsageStatus(),
                item.getManagingUnit(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
