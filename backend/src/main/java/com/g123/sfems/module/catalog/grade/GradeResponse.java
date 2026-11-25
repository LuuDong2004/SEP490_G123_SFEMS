package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một khối lớp. */
public record GradeResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        String teachingCode,
        EducationLevelSummary educationLevel,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /**
     * Cấp học rút gọn. Khai ngay ở đây chứ không import DTO của feature cấp học:
     * nới rộng payload bên đó không được lặng lẽ nới rộng payload bên này.
     */
    public record EducationLevelSummary(Long id, String code, String name) {
    }

    public static GradeResponse from(Grade item, RowLevelSecurity rowLevel) {
        var level = item.getEducationLevel();
        return new GradeResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.getTeachingCode(),
                level == null ? null
                        : new EducationLevelSummary(level.getId(), level.getCode(), level.getName()),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
