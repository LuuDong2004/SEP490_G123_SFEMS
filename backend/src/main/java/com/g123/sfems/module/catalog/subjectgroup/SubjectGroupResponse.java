package com.g123.sfems.module.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một tổ chuyên môn. */
public record SubjectGroupResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        Summary educationLevel,
        List<Summary> subjects,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /**
     * Cấp học hoặc môn học, rút gọn. Khai ở đây chứ không import DTO của
     * feature khác. Môn học chỉ có id/mã/tên — danh sách cấp học của từng môn
     * không cần ở màn tổ, và kéo theo nó sẽ làm payload phình theo cấp số.
     */
    public record Summary(Long id, String code, String name) {
    }

    public static SubjectGroupResponse from(SubjectGroup item, RowLevelSecurity rowLevel) {
        var level = item.getEducationLevel();
        return new SubjectGroupResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                level == null ? null : new Summary(level.getId(), level.getCode(), level.getName()),
                item.getSubjects().stream()
                        .map(s -> new Summary(s.getId(), s.getCode(), s.getName()))
                        .toList(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
