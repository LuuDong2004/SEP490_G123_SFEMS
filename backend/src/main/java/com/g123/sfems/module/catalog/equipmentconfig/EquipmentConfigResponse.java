package com.g123.sfems.module.catalog.equipmentconfig;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.equipmentconfig.AttributeDataType;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfig;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfigAttribute;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.time.LocalDate;
import java.util.List;

/** Bộ thông số trên đường truyền: các trường chung được trải phẳng, kèm phạm vi, văn bản và các thông số. */
public record EquipmentConfigResponse(
        @JsonUnwrapped CatalogResponse base,
        String description,
        Boolean defaultConfig,
        List<RefSummary> scopeTypes,
        String documentNo,
        String documentName,
        LocalDate issueDate,
        RefSummary startSchoolYear,
        RefSummary endSchoolYear,
        List<Attribute> attributes) {

    public record Attribute(
            Long id,
            String code,
            String name,
            AttributeDataType dataType,
            String measureUnit,
            Boolean required,
            List<String> options) {

        static Attribute of(EquipmentConfigAttribute attribute) {
            return new Attribute(attribute.getId(), attribute.getCode(), attribute.getName(),
                    attribute.getDataType(), attribute.getMeasureUnit(), attribute.getRequired(),
                    attribute.getOptionList());
        }
    }

    public static EquipmentConfigResponse from(EquipmentConfig item, RowLevelSecurity rowLevel) {
        return new EquipmentConfigResponse(
                CatalogResponse.from(item, rowLevel),
                item.getDescription(),
                item.getDefaultConfig(),
                item.getScopeTypes().stream().map(RefSummary::of).toList(),
                item.getDocumentNo(),
                item.getDocumentName(),
                item.getIssueDate(),
                RefSummary.of(item.getStartSchoolYear()),
                RefSummary.of(item.getEndSchoolYear()),
                item.getAttributes().stream().map(Attribute::of).toList());
    }
}
