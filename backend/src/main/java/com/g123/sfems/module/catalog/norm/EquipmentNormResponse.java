package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** Hình dạng trên đường truyền của một dòng danh mục tối thiểu. */
public record EquipmentNormResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary standard,
        RefSummary catalog,
        RefSummary equipmentType,
        RefSummary subject,
        RefSummary grade,
        RefSummary roomType,
        BigDecimal minQuantity,
        RefSummary unit,
        NormBasis normBasis,
        Integer basisSize,
        String quantityText,
        String unitText,
        String gradeLevels,
        String itemNo,
        String sectionName,
        String topic,
        String purpose,
        String description,
        boolean forTeacher,
        boolean forStudent,
        boolean optional,
        DocumentSummary sourceDocument,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public record DocumentSummary(Long id, String documentNo, String documentName) {

        static DocumentSummary of(EquipmentStandardDocument d) {
            return d == null ? null
                    : new DocumentSummary(d.getId(), d.getDocumentNo(), d.getDocumentName());
        }
    }

    public static EquipmentNormResponse from(EquipmentNorm item, RowLevelSecurity rowLevel) {
        return new EquipmentNormResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                RefSummary.of(item.getStandard()),
                RefSummary.of(item.getCatalog()),
                RefSummary.of(item.getEquipmentType()),
                RefSummary.of(item.getSubject()),
                RefSummary.of(item.getGrade()),
                RefSummary.of(item.getRoomType()),
                item.getMinQuantity() == null ? null : item.getMinQuantity().stripTrailingZeros(),
                RefSummary.of(item.getUnit()),
                item.getNormBasis(),
                item.getBasisSize(),
                item.getQuantityText(),
                item.getUnitText(),
                item.getGradeLevels(),
                item.getItemNo(),
                item.getSectionName(),
                item.getTopic(),
                item.getPurpose(),
                item.getDescription(),
                item.isForTeacher(),
                item.isForStudent(),
                item.isOptional(),
                DocumentSummary.of(item.getSourceDocument()),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
