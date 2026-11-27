package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

/** Payload tạo khối nhà. */
public record BuildingRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã; danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã khối nhà")
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên khối nhà")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        IdRef campus,
        @Min(value = 1, message = "Số tầng từ 1 đến 50")
        @Max(value = 50, message = "Số tầng từ 1 đến 50")
        Integer floorCount,
        // Trần là năm nay: kiểm ở BuildingService (chú thích không đọc được năm hiện tại).
        @Min(value = 1900, message = "Năm đưa vào sử dụng phải từ 1900")
        Integer builtYear,
        @Num(value = NumberRule.AREA, label = "Diện tích sàn")
        BigDecimal floorArea,
        FacilityCondition condition,
        IdRef managingStaff,
        /** Kết cấu: Kiên cố / Bán kiên cố / Tạm / Nhờ, mượn, thuê. */
        FacilityStructure structure) implements SchoolOwnedInput {
}
