package com.g123.sfems.module.school.facility;

import java.util.List;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một phòng. */
public record RoomResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        RefSummary campus,
        RefSummary building,
        RefSummary roomType,
        /** Loại CSVC ngoài danh mục của Sở (trường tự thêm). */
        boolean customType,
        RefSummary subject,
        String location,
        String floor,
        BigDecimal area,
        Integer capacity,
        FacilityCondition condition,
        RoomUsageStatus usageStatus,
        RefSummary managingStaff,
        String managingUnit,
        boolean loanable,
        FacilityStructure structure,
        RefSummary combinedType,
        Map<String, String> params,
        List<Integer> openDays,
        List<String> openSessions,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static RoomResponse from(Room item, RowLevelSecurity rowLevel) {
        return new RoomResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), FacilityRefs.school(item),
                RefSummary.of(item.getCampus()), RefSummary.of(item.getBuilding()),
                RefSummary.of(item.getRoomType()),
                item.getRoomType() != null && item.getRoomType().getSchoolId() != null,
                RefSummary.of(item.getSubject()), item.getLocation(),
                item.getFloor(),
                item.getArea(), item.getCapacity(), item.getCondition(), item.getUsageStatus(),
                RefSummary.of(item.getManagingStaff()), item.getManagingUnit(), item.isLoanable(),
                item.getStructure(), RefSummary.of(item.getCombinedType()), item.getParams(),
                OpeningHours.days(item.getOpenDays()), OpeningHours.sessions(item.getOpenSessions()),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
