package com.g123.sfems.module.school.inventory;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventoryLine.Discrepancy;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.inventory.InventorySurplus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.voucher.VoucherHeader;
import com.g123.sfems.module.school.voucher.VoucherRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Payload và DTO của phiếu kiểm kê (KK-03 – KK-07). */
public final class InventorySessionApi {

    private InventorySessionApi() {
    }

    /** Lập phiếu: đầu phiếu và phạm vi; các dòng là ảnh chụp sổ tài sản, máy chủ tự dựng. */
    public record Request(
            IdRef school,
            IdRef campaign,
            @NotBlank(message = "Nhập tên đợt kiểm kê")
            @Size(max = 255, message = "Tên đợt kiểm kê tối đa 255 ký tự") String title,
            @NotNull(message = "Chọn ngày kiểm kê") LocalDate inventoryDate,
            IdRef room,
            @Size(max = 1000, message = "Tổ kiểm kê tối đa 1000 ký tự") String council,
            @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note) implements VoucherRequest {
    }

    /**
     * Sửa đầu phiếu và danh sách tài sản thừa. Danh sách tài sản trên sổ không sửa ở đây; {@code null} là
     * để nguyên.
     */
    public record Patch(
            IdRef school,
            @Size(max = 255, message = "Tên đợt kiểm kê tối đa 255 ký tự") String title,
            LocalDate inventoryDate,
            @Size(max = 1000, message = "Tổ kiểm kê tối đa 1000 ký tự") String council,
            @Size(max = 2000, message = "Kết luận tối đa 2000 ký tự") String conclusion,
            @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note,
            @Size(max = 1000, message = "Một phiếu tối đa 1.000 dòng") List<@Valid SurplusInput> surplus)
            implements VoucherRequest {
    }

    /** Một dòng tài sản thừa: thiết bị trong danh mục, tên thực tế (trống là tên danh mục), số lượng. */
    public record SurplusInput(
            @NotNull(message = "Chọn thiết bị trong danh mục") IdRef catalog,
            @Size(max = 255, message = "Tên tài sản thừa tối đa 255 ký tự") String name,
            @Min(value = 1, message = "Số lượng phải từ 1")
            @Max(value = 10000, message = "Số lượng tối đa 10.000") Integer quantity,
            IdRef room,
            @Size(max = 255, message = "Ghi chú tối đa 255 ký tự") String note) {
    }

    /** Ghi kết quả kiểm đếm cho một hoặc nhiều dòng. */
    public record Count(
            @NotNull(message = "Chưa có dòng kiểm đếm nào")
            @Size(max = 20000, message = "Một lần ghi tối đa 20.000 dòng kiểm đếm") List<@Valid CountLine> lines) {
    }

    /**
     * Kết quả một dòng: {@code found} là có thấy không. Thấy mà {@code foundRoom}, {@code foundCondition}
     * để trống là đúng như sổ.
     */
    public record CountLine(
            @NotNull(message = "Thiếu dòng kiểm đếm") Long lineId,
            Boolean found,
            IdRef foundRoom,
            EquipmentCondition foundCondition,
            @Size(max = 255, message = "Ghi chú tối đa 255 ký tự") String note) {
    }

    /** Số tóm tắt của biên bản: tổng dòng, đã kiểm, khớp, mất, sai phòng, hỏng, tài sản thừa. */
    public record Summary(int total, int checked, int matched, int missing, int wrongRoom, int damaged, int surplus) {

        static final Summary EMPTY = new Summary(0, 0, 0, 0, 0, 0, 0);
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

        /** Một tài sản trên sổ: sổ nói ở đâu, tình trạng gì; tổ kiểm kê thấy gì. */
        public record Line(Long id, Integer lineNo, RefSummary equipment, RefSummary catalog, RefSummary expectedRoom,
                EquipmentCondition expectedCondition, Boolean found, RefSummary foundRoom,
                EquipmentCondition foundCondition, Set<Discrepancy> discrepancies, String note) {

            static Line from(InventoryLine line) {
                return new Line(line.getId(), line.getLineNo(), RefSummary.of(line.getEquipment()),
                        RefSummary.of(line.getEquipment().getCatalog()), RefSummary.of(line.getExpectedRoom()),
                        line.getExpectedCondition(), line.getFound(), RefSummary.of(line.getFoundRoom()),
                        line.getFoundCondition(), line.discrepancies(), line.getNote());
            }
        }

        /** Tài sản thấy khi kiểm kê mà sổ không có. */
        public record Surplus(Long id, Integer lineNo, RefSummary catalog, String name, Integer quantity,
                RefSummary room, String note) {

            static Surplus from(InventorySurplus surplus) {
                return new Surplus(surplus.getId(), surplus.getLineNo(), RefSummary.of(surplus.getCatalog()),
                        surplus.getName(), surplus.getQuantity(), RefSummary.of(surplus.getRoom()), surplus.getNote());
            }
        }

        /**
         * Dòng của DANH SÁCH: số tóm tắt đếm sẵn bằng SQL, không nạp dòng nào — một biên bản kiểm kê cả trường
         * có một dòng cho mỗi tài sản.
         */
        public static Response listRow(InventorySession session, Map<String, Boolean> can, Set<String> actions,
                Summary summary) {
            Summary counts = summary == null ? Summary.EMPTY : summary;
            return new Response(VoucherHeader.of(session, can, actions), campaignOf(session), session.getTitle(),
                    session.getInventoryDate(), RefSummary.of(session.getRoom()), session.getCouncil(),
                    session.getConclusion(), counts, List.of(), List.of(), counts.total());
        }

        public static Response from(InventorySession session, Map<String, Boolean> can, Set<String> actions) {
            List<Line> lines = session.getLines().stream().map(Line::from).toList();
            int checked = (int) lines.stream().filter(l -> l.found() != null).count();
            int missing = count(lines, Discrepancy.MISSING);
            int wrongRoom = count(lines, Discrepancy.WRONG_ROOM);
            int damaged = count(lines, Discrepancy.DAMAGED);
            int matched = (int) lines.stream().filter(l -> l.found() != null && l.discrepancies().isEmpty()).count();
            int surplus = session.getSurplus().stream().mapToInt(InventorySurplus::getQuantity).sum();
            return new Response(VoucherHeader.of(session, can, actions), campaignOf(session), session.getTitle(),
                    session.getInventoryDate(), RefSummary.of(session.getRoom()), session.getCouncil(),
                    session.getConclusion(),
                    new Summary(lines.size(), checked, matched, missing, wrongRoom, damaged, surplus), lines,
                    session.getSurplus().stream().map(Surplus::from).toList(), lines.size());
        }

        private static int count(List<Line> lines, Discrepancy kind) {
            return (int) lines.stream().filter(l -> l.discrepancies().contains(kind)).count();
        }

        private static RefSummary campaignOf(InventorySession session) {
            var campaign = session.getCampaign();
            return campaign == null ? null : new RefSummary(campaign.getId(), null, campaign.getTitle());
        }
    }
}
