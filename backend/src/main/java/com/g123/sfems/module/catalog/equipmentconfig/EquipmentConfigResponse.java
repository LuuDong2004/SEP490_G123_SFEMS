package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.equipmentconfig.AttributeDataType;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfig;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfigAttribute;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một bộ thông số, kèm các thông số. */
public record EquipmentConfigResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        String description,
        Boolean defaultConfig,
        List<RefSummary> scopeTypes,
        String documentNo,
        String documentName,
        LocalDate issueDate,
        RefSummary startSchoolYear,
        RefSummary endSchoolYear,
        List<Attribute> attributes,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public record Attribute(
            Long id,
            String code,
            String name,
            AttributeDataType dataType,
            String measureUnit,
            Boolean required,
            List<String> options) {

        static Attribute of(EquipmentConfigAttribute a) {
            return new Attribute(a.getId(), a.getCode(), a.getName(), a.getDataType(),
                    a.getMeasureUnit(), a.getRequired(), a.getOptionList());
        }
    }

    public static EquipmentConfigResponse from(EquipmentConfig item, RowLevelSecurity rowLevel) {
        return new EquipmentConfigResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(), item.getDescription(), item.getDefaultConfig(),
                item.getScopeTypes().stream().map(RefSummary::of).toList(),
                item.getDocumentNo(), item.getDocumentName(), item.getIssueDate(),
                RefSummary.of(item.getStartSchoolYear()),
                RefSummary.of(item.getEndSchoolYear()),
                item.getAttributes().stream().map(Attribute::of).toList(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
