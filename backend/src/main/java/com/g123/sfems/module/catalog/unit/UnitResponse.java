package com.g123.sfems.module.catalog.unit;

import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một đơn vị tính. */
public record UnitResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        boolean allowsFraction,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static UnitResponse from(Unit item, RowLevelSecurity rowLevel) {
        return new UnitResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.isAllowsFraction(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
