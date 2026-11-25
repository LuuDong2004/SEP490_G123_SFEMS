package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import java.math.BigDecimal;
import java.util.List;

/**
 * Payload sửa quy tắc chuẩn CSVC. {@code code}, {@code name}, {@code sortOrder} bỏ qua (máy chủ sinh lại khi đổi
 * loại / cấp / mức). Form gửi đủ các điều kiện, nên điều kiện {@code null} là XOÁ điều kiện đó, không phải để nguyên.
 */
public record FacilityStandardRulePatchRequest(
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef roomType,
        String levelCode,
        String tier,
        @Num(value = NumberRule.COUNT, label = "Số phòng tối thiểu") Integer minCount,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Số phòng mỗi lớp") BigDecimal countPerClass,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Diện tích mỗi phòng") BigDecimal minRoomArea,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Diện tích mỗi học sinh") BigDecimal areaPerStudent,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Tổng diện tích") BigDecimal minTotalArea,
        @Num(value = NumberRule.COUNT, label = "Trường lớn hơn số lớp") Integer largeClassFrom,
        @Num(value = NumberRule.COUNT, label = "Số phòng của trường lớn") Integer largeMinCount,
        @Num(value = NumberRule.PERCENT, label = "Phần trăm học sinh") BigDecimal studentPercent,
        Boolean onlyIfPresent,
        List<IdRef> legalDocuments,
        @Text(value = FieldRule.SHORT_TEXT, label = "Điều, khoản")
        String legalBasis) implements CatalogInput {

    /** Bỏ mã, tên, thứ tự client gửi — lớp nền không được ghi đè phần máy chủ sinh. */
    FacilityStandardRulePatchRequest withoutDerived() {
        return new FacilityStandardRulePatchRequest(null, null, null, active, note, roomType, levelCode, tier,
                minCount, countPerClass, minRoomArea, areaPerStudent, minTotalArea, largeClassFrom,
                largeMinCount, studentPercent, onlyIfPresent, legalDocuments, legalBasis);
    }
}
