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
import java.time.Instant;
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
        int generatedCount,
        /** Biên bản giao nhận theo khoá của màn hình — cùng dữ liệu với các trường rời ở trên. */
        Map<String, Object> details,
        /** Người lập phiếu: {@code code} là tên đăng nhập, {@code name} là họ tên. */
        RefSummary createdBy,
        /** Lúc ghi tăng (phiếu hoàn tất). */
        Instant confirmedAt,
        /** Phiếu nghiệp vụ đã sinh ra phiếu này; {@code null} là phiếu lập tay. */
        Source source) {

    /** Phiếu nguồn: đề xuất mua sắm, biên bản kiểm kê thừa. */
    public record Source(String resource, Long id, String code) {
    }

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
            RefSummary movementReason,
            LocalDate expiryDate,
            RefSummary packUnit,
            BigDecimal packSize,
            /** Số lượng vào sổ sau quy đổi bao bì, theo đơn vị của thiết bị. */
            BigDecimal stockQuantity) {

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
                    RefSummary.of(line.getMovementReason()),
                    line.getExpiryDate(), RefSummary.of(line.getPackUnit()), line.getPackSize(),
                    line.stockQuantity());
        }
    }

    public static EquipmentIntakeResponse from(EquipmentIntake item, Map<String, Boolean> can, Set<String> actions,
            RefSummary createdBy) {
        return build(item, can, actions, true, createdBy);
    }

    private static EquipmentIntakeResponse build(EquipmentIntake item, Map<String, Boolean> can, Set<String> actions,
            boolean withLines, RefSummary createdBy) {
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
                lines.stream().mapToInt(l -> l.getGeneratedCount() == null ? 0 : l.getGeneratedCount()).sum(),
                EquipmentIntakeService.details(item), createdBy, item.getCompletedAt(),
                item.getSourceResource() == null ? null
                        : new Source(item.getSourceResource(), item.getSourceId(), item.getSourceCode()));
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
