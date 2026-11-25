package com.g123.sfems.module.school.facility;

import java.util.List;
import java.util.Map;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

/** Payload tạo phòng. */
public record RoomRequest(
        // Để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã; danh mục không có quy tắc thì báo thiếu.
        @Text(value = FieldRule.CODE, label = "Mã phòng")
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên phòng")
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        IdRef campus,
        IdRef building,
        IdRef roomType,
        IdRef subject,
        @Text(value = FieldRule.SHORT_TEXT, label = "Vị trí")
        String location,
        @Text(value = FieldRule.SHORT_TEXT, label = "Tầng", max = 50)
        String floor,
        @Num(value = NumberRule.AREA, label = "Diện tích")
        BigDecimal area,
        @Num(value = NumberRule.COUNT, label = "Sức chứa")
        Integer capacity,
        FacilityCondition condition,
        RoomUsageStatus usageStatus,
        IdRef managingStaff,
        @Text(value = FieldRule.SHORT_TEXT, label = "Đơn vị quản lý")
        String managingUnit,
        /** Kết cấu: Kiên cố / Bán kiên cố / Tạm / Nhờ, mượn, thuê. */
        FacilityStructure structure,
        /** Loại CSVC thứ hai mà phòng dùng kết hợp; id null là bỏ. */
        IdRef combinedType,
        /** Thông số theo loại (khoá theo thông số của loại CSVC). */
        Map<String, String> params,
        /** Lịch mở cửa: thứ 1–7 (ISO); rỗng = mọi ngày. */
        List<Integer> openDays,
        /** Buổi mở cửa: SANG, CHIEU, TOI; rỗng = mọi buổi. */
        List<String> openSessions) implements SchoolOwnedInput {
}
