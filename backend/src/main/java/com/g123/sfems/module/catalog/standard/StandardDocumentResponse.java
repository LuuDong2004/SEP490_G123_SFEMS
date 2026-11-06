package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.DocumentRole;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import java.time.LocalDate;

public record StandardDocumentResponse(
        Long id, DocumentRole documentRole, String documentNo, String documentName,
        String issuingAuthority, LocalDate issueDate, LocalDate effectiveDate,
        String url, Integer sortOrder) {
    public static StandardDocumentResponse from(EquipmentStandardDocument item) {
        return new StandardDocumentResponse(item.getId(), item.getDocumentRole(), item.getDocumentNo(),
                item.getDocumentName(), item.getIssuingAuthority(), item.getIssueDate(),
                item.getEffectiveDate(), item.getUrl(), item.getSortOrder());
    }
}
