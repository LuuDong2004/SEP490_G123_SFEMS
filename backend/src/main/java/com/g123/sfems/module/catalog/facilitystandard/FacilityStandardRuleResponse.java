package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một quy tắc chuẩn CSVC. */
public record FacilityStandardRuleResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RoomTypeSummary roomType,
        String levelCode,
        String tier,
        Integer minCount,
        BigDecimal countPerClass,
        BigDecimal minRoomArea,
        BigDecimal areaPerStudent,
        BigDecimal minTotalArea,
        Integer largeClassFrom,
        Integer largeMinCount,
        BigDecimal studentPercent,
        Boolean onlyIfPresent,
        Boolean subjectRooms,
        List<LegalDocumentSummary> legalDocuments,
        String legalBasis,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /** Loại CSVC rút gọn, kèm tên khối — cột "Khối" của danh sách. */
    public record RoomTypeSummary(Long id, String code, String name, String groupName) {
    }

    /** Văn bản căn cứ rút gọn: số hiệu, trích yếu. */
    public record LegalDocumentSummary(Long id, String code, String name) {
    }

    public static FacilityStandardRuleResponse from(FacilityStandardRule item, RowLevelSecurity rowLevel) {
        RoomType type = item.getRoomType();
        return new FacilityStandardRuleResponse(item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                type == null ? null : new RoomTypeSummary(type.getId(), type.getCode(), type.getName(),
                        type.getGroup() == null ? null : type.getGroup().getName()),
                item.getLevelCode(), item.getTier(), item.getMinCount(), item.getCountPerClass(),
                item.getMinRoomArea(), item.getAreaPerStudent(), item.getMinTotalArea(), item.getLargeClassFrom(),
                item.getLargeMinCount(), item.getStudentPercent(), item.getOnlyIfPresent(), item.getSubjectRooms(),
                item.getLegalDocuments().stream()
                        .map(d -> new LegalDocumentSummary(d.getId(), d.getCode(), d.getName())).toList(),
                item.getLegalBasis(),
                item.getCreatedAt(), item.getUpdatedAt(), rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
