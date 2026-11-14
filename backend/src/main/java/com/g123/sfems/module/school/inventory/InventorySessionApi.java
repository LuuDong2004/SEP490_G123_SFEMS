package com.g123.sfems.module.school.inventory;

import java.math.BigDecimal;
import com.g123.sfems.module.school.voucher.VoucherLimits;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventoryLine.Discrepancy;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.inventory.InventorySurplus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.voucher.EquipmentSummary;
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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Payload và DTO của phiếu kiểm kê. */
public final class InventorySessionApi {

    private InventorySessionApi() {
    }

    public record Request(
            IdRef school,
            IdRef campaign,
            @NotBlank(message = "Nhập tên đợt kiểm kê")
            @Text(value = FieldRule.NAME, label = "Tên đợt kiểm kê") String title,
            @NotNull(message = "Chọn ngày kiểm kê")
            @DateValue(value = DateRule.ANY, label = "Ngày kiểm kê") LocalDate inventoryDate,
            IdRef room,
            @Text(value = FieldRule.LONG_TEXT, label = "Tổ kiểm kê", max = 1000) String council,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note,
            Map<String, Object> details) implements VoucherRequest {
    }

    /** Sửa đầu phiếu và danh sách tài sản thừa. Danh sách tài sản trên sổ không sửa ở đây. */
    public record Patch(
            IdRef school,
            @Text(value = FieldRule.NAME, label = "Tên đợt kiểm kê") String title,
            @DateValue(value = DateRule.ANY, label = "Ngày kiểm kê") LocalDate inventoryDate,
            @Text(value = FieldRule.LONG_TEXT, label = "Tổ kiểm kê", max = 1000) String council,
            @Text(value = FieldRule.LONG_TEXT, label = "Kết luận", max = 2000) String conclusion,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note,
            @Size(max = VoucherLimits.MAX_LINES, message = VoucherLimits.TOO_MANY_LINES) List<@Valid SurplusInput> surplus,
            Map<String, Object> details) implements VoucherRequest {
    }

    public record SurplusInput(@NotNull IdRef catalog,
            @Text(value = FieldRule.NAME, label = "Tên thiết bị thừa") String name,
            @Num(value = NumberRule.QUANTITY, label = "Số lượng") Integer quantity,
            IdRef room,
            @Text(value = FieldRule.NOTE, label = "Ghi chú", max = 255) String note) {
    }

    /** Ghi kết quả kiểm đếm cho một hoặc nhiều dòng. */
    public record Count(@Size(max = VoucherLimits.MAX_COUNT_LINES, message = VoucherLimits.TOO_MANY_COUNT_LINES) @NotNull List<@Valid CountLine> lines) {
    }

    public record CountLine(@NotNull Long lineId, Boolean found, IdRef foundRoom, EquipmentCondition foundCondition,
            @Num(value = NumberRule.DECIMAL_QUANTITY, label = "Số lượng đếm được") BigDecimal countedQuantity,
            @Text(value = FieldRule.NOTE, label = "Ghi chú", max = 255) String note, Map<String, Object> details) {
    }

    public record Summary(int total, int checked, int matched, int missing, int wrongRoom, int damaged, int surplus) {
    }

    public record Response(
            @JsonUnwrapped VoucherHeader header,
            RefSummary campaign,
            String title,
            LocalDate inventoryDate,
            RefSummary room,
            String council,
            String conclusion,
            Summary summary,
            List<Line> lines,
            List<Surplus> surplus,
            int lineCount) {

        public record Line(Long id, Integer lineNo, EquipmentSummary equipment, RefSummary expectedRoom,
                EquipmentCondition expectedCondition, Boolean found, RefSummary foundRoom,
                EquipmentCondition foundCondition, Set<Discrepancy> discrepancies, String note,
                java.util.Map<String, Object> details, BigDecimal expectedQuantity, BigDecimal countedQuantity) {

            static Line from(InventoryLine l) {
                return new Line(l.getId(), l.getLineNo(), EquipmentSummary.of(l.getEquipment()),
                        RefSummary.of(l.getExpectedRoom()), l.getExpectedCondition(), l.getFound(),
                        RefSummary.of(l.getFoundRoom()), l.getFoundCondition(), l.discrepancies(), l.getNote(),
                    com.g123.sfems.module.school.voucher.VoucherForms.read(l.getDetails()), l.getExpectedQuantity(),
                        l.getCountedQuantity());
            }
        }

        public record Surplus(Long id, Integer lineNo, RefSummary catalog, String name, Integer quantity,
                RefSummary room, String note) {

            static Surplus from(InventorySurplus s) {
                return new Surplus(s.getId(), s.getLineNo(), RefSummary.of(s.getCatalog()), s.getName(),
                        s.getQuantity(), RefSummary.of(s.getRoom()), s.getNote());
            }
        }

        /**
         * Dòng của danh sách: số tóm tắt đếm sẵn bằng SQL ({@code InventorySessionService.summaries}), không nạp
         * dòng nào — một biên bản kiểm kê cả trường có một dòng cho mỗi tài sản.
         */
        public static Response listRow(InventorySession s, Map<String, Boolean> can, Set<String> actions,
                Summary summary) {
            var campaign = s.getCampaign();
            return new Response(VoucherHeader.of(s, can, actions),
                    campaign == null ? null : new RefSummary(campaign.getId(), null, campaign.getTitle()),
                    s.getTitle(), s.getInventoryDate(), RefSummary.of(s.getRoom()), s.getCouncil(), s.getConclusion(),
                    summary, List.of(), List.of(), summary.total());
        }

        public static Response from(InventorySession s, Map<String, Boolean> can, Set<String> actions) {
            List<Line> lines = s.getLines().stream().map(Line::from).toList();
            int checked = (int) lines.stream().filter(l -> l.found() != null).count();
            int missing = (int) lines.stream().filter(l -> l.discrepancies().contains(Discrepancy.MISSING)).count();
            int wrong = (int) lines.stream().filter(l -> l.discrepancies().contains(Discrepancy.WRONG_ROOM)).count();
            int damaged = (int) lines.stream().filter(l -> l.discrepancies().contains(Discrepancy.DAMAGED)).count();
            int matched = (int) lines.stream().filter(l -> l.found() != null && l.discrepancies().isEmpty()).count();
            int surplus = s.getSurplus().stream().mapToInt(InventorySurplus::getQuantity).sum();
            var campaign = s.getCampaign();
            return new Response(VoucherHeader.of(s, can, actions),
                    campaign == null ? null : new RefSummary(campaign.getId(), null, campaign.getTitle()),
                    s.getTitle(), s.getInventoryDate(), RefSummary.of(s.getRoom()), s.getCouncil(), s.getConclusion(),
                    new Summary(lines.size(), checked, matched, missing, wrong, damaged, surplus), lines,
                    s.getSurplus().stream().map(Surplus::from).toList(), lines.size());
        }
    }
}
