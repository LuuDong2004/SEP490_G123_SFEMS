package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.domain.catalog.coderule.CodeRule;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một quy tắc; {@code nextCode} là mã sẽ cấp tiếp theo. */
public record CodeRuleResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        String target,
        String prefix,
        String suffix,
        Integer numberLength,
        Long currentNumber,
        String nextCode,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static CodeRuleResponse from(CodeRule item, RowLevelSecurity rowLevel) {
        long current = item.getCurrentNumber() == null ? 0L : item.getCurrentNumber();
        return new CodeRuleResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.getTarget(), item.getPrefix(),
                item.getSuffix(), item.getNumberLength(), item.getCurrentNumber(),
                item.format(current + 1), item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
