package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.school.voucher.VoucherLimits;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine.Kind;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.voucher.VoucherHeader;
import com.g123.sfems.module.school.voucher.VoucherRequest;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.Text;
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

/** Payload và DTO của đề xuất mua sắm. */
public final class PurchaseProposalApi {

    private PurchaseProposalApi() {
    }

    public record LineInput(IdRef catalog, Kind kind,
            @Text(value = FieldRule.NAME, label = "Tên thiết bị") String name,
            @Text(value = FieldRule.SHORT_TEXT, label = "Đơn vị tính", max = 50) String unitName,
            @Num(value = NumberRule.QUANTITY, label = "Số lượng") Integer quantity,
            @Num(value = NumberRule.MONEY, label = "Giá tham khảo") BigDecimal unitPrice,
            @Text(value = FieldRule.NOTE, label = "Ghi chú", max = 255) String note,
            Map<String, Object> details) {
    }

    public record Request(
            IdRef school,
            @NotNull(message = "Chọn ngày")
            @DateValue(value = DateRule.ANY, label = "Ngày đề xuất") LocalDate proposalDate,
            @Min(value = 2000, message = "Năm ngân sách phải từ 2000 đến 2100")
            @Max(value = 2100, message = "Năm ngân sách phải từ 2000 đến 2100") Integer budgetYear,
            @Text(value = FieldRule.LONG_TEXT, label = "Lý do đề xuất", max = 1000) String reason,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note,
            @Size(max = VoucherLimits.MAX_LINES, message = VoucherLimits.TOO_MANY_LINES) List<@Valid LineInput> lines,
            Map<String, Object> details) implements VoucherRequest {
    }

    public record Patch(
            IdRef school,
            @DateValue(value = DateRule.ANY, label = "Ngày đề xuất") LocalDate proposalDate,
            @Min(value = 2000, message = "Năm ngân sách phải từ 2000 đến 2100")
            @Max(value = 2100, message = "Năm ngân sách phải từ 2000 đến 2100") Integer budgetYear,
            @Text(value = FieldRule.LONG_TEXT, label = "Lý do đề xuất", max = 1000) String reason,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note,
            @Size(max = VoucherLimits.MAX_LINES, message = VoucherLimits.TOO_MANY_LINES) List<@Valid LineInput> lines,
            Map<String, Object> details) implements VoucherRequest {
    }

    public record PlanSummary(Long id, String title, String status) {
    }

    public record Response(
            @JsonUnwrapped VoucherHeader header,
            LocalDate proposalDate,
            Integer budgetYear,
            String reason,
            PlanSummary plan,
            Long intakeId,
            BigDecimal totalAmount,
            int totalQuantity,
            List<Line> lines,
            int lineCount) {

        public record Line(Long id, Integer lineNo, Kind kind, RefSummary catalog, String trackingType,
                String name, String unitName, Integer quantity, BigDecimal unitPrice,
                BigDecimal amount, Integer currentQuantity, Integer requiredQuantity,
                String note,
                java.util.Map<String, Object> details) {

            static Line from(PurchaseProposalLine l) {
                var c = l.getCatalog();
                return new Line(l.getId(), l.getLineNo(), l.getKind(),
                        new RefSummary(c.getId(), c.getCode(), c.getName()), c.getTrackingType().name(),
                        l.getName(), l.getUnitName(), l.getQuantity(), l.effectiveUnitPrice(),
                        l.amount(), l.getCurrentQuantity(), l.getRequiredQuantity(), l.getNote(),
                    com.g123.sfems.module.school.voucher.VoucherForms.read(l.getDetails()));
            }
        }

        public static Response from(PurchaseProposal p, Map<String, Boolean> can, Set<String> actions) {
            List<Line> lines = p.getLines().stream().map(Line::from).toList();
            var plan = p.getPlan();
            return new Response(VoucherHeader.of(p, can, actions), p.getProposalDate(), p.getBudgetYear(),
                    p.getReason(),
                    plan == null ? null : new PlanSummary(plan.getId(), plan.getTitle(), plan.getStatus().name()),
                    p.getIntakeId(), p.totalAmount(),
                    lines.stream().mapToInt(l -> l.quantity() == null ? 0 : l.quantity()).sum(), lines,
                    lines.size());
        }
    }
}
