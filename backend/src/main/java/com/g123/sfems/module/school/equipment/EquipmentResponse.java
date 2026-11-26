package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/** Hình dạng trên đường truyền của một thiết bị. */
public record EquipmentResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        RefSummary catalog,
        /** Thiết bị ngoài danh mục của Sở (trường tự thêm — đồ tự làm, được tài trợ, mua ngoài danh mục). */
        boolean outOfCatalog,
        /** Môn học của thiết bị trong danh mục — môn chính trước, rồi các môn thêm (108). */
        List<RefSummary> subjects,
        String trackingType,
        PhysicalDigitalType physicalOrDigital,
        AssetCategory assetCategory,
        String serialNumber,
        String model,
        String manufacturer,
        RefSummary unit,
        Boolean unitAllowsFraction,
        BigDecimal quantity,
        RefSummary originSource,
        RefSummary acquisitionMethod,
        FundingSource fundingSource,
        String originNote,
        String fundingNote,
        String acquisitionNote,
        Integer productionYear,
        Integer usageStartYear,
        LocalDate receivedDate,
        LocalDate purchaseDate,
        BigDecimal originalValue,
        LocalDate warrantyExpiry,
        LocalDate expiryDate,
        RefSummary room,
        RefSummary manager,
        EquipmentCondition condition,
        AssetStatus status,
        RefSummary config,
        Map<String, String> specs,
        /**
         * Phiếu nhập đã sinh ra tài sản này — {@code null} với tài sản nhập tay.
         * Mã ở đây là SỐ PHIẾU, nên màn chi tiết dẫn ngược về chứng từ được.
         */
        RefSummary intake,
        /** Chứng từ của dòng phiếu nhập đã sinh ra tài sản — nhà cung cấp, hoá đơn; {@code null} với tài sản nhập tay. */
        IntakeDocument intakeDocument,
        /** Hồ sơ đã chuẩn chưa — chỉ tài sản hồ sơ chuẩn mới vào được phiếu nghiệp vụ. */
        Boolean profileComplete,
        /** Hồ sơ còn thiếu gì, để màn hình nói ra thay vì chỉ một nhãn "chưa đủ". */
        List<String> missingProfile,
        /** Mã trước khi chuẩn hoá, nếu có. */
        String legacyCode,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    public static EquipmentResponse from(Equipment item, RowLevelSecurity rowLevel) {
        School school = item.getSchool();
        var unit = item.getUnit() != null ? item.getUnit() : item.getCatalog().getUnit();
        return new EquipmentResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                new RefSummary(school.getId(), school.getCode(), school.getName()),
                RefSummary.of(item.getCatalog()),
                item.getCatalog().getOwnerSchool() != null,
                Stream.concat(Stream.ofNullable(item.getCatalog().getSubject()),
                        item.getCatalog().getExtraSubjects().stream()).map(RefSummary::of).toList(),
                item.getCatalog().getTrackingType().name(),
                item.getPhysicalOrDigital(),
                item.getAssetCategory(), item.getSerialNumber(), item.getModel(), item.getManufacturer(),
                RefSummary.of(unit),
                unit == null ? null : unit.isAllowsFraction(),
                item.getQuantity(), RefSummary.of(item.getOriginSource()),
                RefSummary.of(item.getAcquisitionMethod()), item.getFundingSource(),
                item.getOriginNote(), item.getFundingNote(), item.getAcquisitionNote(),
                item.getProductionYear(), item.getUsageStartYear(), item.getReceivedDate(),
                item.getPurchaseDate(), item.getOriginalValue(),
                item.getWarrantyExpiry(), item.getExpiryDate(), RefSummary.of(item.getRoom()),
                RefSummary.of(item.getManager()), item.getCondition(), item.getStatus(),
                RefSummary.of(item.getConfig()), item.getSpecs(),
                intakeOf(item), documentOf(item), item.isProfileComplete(), item.missingProfile(), item.getLegacyCode(),
                item.getCreatedAt(), item.getUpdatedAt(),
                rowLevel == null ? Map.of() : rowLevel.capabilities(item));
    }

    /** Chứng từ của dòng phiếu nhập; {@code lineId} để đọc tệp hoá đơn gắn theo dòng. */
    /** {@code documentId}: hoá đơn của phiếu (254) — tệp hoá đơn gắn vào đó; phiếu trước 254 còn tệp theo {@code lineId}. */
    public record IntakeDocument(Long lineId, String supplier, String documentNo, LocalDate documentDate, Long documentId) {
    }

    private static IntakeDocument documentOf(Equipment item) {
        EquipmentIntakeLine line = item.getIntakeLine();
        if (line == null || line.getIntake() == null) {
            return null;
        }
        return new IntakeDocument(line.getId(), line.effectiveSupplier(), line.effectiveDocumentNo(),
                line.effectiveDocumentDate(), line.documentId());
    }

    /**
     * Phiếu nhập rút gọn, lấy qua dòng phiếu. Tên là số chứng từ của đợt nhập
     * nên ô này đọc được mà không phải gọi thêm một request nữa.
     */
    private static RefSummary intakeOf(Equipment item) {
        EquipmentIntakeLine line = item.getIntakeLine();
        if (line == null || line.getIntake() == null) {
            return null;
        }
        EquipmentIntake intake = line.getIntake();
        return new RefSummary(intake.getId(), intake.getCode(),
                intake.getCode() == null ? "Phiếu ghi tăng nháp" : intake.getCode());
    }
}
