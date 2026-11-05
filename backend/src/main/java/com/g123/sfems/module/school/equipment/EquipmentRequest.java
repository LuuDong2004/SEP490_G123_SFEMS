package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Payload tạo hồ sơ thiết bị thủ công (TS-01). Dòng phiếu nhập không đi qua đây — sinh tài sản từ
 * {@link EquipmentService#generateFromIntakeLine}.
 *
 * <p>Mã để trống là để máy cấp (TS-06); đến khi TS-06 xong thì phải khai mã tay.
 */
public record EquipmentRequest(
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên là bắt buộc")
        @Size(max = 255, message = "Tên tối đa 255 ký tự")
        String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note,

        IdRef school,

        @NotNull(message = "Chọn danh mục thiết bị")
        IdRef catalog,

        PhysicalDigitalType physicalOrDigital,

        AssetCategory assetCategory,

        @Size(max = 64) String legacyCode,

        @Size(max = 100, message = "Số serial tối đa 100 ký tự") String serialNumber,

        @Size(max = 255) String model,

        @Size(max = 255) String manufacturer,

        IdRef unit,

        @Positive(message = "Số lượng phải lớn hơn 0") BigDecimal quantity,

        IdRef originSource,

        IdRef acquisitionMethod,

        FundingSource fundingSource,

        @Size(max = 255) String originNote,

        @Size(max = 255) String fundingNote,

        @Size(max = 255) String acquisitionNote,

        Integer productionYear,

        Integer usageStartYear,

        LocalDate receivedDate,

        LocalDate purchaseDate,

        @PositiveOrZero(message = "Nguyên giá không được âm") BigDecimal originalValue,

        LocalDate warrantyExpiry,

        Map<String, String> specs) implements SchoolOwnedInput {
}
