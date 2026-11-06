package com.g123.sfems.module.catalog.standard;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.StandardStatus;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.List;

public record EquipmentStandardResponse(
        @JsonUnwrapped CatalogResponse base, RefSummary educationLevel,
        RefSummary startSchoolYear, RefSummary endSchoolYear,
        String standardVersion, StandardStatus status, RefSummary previousStandard,
        List<StandardDocumentResponse> documents) {
    public static EquipmentStandardResponse from(EquipmentStandard item, RowLevelSecurity rowLevel,
            List<StandardDocumentResponse> documents) {
        return new EquipmentStandardResponse(CatalogResponse.from(item, rowLevel),
                RefSummary.of(item.getEducationLevel()), RefSummary.of(item.getStartSchoolYear()),
                RefSummary.of(item.getEndSchoolYear()), item.getStandardVersion(), item.getStatus(),
                RefSummary.of(item.getPreviousStandard()), documents);
    }
}
