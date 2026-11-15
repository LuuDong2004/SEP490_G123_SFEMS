package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.DocumentRole;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.domain.catalog.standard.RevisionKind;
import com.g123.sfems.domain.catalog.standard.StandardStatus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một bộ tiêu chuẩn, kèm văn bản căn cứ. */
public record EquipmentStandardResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        /** DRAFT / ACTIVE / RETIRED — nháp, đang áp dụng, hết hiệu lực. */
        StandardStatus status,
        String note,
        RefSummary educationLevel,
        RefSummary startSchoolYear,
        RefSummary endSchoolYear,
        String standardVersion,
        RefSummary previousStandard,
        List<Document> documents,
        /** Lần sửa: AMENDMENT (sửa đổi, bổ sung) / CORRECTION (đính chính); trống với bộ gốc. */
        RevisionKind revisionKind,
        /** Văn bản của lần sửa — id một dòng trong {@code documents}. */
        Long revisionDocumentId,
        String revisionNote,
        /** Lúc xác nhận áp dụng / lúc hết hiệu lực (bộ mới thay nó được áp dụng). */
        Instant appliedAt,
        Instant retiredAt,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public record Document(
            Long id,
            DocumentRole documentRole,
            String documentNo,
            String documentName,
            String issuingAuthority,
            LocalDate issueDate,
            LocalDate effectiveDate,
            String url) {

        static Document of(EquipmentStandardDocument d) {
            return new Document(d.getId(), d.getDocumentRole(), d.getDocumentNo(),
                    d.getDocumentName(), d.getIssuingAuthority(), d.getIssueDate(),
                    d.getEffectiveDate(), d.getUrl());
        }
    }

    public static EquipmentStandardResponse from(EquipmentStandard item, RowLevelSecurity rowLevel) {
        return new EquipmentStandardResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getStatus(), item.getNote(),
                RefSummary.of(item.getEducationLevel()),
                RefSummary.of(item.getStartSchoolYear()),
                RefSummary.of(item.getEndSchoolYear()),
                item.getStandardVersion(), RefSummary.of(item.getPreviousStandard()),
                item.getDocuments().stream().map(Document::of).toList(),
                item.getRevisionKind(), item.getRevisionDocumentId(), item.getRevisionNote(),
                item.getAppliedAt(), item.getRetiredAt(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
