package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.subject.SubjectType;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Hình dạng trên đường truyền của một môn học.
 *
 * <p>{@code educationLevels} có CÙNG hình dạng với {@link SubjectLevelInput}
 * (cấp học lồng, loại, thứ tự) — nên màn sửa gửi lại nguyên danh sách nó nhận
 * mà không phải chuyển đổi.
 */
public record SubjectResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        String teachingCode,
        List<Level> educationLevels,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public record Level(LevelSummary educationLevel, SubjectType subjectType, Integer sortOrder) {
    }

    /** Khai ở đây chứ không import DTO của feature cấp học. */
    public record LevelSummary(Long id, String code, String name) {
    }

    public static SubjectResponse from(Subject item, RowLevelSecurity rowLevel) {
        List<Level> levels = item.getEducationLevels().stream()
                .map(l -> new Level(
                        new LevelSummary(
                                l.getEducationLevel().getId(),
                                l.getEducationLevel().getCode(),
                                l.getEducationLevel().getName()),
                        l.getSubjectType(),
                        l.getSortOrder()))
                .toList();
        return new SubjectResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.getTeachingCode(), levels,
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
