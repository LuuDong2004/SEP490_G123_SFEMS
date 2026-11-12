package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Payload sửa phòng (TC-02), ngữ nghĩa patch: {@code null} là để nguyên, chuỗi rỗng là XÓA giá trị đang có.
 *
 * <p>Mã phòng sửa được (khác mã tài sản — mã tài sản sinh theo quy tắc chuẩn của toàn ngành). Phòng chưa có
 * mã do máy cấp sẽ được cấp khi sửa mà mã để trống.
 */
public record RoomPatchRequest(
        @Size(min = 1, message = "Mã phòng không được để trống")
        @Size(max = 64, message = "Mã phòng tối đa 64 ký tự")
        @Pattern(
                regexp = "^[A-Za-z0-9._-]+$",
                message = "Mã phòng chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(min = 1, message = "Tên phòng không được để trống")
        @Size(max = 255, message = "Tên phòng tối đa 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm")
        @Max(value = 99999, message = "Thứ tự tối đa 99.999")
        Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note,

        /** Không đổi được trường sau khi tạo — {@link com.g123.sfems.module.school.base.SchoolOwnedService} chặn. */
        IdRef school,

        IdRef roomType,

        IdRef subject,

        @Size(max = 100, message = "Khối nhà tối đa 100 ký tự") String building,

        @Size(max = 50, message = "Tầng tối đa 50 ký tự") String floor,

        @Size(max = 255, message = "Vị trí tối đa 255 ký tự") String location,

        @PositiveOrZero(message = "Diện tích không được âm")
        @DecimalMax(value = "1000000", message = "Diện tích tối đa 1.000.000 m²")
        @Digits(integer = 8, fraction = 2, message = "Diện tích tối đa hai chữ số thập phân")
        BigDecimal area,

        @PositiveOrZero(message = "Sức chứa không được âm")
        @Max(value = 99999, message = "Sức chứa tối đa 99.999")
        Integer capacity,

        FacilityCondition condition,

        RoomUsageStatus usageStatus,

        @Size(max = 255, message = "Đơn vị quản lý tối đa 255 ký tự") String managingUnit)
        implements SchoolOwnedInput {
}
