package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine.Kind;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.voucher.VoucherHeader;
import com.g123.sfems.module.school.voucher.VoucherRequest;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Payload và DTO của đề xuất mua sắm (NC-02..NC-06).
 *
 * <p>Bản gốc đặt hình này trong {@code PurchaseProposalApi}, dùng bộ kiểm tra {@code shared/validation}
 * ({@code @Text}, {@code @Num}, {@code @DateValue}) và trần dòng {@code VoucherLimits} — ba thứ repo nhóm
 * chưa có, và cả ba đều là của {@code shared/**}. Ở đây chúng được thay bằng ràng buộc Jakarta chuẩn
 * cùng giới hạn viết thẳng ra, giữ nguyên con số và câu báo lỗi của bản gốc. Khi nhóm có
 * {@code shared/validation} thì đổi lại cho khớp nguồn.
 *
 * <p>Trường {@code details} của bản gốc (JSONB, hình dạng do {@code resources/voucher-forms/*.json}
 * quyết định) bỏ khỏi payload: repo nhóm chưa có cột, và đề xuất mua sắm không dùng tới nó.
 */
public final class PurchaseProposalApi {

    /** Trần số dòng một lần gửi — con số của bản gốc ({@code VoucherLimits.MAX_LINES}). */
    public static final int MAX_LINES = 1000;
    public static final String TOO_MANY_LINES = "Một phiếu tối đa 1.000 dòng";

    private PurchaseProposalApi() {
    }

    /** Một dòng của đề xuất. */
    public record LineInput(IdRef catalog, Kind kind,
            @Size(max = 255, message = "Tên thiết bị tối đa 255 ký tự") String name,
            @Size(max = 1000, message = "Thông số kỹ thuật tối đa 1000 ký tự") String specification,
            @Size(max = 50, message = "Đơn vị tính tối đa 50 ký tự") String unitName,
            @Min(value = 1, message = "Số lượng phải từ 1 đến 10.000")
            @Max(value = 10000, message = "Số lượng phải từ 1 đến 10.000") Integer quantity,
            @jakarta.validation.constraints.DecimalMin(value = "0", message = "Đơn giá dự kiến không được âm")
            @jakarta.validation.constraints.DecimalMax(value = "100000000000",
                    message = "Đơn giá dự kiến tối đa 100.000.000.000")
            BigDecimal unitPrice,
            @Min(value = 1, message = "Mức ưu tiên phải từ 1 đến 3")
            @Max(value = 3, message = "Mức ưu tiên phải từ 1 đến 3") Integer priority,
            @Size(max = 255, message = "Ghi chú tối đa 255 ký tự") String note) {
    }

    public record Request(
            IdRef school,
            @NotNull(message = "Chọn ngày đề xuất") LocalDate proposalDate,
            @Min(value = 1950, message = "Năm ngân sách phải từ 1950 đến 2100")
            @Max(value = 2100, message = "Năm ngân sách phải từ 1950 đến 2100") Integer budgetYear,
            FundingSource fundingSource,
            @Size(max = 1000, message = "Lý do đề xuất tối đa 1000 ký tự") String reason,
            @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note,
            @Size(max = MAX_LINES, message = TOO_MANY_LINES) List<@Valid LineInput> lines) implements VoucherRequest {
    }

    public record Patch(
            IdRef school,
            LocalDate proposalDate,
            @Min(value = 1950, message = "Năm ngân sách phải từ 1950 đến 2100")
            @Max(value = 2100, message = "Năm ngân sách phải từ 1950 đến 2100") Integer budgetYear,
            FundingSource fundingSource,
            @Size(max = 1000, message = "Lý do đề xuất tối đa 1000 ký tự") String reason,
            @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note,
            @Size(max = MAX_LINES, message = TOO_MANY_LINES) List<@Valid LineInput> lines) implements VoucherRequest {
    }

    /** Kế hoạch chứa đề xuất — đủ để màn hình trỏ sang. */
    public record PlanSummary(Long id, String title, String status) {
    }

    public record Response(
            @JsonUnwrapped VoucherHeader header,
            LocalDate proposalDate,
            Integer budgetYear,
            FundingSource fundingSource,
            String reason,
            PlanSummary plan,
            Long intakeId,
            BigDecimal totalAmount,
            int totalQuantity,
            /** {@code null} ở danh sách: bảng chỉ cần các con số tổng. */
            List<Line> lines,
            int lineCount) {

        /**
         * Một dòng. {@code trackingType} và đơn vị tính đi kèm để hộp chọn thiết bị của phiếu ghi tăng
         * khỏi hỏi lại danh mục.
         */
        public record Line(Long id, Integer lineNo, Kind kind, RefSummary catalog, String trackingType,
                String name, String specification, String unitName, Integer quantity, BigDecimal unitPrice,
                BigDecimal amount, Integer priority, Integer currentQuantity, Integer requiredQuantity,
                String note) {

            static Line from(PurchaseProposalLine l) {
                var c = l.getCatalog();
                return new Line(l.getId(), l.getLineNo(), l.getKind(),
                        new RefSummary(c.getId(), c.getCode(), c.getName()), c.getTrackingType().name(),
                        l.getName(), l.getSpecification(), l.getUnitName(), l.getQuantity(), l.getUnitPrice(),
                        l.amount(), l.getPriority(), l.getCurrentQuantity(), l.getRequiredQuantity(), l.getNote());
            }
        }

        public static Response from(PurchaseProposal p, Map<String, Boolean> can, Set<String> actions) {
            return of(p, can, actions, true);
        }

        /** Bản của một dòng DANH SÁCH: không kèm mảng dòng, chỉ các con số tổng. */
        public static Response summary(PurchaseProposal p, Map<String, Boolean> can, Set<String> actions) {
            return of(p, can, actions, false);
        }

        private static Response of(PurchaseProposal p, Map<String, Boolean> can, Set<String> actions, boolean withLines) {
            List<Line> lines = withLines ? p.getLines().stream().map(Line::from).toList() : null;
            var plan = p.getPlan();
            return new Response(VoucherHeader.of(p, can, actions), p.getProposalDate(), p.getBudgetYear(),
                    p.getFundingSource(), p.getReason(),
                    plan == null ? null : new PlanSummary(plan.getId(), plan.getTitle(), plan.getStatus().name()),
                    p.getIntakeId(), p.totalAmount(),
                    p.getLines().stream().mapToInt(l -> l.getQuantity() == null ? 0 : l.getQuantity()).sum(),
                    lines, p.getLines().size());
        }
    }
}
