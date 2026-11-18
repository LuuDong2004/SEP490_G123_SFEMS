package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Payload sửa khối nhà. {@code null} là để nguyên. */
public record BuildingPatchRequest(
        @Size(min = 1, message = "Mã khối nhà không được để trống")
        @Text(value = FieldRule.CODE, label = "Mã khối nhà")
        String code,
        @Size(min = 1, message = "Tên khối nhà không được để trống")
        @Text(value = FieldRule.NAME, label = "Tên khối nhà")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        IdRef campus,
        @Min(value = 0, message = "Số tầng không được âm")
        @Max(value = 200, message = "Số tầng tối đa 200")
        Integer floorCount,
        @Min(value = 1800, message = "Năm đưa vào sử dụng không hợp lệ")
        @Max(value = 2100, message = "Năm đưa vào sử dụng không hợp lệ")
        Integer builtYear,
        @DecimalMin(value = "0", message = "Diện tích không được âm")
        BigDecimal floorArea,
        FacilityCondition condition,
        IdRef managingStaff,
        /** Kết cấu: Kiên cố / Bán kiên cố / Tạm / Nhờ, mượn, thuê. */
        FacilityStructure structure) implements SchoolOwnedInput {
}
