package com.g123.sfems.module.school.equipment;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một hồ sơ thiết bị. */
public record EquipmentResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        Instant createdAt,
        Instant updatedAt,
        Ref school,
        Ref catalog,
        PhysicalDigitalType physicalOrDigital,
        AssetCategory assetCategory,
        String legacyCode,
        String serialNumber,
        String model,
        String manufacturer,
        Ref unit,
        BigDecimal quantity,
        Ref originSource,
        Ref acquisitionMethod,
        FundingSource fundingSource,
        String originNote,
        String fundingNote,
        String acquisitionNote,
        Integer productionYear,
        Integer usageStartYear,
        LocalDate receivedDate,
        LocalDate purchaseDate,
        BigDecimal originalValue,
        BigDecimal remainingValue,
        LocalDate warrantyExpiry,
        Ref room,
        AssetStatus status,
        EquipmentCondition condition,
        Long intakeLineId,
        Map<String, String> specs,
        /** Hồ sơ còn thiếu gì, tính ra lúc đọc. Rỗng là hồ sơ chuẩn. */
        List<String> missingProfile,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /** Tham chiếu gọn: id và tên để hiển thị, không kéo cả bản ghi. */
    public record Ref(Long id, String name) {
        static Ref of(Long id, String name) {
            return id == null ? null : new Ref(id, name);
        }
    }

    public static EquipmentResponse from(Equipment item, RowLevelSecurity rowLevel) {
        return new EquipmentResponse(
                item.getId(),
                item.getCode(),
                item.getName(),
                item.getSortOrder(),
                item.getActive(),
                item.getNote(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                item.getSchool() == null ? null : Ref.of(item.getSchool().getId(), item.getSchool().getName()),
                item.getCatalog() == null ? null : Ref.of(item.getCatalog().getId(), item.getCatalog().getName()),
                item.getPhysicalOrDigital(),
                item.getAssetCategory(),
                item.getLegacyCode(),
                item.getSerialNumber(),
                item.getModel(),
                item.getManufacturer(),
                item.getUnit() == null ? null : Ref.of(item.getUnit().getId(), item.getUnit().getName()),
                item.getQuantity(),
                item.getOriginSource() == null ? null
                        : Ref.of(item.getOriginSource().getId(), item.getOriginSource().getName()),
                item.getAcquisitionMethod() == null ? null
                        : Ref.of(item.getAcquisitionMethod().getId(), item.getAcquisitionMethod().getName()),
                item.getFundingSource(),
                item.getOriginNote(),
                item.getFundingNote(),
                item.getAcquisitionNote(),
                item.getProductionYear(),
                item.getUsageStartYear(),
                item.getReceivedDate(),
                item.getPurchaseDate(),
                item.getOriginalValue(),
                item.getRemainingValue(),
                item.getWarrantyExpiry(),
                item.getRoom() == null ? null : Ref.of(item.getRoom().getId(), item.getRoom().getName()),
                item.getStatus(),
                item.getCondition(),
                item.getIntakeLine() == null ? null : item.getIntakeLine().getId(),
                item.getSpecs(),
                item.missingProfile(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }
}
