package com.g123.sfems.module.school.student;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.g123.sfems.domain.school.student.Student;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/** Hình dạng trên đường truyền của một học sinh. Kèm khối, năm học của lớp — năm học suy ra từ lớp. */
public record StudentResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        @JsonProperty("class") RefSummary schoolClass,
        RefSummary schoolYear,
        RefSummary grade,
        LocalDate birthDate,
        String gender,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static StudentResponse from(Student item, RowLevelSecurity rowLevel) {
        var school = item.getSchool();
        var schoolClass = item.getSchoolClass();
        return new StudentResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                new RefSummary(school.getId(), school.getCode(), school.getName()),
                RefSummary.of(schoolClass),
                schoolClass == null ? null : RefSummary.of(schoolClass.getSchoolYear()),
                schoolClass == null ? null : RefSummary.of(schoolClass.getGrade()),
                item.getBirthDate(),
                item.getGender() == null ? null : item.getGender().name(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
