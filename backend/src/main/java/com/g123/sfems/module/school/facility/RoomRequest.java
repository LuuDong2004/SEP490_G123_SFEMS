package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Payload tạo phòng (TC-02).
 *
 * <p>Mã để trống (hoặc vắng) là để máy chủ cấp theo quy tắc mã của trường — {@code PH0001} mặc định, xem
 * {@link RoomCodeService}. Có mã thì giữ đúng mã đó và vẫn đi qua kiểm trùng trong trường.
 *
 * <p>Khối nhà và tầng là HAI Ô CHỮ ("Dãy A", "Tầng 2"), không phải tham chiếu tới bảng: phạm vi đồ án chỉ
 * quản lý tới phòng. Vì vậy không có luật "cơ sở lấy theo khối nhà" và không có kiểm cùng trường cho hai ô
 * đó — chỉ loại phòng và môn học là tham chiếu thật.
 *
 * <p>Khoảng giá trị theo luật AREA và COUNT của bản gốc: diện tích 0–1.000.000 m² với hai số lẻ, các số
 * đếm 0–99.999 nguyên.
 */
public record RoomRequest(
        @Size(max = 64, message = "Mã phòng tối đa 64 ký tự")
        @Pattern(
                regexp = "^$|^[A-Za-z0-9._-]+$",
                message = "Mã phòng chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên phòng là bắt buộc")
        @Size(max = 255, message = "Tên phòng tối đa 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm")
        @Max(value = 99999, message = "Thứ tự tối đa 99.999")
        Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note,

        /** Vắng thì lấy trường của tài khoản đang đăng nhập. */
        IdRef school,

        IdRef roomType,

        /** Phòng bộ môn / thí nghiệm là của môn nào; trống với phòng học thường, kho, thư viện. */
        IdRef subject,

        @Size(max = 100, message = "Khối nhà tối đa 100 ký tự") String building,

        @Size(max = 50, message = "Tầng tối đa 50 ký tự") String floor,

        @Size(max = 255, message = "Vị trí tối đa 255 ký tự") String location,

        /** Diện tích (m²). */
        @PositiveOrZero(message = "Diện tích không được âm")
        @DecimalMax(value = "1000000", message = "Diện tích tối đa 1.000.000 m²")
        @Digits(integer = 8, fraction = 2, message = "Diện tích tối đa hai chữ số thập phân")
        BigDecimal area,

        @PositiveOrZero(message = "Sức chứa không được âm")
        @Max(value = 99999, message = "Sức chứa tối đa 99.999")
        Integer capacity,

        FacilityCondition condition,

        RoomUsageStatus usageStatus,

        /** Đơn vị / tổ quản lý phòng, nhập tự do: "Tổ Vật lí", "Thư viện". */
        @Size(max = 255, message = "Đơn vị quản lý tối đa 255 ký tự") String managingUnit)
        implements SchoolOwnedInput {
}
