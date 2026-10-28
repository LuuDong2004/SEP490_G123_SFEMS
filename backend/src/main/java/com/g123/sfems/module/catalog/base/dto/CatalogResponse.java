package com.g123.sfems.module.catalog.base.dto;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một mục danh mục. */
public record CatalogResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static CatalogResponse from(CatalogEntity item, RowLevelSecurity rowLevel) {
        return new CatalogResponse(
                item.getId(),
                item.getCode(),
                item.getName(),
                item.getSortOrder(),
                item.getActive(),
                item.getNote(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
