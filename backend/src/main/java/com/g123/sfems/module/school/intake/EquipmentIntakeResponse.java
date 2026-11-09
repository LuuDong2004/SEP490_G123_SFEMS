package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntake.InspectionResult;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.voucher.VoucherHeader;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Hình dạng trên đường truyền của một phiếu nhập. Phần chung của mọi phiếu (số, trạng thái, bước duyệt,
 * {@code _can}, {@code _actions}) nằm phẳng nhờ {@link VoucherHeader}; tổng của phiếu tính ở server để
 * mọi màn hình nói cùng một con số.
 *
 * <p>{@code lines} là {@code null} ở DANH SÁCH: bảng chỉ cần các con số tổng.
 */
public record EquipmentIntakeResponse(
        @JsonUnwrapped VoucherHeader header,
        LocalDate intakeDate,
        String documentNo,
        LocalDate documentDate,
        String supplier,
        FundingSource fundingSource,
        RefSummary originSource,
        String originNote,
        RefSummary acquisitionMethod,
        RefSummary schoolYear,
        Integer warrantyMonths,
        String deliverer,
        String delivererRepresentative,
        String receiver,
        String receiverPosition,
        String storekeeper,
        InspectionResult inspectionResult,
        String handoverNo,
        List<Line> lines,
        int lineCount,
        int totalReceived,
        BigDecimal totalAmount,
        /** Số hồ sơ tài sản sẽ sinh khi duyệt: từng cái thì mỗi cái một hồ sơ, theo lô thì một hồ sơ một dòng. */
        int expectedAssets,
        /** Số hồ sơ đã sinh (phiếu hoàn tất). */
        int generatedCount) {

    /** Một dòng phiếu. {@code trackingType} và {@code unit} là của nhóm thiết bị, đi kèm để màn hình khỏi hỏi lại. */
    public record Line(
            Long id,
            Integer lineNo,
            RefSummary catalog,
            String name,
            TrackingType trackingType,
            RefSummary unit,
            PhysicalDigitalType physicalOrDigital,
            AssetCategory assetCategory,
            Integer documentQuantity,
            Integer receivedQuantity,
            String varianceReason,
            BigDecimal unitPrice,
            BigDecimal amount,
            RefSummary room,
            Integer generatedCount,
            String supplier,
            String documentNo,
            LocalDate documentDate,
            FundingSource fundingSource,
            String fundingNote,
            RefSummary acquisitionMethod,
            String acquisitionNote,
            Integer warrantyMonths,
            String model,
            String manufacturer,
            String note,
            RefSummary movementReason) {

        static Line from(EquipmentIntakeLine line) {
            BigDecimal price = line.getUnitPrice();
            return new Line(
                    line.getId(), line.getLineNo(),
                    RefSummary.of(line.getCatalog()), line.getName(),
                    line.getCatalog().getTrackingType(), RefSummary.of(line.getCatalog().getUnit()),
                    line.getPhysicalOrDigital(), line.getAssetCategory(),
                    line.getDocumentQuantity(), line.getReceivedQuantity(), line.getVarianceReason(),
                    price, EquipmentIntakeResponse.amount(line),
                    RefSummary.of(line.getRoom()), line.getGeneratedCount(),
                    line.getSupplier(), line.getDocumentNo(), line.getDocumentDate(),
                    line.getFundingSource(), line.getFundingNote(),
                    RefSummary.of(line.getAcquisitionMethod()), line.getAcquisitionNote(),
                    line.getWarrantyMonths(), line.getModel(), line.getManufacturer(), line.getNote(),
                    RefSummary.of(line.getMovementReason()));
        }
    }

    public static EquipmentIntakeResponse from(EquipmentIntake item, Map<String, Boolean> can, Set<String> actions) {
        return build(item, can, actions, true);
    }

    /** Bản gọn cho một dòng danh sách: không kèm mảng dòng. */
    public static EquipmentIntakeResponse summary(EquipmentIntake item, Map<String, Boolean> can, Set<String> actions) {
        return build(item, can, actions, false);
    }

    private static EquipmentIntakeResponse build(EquipmentIntake item, Map<String, Boolean> can, Set<String> actions,
            boolean withLines) {
        List<EquipmentIntakeLine> lines = item.getLines();
        int received = lines.stream().mapToInt(l -> l.getReceivedQuantity() == null ? 0 : l.getReceivedQuantity()).sum();
        BigDecimal total = lines.stream().map(EquipmentIntakeResponse::amount)
                .filter(a -> a != null).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new EquipmentIntakeResponse(
                VoucherHeader.of(item, can, actions),
                item.getIntakeDate(), item.getDocumentNo(), item.getDocumentDate(),
                item.getSupplier(), item.getFundingSource(),
                RefSummary.of(item.getOriginSource()), item.getOriginNote(),
                RefSummary.of(item.getAcquisitionMethod()), RefSummary.of(item.getSchoolYear()),
                item.getWarrantyMonths(),
                item.getDeliverer(), item.getDelivererRepresentative(), item.getReceiver(), item.getReceiverPosition(),
                item.getStorekeeper(), item.getInspectionResult(), item.getHandoverNo(),
                withLines ? lines.stream().map(Line::from).toList() : null,
                lines.size(), received, total,
                lines.stream().mapToInt(EquipmentIntakeResponse::expectedAssets).sum(),
                lines.stream().mapToInt(l -> l.getGeneratedCount() == null ? 0 : l.getGeneratedCount()).sum());
    }

    /** Số hồ sơ một dòng sẽ sinh khi duyệt — cùng phép với phần ghi tăng của service. */
    static int expectedAssets(EquipmentIntakeLine line) {
        int received = line.getReceivedQuantity() == null ? 0 : line.getReceivedQuantity();
        if (received == 0) {
            return 0;
        }
        return line.getCatalog().getTrackingType() == TrackingType.BULK ? 1 : received;
    }

    private static BigDecimal amount(EquipmentIntakeLine line) {
        if (line.getUnitPrice() == null || line.getReceivedQuantity() == null) {
            return null;
        }
        return line.getUnitPrice().multiply(BigDecimal.valueOf(line.getReceivedQuantity()));
    }
}
