package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.module.school.procurement.ProcurementPlanService.CatalogTotal;
import com.g123.sfems.module.school.procurement.ProcurementPlanService.Detail;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.office.XlsxWriter.Column;
import com.g123.sfems.shared.office.XlsxWriter.Sheet;
import com.g123.sfems.shared.office.XlsxWriter.Tab;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Tệp Excel của MỘT kế hoạch mua sắm: trang chi tiết theo dòng đề xuất (trường, thiết bị, số đề nghị, số đưa
 * vào kế hoạch, đơn giá, thành tiền) và trang tổng hợp theo thiết bị. Cùng số với màn hình, vì cùng đọc
 * {@link ProcurementPlanService#detail}: thành tiền tính theo số đưa vào kế hoạch.
 */
final class ProcurementPlanExcel {

    private static final Locale VI = Locale.forLanguageTag("vi-VN");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Map<ProcurementPlan.Status, String> STATUS = Map.of(
            ProcurementPlan.Status.DRAFT, "Nháp",
            ProcurementPlan.Status.PENDING, "Chờ duyệt",
            ProcurementPlan.Status.APPROVED, "Đã duyệt");

    private ProcurementPlanExcel() {
    }

    static byte[] write(Detail detail) {
        ProcurementPlan plan = detail.plan();
        String title = "Kế hoạch mua sắm " + (plan.getCode() == null ? "" : plan.getCode() + " — ")
                + (plan.getTitle() == null ? "" : plan.getTitle());
        List<String> facts = new ArrayList<>();
        facts.add(plan.getManagingBody().getName());
        if (plan.getSchoolYear() != null) {
            facts.add("Năm học " + plan.getSchoolYear().getName());
        }
        if (plan.getBudgetYear() != null) {
            facts.add("Năm ngân sách " + plan.getBudgetYear());
        }
        if (plan.getPlanDate() != null) {
            facts.add("Ngày lập " + plan.getPlanDate().format(DAY));
        }
        facts.add(STATUS.get(plan.getStatus()));
        facts.add(detail.proposals().size() + " đề xuất");
        facts.add("Tổng " + NumberFormat.getIntegerInstance(VI)
                .format(detail.totalAmount() == null ? BigDecimal.ZERO : detail.totalAmount()) + " đ");
        String subtitle = String.join(" · ", facts);
        return XlsxWriter.writeAll(List.of(
                new Tab("Chi tiết", new Sheet(title, subtitle, lineColumns(), lineRows(detail))),
                new Tab("Tổng hợp theo thiết bị", new Sheet(title, subtitle, totalColumns(), totalRows(detail)))));
    }

    private static List<Column> lineColumns() {
        return List.of(
                new Column("proposal", "Số đề xuất", "text"),
                new Column("school", "Trường", "text"),
                new Column("catalog_code", "Mã DM thiết bị", "text"),
                new Column("name", "Thiết bị", "text"),
                new Column("unit", "Đơn vị tính", "text"),
                new Column("requested", "Số đề nghị", "number"),
                new Column("planned", "Số đưa vào kế hoạch", "number"),
                new Column("unit_price", "Đơn giá (đ)", "money"),
                new Column("amount", "Thành tiền (đ)", "money"));
    }

    private static List<Map<String, Object>> lineRows(Detail detail) {
        List<Map<String, Object>> rows = new ArrayList<>();
        int requested = 0;
        int planned = 0;
        for (PurchaseProposal p : detail.proposals()) {
            for (PurchaseProposalLine l : p.getLines()) {
                int asked = l.getQuantity() == null ? 0 : l.getQuantity();
                int kept = l.effectiveQuantity();
                requested += asked;
                planned += kept;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("proposal", p.getCode());
                row.put("school", p.getSchool() == null ? null : p.getSchool().getName());
                row.put("catalog_code", l.getCatalog() == null ? null : l.getCatalog().getCode());
                row.put("name", l.getName() != null ? l.getName()
                        : l.getCatalog() == null ? null : l.getCatalog().getName());
                row.put("unit", l.getUnitName());
                row.put("requested", asked);
                row.put("planned", kept);
                row.put("unit_price", l.effectiveUnitPrice());
                row.put("amount", l.plannedAmount());
                rows.add(row);
            }
        }
        rows.add(totalRow("proposal", requested, planned, detail.totalAmount()));
        return rows;
    }

    private static List<Column> totalColumns() {
        return List.of(
                new Column("catalog_code", "Mã DM thiết bị", "text"),
                new Column("name", "Thiết bị", "text"),
                new Column("unit", "Đơn vị tính", "text"),
                new Column("schools", "Số trường", "number"),
                new Column("planned", "Số đưa vào kế hoạch", "number"),
                new Column("amount", "Thành tiền (đ)", "money"));
    }

    private static List<Map<String, Object>> totalRows(Detail detail) {
        List<Map<String, Object>> rows = new ArrayList<>();
        int planned = 0;
        for (CatalogTotal t : detail.totals()) {
            planned += t.quantity();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("catalog_code", t.catalogCode());
            row.put("name", t.catalogName());
            row.put("unit", t.unitName());
            row.put("schools", t.schools());
            row.put("planned", t.quantity());
            row.put("amount", t.amount());
            rows.add(row);
        }
        rows.add(totalRow("catalog_code", null, planned, detail.totalAmount()));
        return rows;
    }

    private static Map<String, Object> totalRow(String labelKey, Integer requested, int planned, BigDecimal amount) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put(labelKey, "Tổng cộng");
        if (requested != null) {
            row.put("requested", requested);
        }
        row.put("planned", planned);
        row.put("amount", amount);
        return row;
    }
}
