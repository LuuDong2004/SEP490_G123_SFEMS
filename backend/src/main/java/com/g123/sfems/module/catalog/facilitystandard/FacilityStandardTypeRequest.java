package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Chuẩn của MỘT loại CSVC ở một cấp học, đủ ba mức trong một lần lưu (291). Mức không có điều kiện nào = không có yêu cầu
 * riêng: theo mức dưới.
 */
public record FacilityStandardTypeRequest(
        @NotBlank(message = "Vui lòng chọn cấp học") String levelCode,
        @NotNull @Size(min = 1, max = 3) List<@Valid @NotNull Tier> tiers) {

    public record Tier(
            @NotBlank(message = "Vui lòng chọn mức") String tier,
            @Num(value = NumberRule.COUNT, label = "Số phòng tối thiểu") Integer minCount,
            @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Số phòng theo số lớp") BigDecimal countPerClass,
            @Num(value = NumberRule.AREA, label = "Diện tích mỗi phòng") BigDecimal minRoomArea,
            @Num(value = NumberRule.AREA, label = "Diện tích theo học sinh") BigDecimal areaPerStudent,
            @Num(value = NumberRule.AREA, label = "Tổng diện tích") BigDecimal minTotalArea,
            @Num(value = NumberRule.COUNT, label = "Trường lớn hơn số lớp") Integer largeClassFrom,
            @Num(value = NumberRule.COUNT, label = "Số phòng của trường lớn") Integer largeMinCount,
            @Num(value = NumberRule.PERCENT, label = "Phần trăm học sinh") BigDecimal studentPercent,
            Boolean onlyIfPresent,
            List<IdRef> legalDocuments,
            @Text(value = FieldRule.SHORT_TEXT, label = "Điều, khoản") String legalBasis,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note) {

        boolean blank() {
            return minCount == null && countPerClass == null && minRoomArea == null && areaPerStudent == null
                    && minTotalArea == null;
        }
    }
}
