package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.voucher.VoucherForms;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Hình dạng trên đường truyền của một phiếu nhập, kèm các dòng của nó. */
public record EquipmentIntakeResponse(
        Long id,
        String code,
        RefSummary school,
        LocalDate intakeDate,
        String documentNo,
        LocalDate documentDate,
        String supplier,
        FundingSource fundingSource,
        RefSummary originSource,
        String originNote,
        RefSummary schoolYear,
        /** Phiếu nghiệp vụ đã sinh ra phiếu này; null = lập tay. */
        Source source,
        RefSummary acquisitionMethod,
        Integer warrantyMonths,
        String note,
        VoucherStatus status,
        ApprovalStep approvalStep,
        Instant submittedAt,
        Instant confirmedAt,
        String cancelReason,
        String returnNote,
        String rejectReason,
        List<Line> lines,
        /** Tổng của phiếu, tính ở server để mọi màn hình nói cùng một con số. */
        Integer lineCount,
        Integer totalReceived,
        BigDecimal totalAmount,
        Integer generatedCount,
        Instant createdAt,
        Instant updatedAt,
        /** Người lập phiếu — {@code code} là tên đăng nhập, {@code name} là họ tên; null nếu tài khoản đã bị xoá. */
        RefSummary createdBy,
        Map<String, Object> details,
        @JsonProperty("_can") Map<String, Boolean> can,
        @JsonProperty("_actions") Set<String> actions) {

    /** Phiếu nguồn: {@code resource} là tên tài nguyên (đường dẫn màn chi tiết suy ra từ nó). */
    public record Source(String resource, Long id, String code) {
    }

    /**
     * Một dòng phiếu.
     *
     * <p>{@code trackingType} là của NHÓM THIẾT BỊ chứ không phải của dòng, và
     * nó đi kèm vì màn hình phải nói trước dòng này sẽ sinh ra 50 hồ sơ tài sản
     * hay chỉ cộng 50 vào tồn kho. Hỏi lại danh mục cho từng dòng để biết điều
     * đó là một vòng request cho một chữ.
     */
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
            Map<String, Object> details,
            // Khai riêng của dòng (null = theo đầu phiếu) — để màn hình phân biệt được đâu là
            // giá trị riêng, đâu là mặc định.
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
            String otherInfo,
            LocalDate expiryDate,
            // Quy cách bao bì (QLTB-501) và số lượng vào sổ sau quy đổi, theo đơn vị của thiết bị.
            RefSummary packUnit,
            BigDecimal packSize,
            BigDecimal stockQuantity,
            // Số serial khai lúc nhận hàng (thiết bị từng cái), theo thứ tự cấp cho thiết bị sinh ra.
            List<String> serialNumbers,
            // Phòng nhận riêng của từng cái theo vị trí; null = theo phòng nhận của dòng.
            List<Long> unitRoomIds,
            List<String> unitModels,
            List<String> unitManufacturers,
            List<Integer> unitWarrantyMonths,
            List<String> unitOtherInfos) {

        static Line from(EquipmentIntakeLine line) {
            BigDecimal price = line.getUnitPrice();
            return new Line(
                    line.getId(),
                    line.getLineNo(),
                    RefSummary.of(line.getCatalog()),
                    line.getName(),
                    line.getCatalog().getTrackingType(),
                    RefSummary.of(line.getCatalog().getUnit()),
                    line.getPhysicalOrDigital(),
                    line.getAssetCategory(),
                    line.getDocumentQuantity(),
                    line.getReceivedQuantity(),
                    line.getVarianceReason(),
                    price,
                    price == null ? null : price.multiply(BigDecimal.valueOf(line.getReceivedQuantity())),
                    RefSummary.of(line.getRoom()),
                    line.getGeneratedCount(),
                    VoucherForms.read(line.getDetails()),
                    line.getSupplier(),
                    line.getDocumentNo(),
                    line.getDocumentDate(),
                    line.getFundingSource(),
                    line.getFundingNote(),
                    RefSummary.of(line.getAcquisitionMethod()),
                    line.getAcquisitionNote(),
                    line.getWarrantyMonths(),
                    line.getModel(),
                    line.getManufacturer(),
                    line.getOtherInfo(),
                    line.getExpiryDate(),
                    RefSummary.of(line.getPackUnit()),
                    line.getPackSize(),
                    line.stockQuantity(),
                    line.serialSlots(),
                    line.unitRoomSlots(),
                    line.unitModels(),
                    line.unitManufacturers(),
                    line.unitWarrantyMonths(),
                    line.unitOtherInfos());
        }
    }

    public static EquipmentIntakeResponse from(EquipmentIntake item, Map<String, Boolean> can, Set<String> actions,
            RefSummary createdBy) {
        School school = item.getSchool();
        List<Line> lines = item.getLines().stream().map(Line::from).toList();

        int totalReceived = lines.stream().mapToInt(Line::receivedQuantity).sum();
        int generated = lines.stream().mapToInt(Line::generatedCount).sum();
        BigDecimal totalAmount = lines.stream()
                .map(Line::amount)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new EquipmentIntakeResponse(
                item.getId(), item.getCode(),
                new RefSummary(school.getId(), school.getCode(), school.getName()),
                item.getIntakeDate(), item.getDocumentNo(), item.getDocumentDate(),
                item.getSupplier(), item.getFundingSource(),
                RefSummary.of(item.getOriginSource()), item.getOriginNote(),
                RefSummary.of(item.getSchoolYear()),
                item.getSourceResource() == null ? null
                        : new Source(item.getSourceResource(), item.getSourceId(), item.getSourceCode()),
                RefSummary.of(item.getAcquisitionMethod()),
                item.getWarrantyMonths(), item.getNote(), item.getStatus(), item.getApprovalStep(),
                item.getSubmittedAt(), item.getCompletedAt(), item.getCancelReason(),
                item.getReturnNote(), item.getRejectReason(),
                lines, lines.size(), totalReceived, totalAmount, generated,
                item.getCreatedAt(), item.getUpdatedAt(), createdBy,
                VoucherForms.read(item.getDetails()),
                can, actions);
    }
}
