package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

/**
 * Payload tạo quy tắc chuẩn CSVC. {@code code}, {@code name} bỏ qua — máy chủ sinh từ loại, cấp, mức. Các điều kiện
 * để trống là không xét.
 */
public record FacilityStandardRuleRequest(
        String code,
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        @NotNull(message = "Vui lòng chọn loại CSVC")
        IdRef roomType,
        @NotBlank(message = "Vui lòng chọn cấp học")
        String levelCode,
        @NotBlank(message = "Vui lòng chọn mức")
        String tier,
        @Num(value = NumberRule.COUNT, label = "Số phòng tối thiểu") Integer minCount,
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Số phòng mỗi lớp") BigDecimal countPerClass,
        @Num(value = NumberRule.AREA, label = "Diện tích mỗi phòng") BigDecimal minRoomArea,
        @Num(value = NumberRule.AREA, label = "Diện tích mỗi học sinh") BigDecimal areaPerStudent,
        @Num(value = NumberRule.AREA, label = "Tổng diện tích") BigDecimal minTotalArea,
        @Num(value = NumberRule.COUNT, label = "Trường lớn hơn số lớp") Integer largeClassFrom,
        @Num(value = NumberRule.COUNT, label = "Số phòng của trường lớn") Integer largeMinCount,
        @Num(value = NumberRule.PERCENT, label = "Phần trăm học sinh") BigDecimal studentPercent,
        Boolean onlyIfPresent,
        List<IdRef> legalDocuments,
        @Text(value = FieldRule.SHORT_TEXT, label = "Điều, khoản")
        String legalBasis) implements CatalogInput {

    /** Bản sao với mã, tên, thứ tự do máy chủ sinh. */
    FacilityStandardRuleRequest derived(String derivedCode, String derivedName, Integer order) {
        return new FacilityStandardRuleRequest(derivedCode, derivedName, order, active, note, roomType, levelCode,
                tier, minCount, countPerClass, minRoomArea, areaPerStudent, minTotalArea, largeClassFrom,
                largeMinCount, studentPercent, onlyIfPresent, legalDocuments, legalBasis);
    }
}
