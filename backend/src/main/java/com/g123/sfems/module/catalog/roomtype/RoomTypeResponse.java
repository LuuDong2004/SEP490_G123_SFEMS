package com.g123.sfems.module.catalog.roomtype;

import com.g123.sfems.domain.catalog.facilitygroup.FacilityLevels;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một loại CSVC. */
public record RoomTypeResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        String roomGroup,
        EducationLevelSummary educationLevel,
        GroupSummary group,
        String kind,
        List<String> levels,
        boolean standard,
        String legalBasis,
        boolean functional,
        Long schoolId,
        List<Map<String, String>> params,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /**
     * Cấp học rút gọn. Khai ngay ở đây chứ không import DTO của feature cấp học:
     * nới rộng payload bên đó không được lặng lẽ nới rộng payload bên này.
     */
    public record EducationLevelSummary(Long id, String code, String name) {
    }

    public record GroupSummary(Long id, String code, String name) {
    }

    public static RoomTypeResponse from(RoomType item, RowLevelSecurity rowLevel) {
        var level = item.getEducationLevel();
        var group = item.getGroup();
        return new RoomTypeResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.getRoomGroup(),
                level == null ? null : new EducationLevelSummary(level.getId(), level.getCode(), level.getName()),
                group == null ? null : new GroupSummary(group.getId(), group.getCode(), group.getName()),
                item.getKind(), FacilityLevels.split(item.getLevels()), item.isStandard(), item.getLegalBasis(),
                item.isFunctional(), item.getSchoolId(), item.getParams(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
