package com.g123.sfems.module.catalog.educationlevel.api.dto;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một cấp học. */
public record EducationLevelResponse(
        Long id,
        String code,
        String name,
        String shortName,
        Integer sortOrder,
        Boolean active,
        String note,
        Instant createdAt,
        Instant updatedAt,
        /**
         * Người gọi được làm gì với CHÍNH DÒNG NÀY, dạng
         * {@code {"write": true, "delete": false}}.
         *
         * <p>Rỗng ở đây, và rỗng là đúng: {@code education_levels} không nằm
         * trong diện quản lý theo dòng, nên câu trả lời hoàn toàn do mã quyền
         * quyết định và frontend đã biết mã quyền rồi. Vẫn giữ trường này để
         * hình dạng payload giống mọi resource khác — ngày nào danh mục cần
         * phạm vi theo dòng thì không phải đổi hợp đồng.
         */
        @JsonProperty("_can")
        Map<String, Boolean> can) {

    /** Không kèm cờ dòng — dùng cho tiếng vọng của bản ghi vừa xoá. */
    public static EducationLevelResponse from(EducationLevel level) {
        return from(level, null);
    }

    public static EducationLevelResponse from(EducationLevel level, RowLevelSecurity rowLevel) {
        return new EducationLevelResponse(
                level.getId(),
                level.getCode(),
                level.getName(),
                level.getShortName(),
                level.getSortOrder(),
                level.getActive(),
                level.getNote(),
                level.getCreatedAt(),
                level.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(level));
    }
}
