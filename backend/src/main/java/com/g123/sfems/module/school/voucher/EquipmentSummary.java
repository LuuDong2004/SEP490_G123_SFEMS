package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Tài sản trên một dòng phiếu: đủ để nhận ra cái máy mà không phải mở hồ sơ, và
 * đủ các cột mà bảng dòng phiếu của app Jmix cũ hiện (serial, nhóm, đơn vị tính,
 * nguyên giá, giá trị còn lại, năm sản xuất, hạn bảo hành, nguồn hình thành).
 */
public record EquipmentSummary(
        Long id,
        String code,
        String name,
        RefSummary room,
        RefSummary manager,
        AssetStatus status,
        EquipmentCondition condition,
        String serialNumber,
        RefSummary catalog,
        String trackingType,
        String unitName,
        Boolean unitAllowsFraction,
        BigDecimal quantity,
        BigDecimal originalValue,
        Integer productionYear,
        Integer usageStartYear,
        LocalDate warrantyExpiry,
        FundingSource fundingSource,
        String originSource) {

    public static EquipmentSummary of(Equipment item) {
        var catalog = item.getCatalog();
        var unit = item.getUnit() != null ? item.getUnit() : catalog == null ? null : catalog.getUnit();
        return new EquipmentSummary(item.getId(), item.getCode(), item.getName(),
                RefSummary.of(item.getRoom()), RefSummary.of(item.getManager()),
                item.getStatus(), item.getCondition(), item.getSerialNumber(),
                catalog == null ? null : new RefSummary(catalog.getId(), catalog.getCode(), catalog.getName()),
                catalog == null ? null : catalog.getTrackingType().name(),
                unit == null ? null : unit.getName(), unit == null ? null : unit.isAllowsFraction(), item.getQuantity(),
                item.getOriginalValue(), item.getProductionYear(),
                item.getUsageStartYear(), item.getWarrantyExpiry(), item.getFundingSource(),
                item.getOriginSource() == null ? null : item.getOriginSource().getName());
    }
}
