package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.base.SchoolOwnedInput;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** Payload tạo thiết bị. Mã giữ nguyên mã gợi ý thì chốt số của bộ đếm. */
public record EquipmentRequest(
        @NotBlank(message = "Mã thiết bị là bắt buộc")
        @Text(value = FieldRule.CODE, label = "Mã thiết bị")
        String code,
        @NotBlank(message = "Tên là bắt buộc")
        @Text(value = FieldRule.NAME, label = "Tên thiết bị", max = 200, min = 2)
        String name,
        @Num(value = NumberRule.COUNT, label = "Thứ tự") Integer sortOrder,
        Boolean active,
        @Text(value = FieldRule.NOTE, label = "Ghi chú")
        String note,
        IdRef school,
        @NotNull(message = "Chọn nhóm thiết bị")
        IdRef catalog,
        PhysicalDigitalType physicalOrDigital,
        AssetCategory assetCategory,
        @Text(value = FieldRule.SERIAL, label = "Số serial", min = 3)
        String serialNumber,
        @Text(value = FieldRule.SHORT_TEXT, label = "Model", max = 50)
        String model,
        @Text(value = FieldRule.SHORT_TEXT, label = "Hãng sản xuất", max = 100)
        String manufacturer,
        IdRef unit,
        @Positive(message = "Số lượng phải lớn hơn 0")
        @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Số lượng")
        BigDecimal quantity,
        IdRef originSource,
        IdRef acquisitionMethod,
        FundingSource fundingSource,
        @Num(value = NumberRule.YEAR, label = "Năm sản xuất")
        Integer productionYear,
        @Num(value = NumberRule.YEAR, label = "Năm đưa vào sử dụng")
        Integer usageStartYear,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày tiếp nhận")
        LocalDate receivedDate,
        @DateValue(value = DateRule.PAST_OR_TODAY, label = "Ngày mua")
        LocalDate purchaseDate,
        @Num(value = NumberRule.MONEY, label = "Nguyên giá")
        BigDecimal originalValue,
        @DateValue(value = DateRule.ANY, label = "Hạn bảo hành")
        LocalDate warrantyExpiry,
        // Hạn sử dụng — chỉ vật tư tiêu hao, hoá chất.
        @DateValue(value = DateRule.ANY, label = "Hạn sử dụng")
        LocalDate expiryDate,
        IdRef room,
        IdRef manager,
        EquipmentCondition condition,
        AssetStatus status,
        IdRef config,
        Map<String, String> specs) implements SchoolOwnedInput {
}
