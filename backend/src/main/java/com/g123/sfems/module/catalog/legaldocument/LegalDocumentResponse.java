package com.g123.sfems.module.catalog.legaldocument;

import com.g123.sfems.domain.catalog.legaldocument.LegalDocument;
import com.g123.sfems.domain.catalog.legaldocument.LegalDocumentType;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/** Hình dạng trên đường truyền của một văn bản quy định. */
public record LegalDocumentResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        LegalDocumentType docType,
        String issuer,
        LocalDate issuedOn,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        RefSummary replaces,
        boolean effective,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static LegalDocumentResponse from(LegalDocument d, RowLevelSecurity rowLevel) {
        LegalDocument r = d.getReplaces();
        return new LegalDocumentResponse(
                d.getId(), d.getCode(), d.getName(), d.getSortOrder(), d.getActive(), d.getNote(),
                d.getDocType(), d.getIssuer(), d.getIssuedOn(), d.getEffectiveFrom(), d.getEffectiveTo(),
                r == null ? null : RefSummary.of(r),
                d.effectiveOn(LegalDocumentService.today()),
                d.getCreatedAt(), d.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(d));
    }
}
