package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.standard.AdjustKind;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
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
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        Long replacesId,
        Long replacedById,
        DocumentSummary endDocument,
        Adjustment adjustment,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public record DocumentSummary(Long id, String documentNo, String documentName) {

        static DocumentSummary of(EquipmentStandardDocument d) {
            return d == null ? null
                    : new DocumentSummary(d.getId(), d.getDocumentNo(), d.getDocumentName());
        }
    }

    /** Điều chỉnh của dòng (changelog 276). */
    public record Adjustment(AdjustKind kind, BigDecimal quantity, NormBasis basis, Integer basisSize, String condition,
            RefSummary substituteCatalog, String substituteText, boolean substituteRequired, String group,
            Integer groupPick, String basisText, List<RefSummary> shared) {

        static Adjustment of(EquipmentNorm n) {
            return new Adjustment(n.getAdjustKind(),
                    n.getAdjustQuantity() == null ? null : n.getAdjustQuantity().stripTrailingZeros(),
                    n.getAdjustBasis(), n.getAdjustBasisSize(), n.getAdjustCondition(),
                    RefSummary.of(n.getAdjustSubstituteCatalog()), n.getAdjustSubstituteText(),
                    n.isAdjustSubstituteRequired(), n.getAdjustGroup(), n.getAdjustGroupPick(), n.getAdjustBasisText(),
                    n.getAdjustShared().stream().sorted(Comparator.comparing(EquipmentCatalog::getCode,
                            Comparator.nullsLast(Comparator.naturalOrder()))).map(RefSummary::of).toList());
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
                item.getEffectiveFrom(),
                item.getEffectiveTo(),
                item.getReplaces() == null ? null : item.getReplaces().getId(),
                item.getReplacedById(),
                DocumentSummary.of(item.getEndDocument()),
                Adjustment.of(item),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
