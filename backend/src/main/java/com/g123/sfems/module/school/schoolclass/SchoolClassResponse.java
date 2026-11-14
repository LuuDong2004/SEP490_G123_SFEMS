package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một lớp học. */
public record SchoolClassResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        RefSummary grade,
        RefSummary schoolYear,
        RefSummary homeroomTeacher,
        RefSummary room,
        Integer studentCount,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static SchoolClassResponse from(SchoolClass item, RowLevelSecurity rowLevel) {
        var school = item.getSchool();
        return new SchoolClassResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                new RefSummary(school.getId(), school.getCode(), school.getName()),
                RefSummary.of(item.getGrade()),
                RefSummary.of(item.getSchoolYear()),
                RefSummary.of(item.getHomeroomTeacher()),
                RefSummary.of(item.getRoom()),
                item.getStudentCount(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
