package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Payload sửa hồ sơ thiết bị, ngữ nghĩa patch: {@code null} là để nguyên.
 *
 * <p>{@code status} và {@code condition} đi qua {@link EquipmentLifecycle}, nên mỗi lần đổi đều có dòng
 * lịch sử. Trường không được đổi qua đây: {@code school} (cố định sau khi tạo), {@code intakeLine} (do
 * phiếu nhập gắn).
 */
public record EquipmentPatchRequest(
        @Size(max = 64, message = "Mã tối đa 64 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @Size(max = 255, message = "Tên tối đa 255 ký tự") String name,

        @PositiveOrZero(message = "Thứ tự không được âm") Integer sortOrder,

        Boolean active,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note,

        IdRef school,

        IdRef catalog,

        PhysicalDigitalType physicalOrDigital,

        AssetCategory assetCategory,

        @Size(max = 64) String legacyCode,

        @Size(max = 100) String serialNumber,

        @Size(max = 255) String model,

        @Size(max = 255) String manufacturer,

        IdRef unit,

        BigDecimal quantity,

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

        AssetStatus status,

        EquipmentCondition condition,

        Map<String, String> specs) implements SchoolOwnedInput {
}
