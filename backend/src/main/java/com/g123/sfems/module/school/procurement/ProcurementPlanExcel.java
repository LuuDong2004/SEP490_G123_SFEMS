package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.catalog.norm.office.XlsxWriter;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Xuất Excel một kế hoạch mua sắm (NC-05, NC-06): hai trang — chi tiết theo dòng đề xuất và tổng hợp theo
 * thiết bị. Hai trang này đúng hai bảng trên màn chi tiết kế hoạch, để người duyệt in ra họp.
 */
final class ProcurementPlanExcel {

    private ProcurementPlanExcel() {
    }

    static byte[] write(ProcurementPlanController.Response plan) {
        List<XlsxWriter.Column> lineColumns = List.of(
                new XlsxWriter.Column("proposalCode", "Số đề xuất", "text"),
                new XlsxWriter.Column("school", "Trường", "text"),
                new XlsxWriter.Column("lineNo", "Dòng", "number"),
                new XlsxWriter.Column("catalogCode", "Mã thiết bị", "text"),
                new XlsxWriter.Column("name", "Tên thiết bị, quy cách", "text"),
                new XlsxWriter.Column("unitName", "ĐVT", "text"),
                new XlsxWriter.Column("requestedQuantity", "Trường đề nghị", "number"),
                new XlsxWriter.Column("plannedQuantity", "Đưa vào kế hoạch", "number"),
                new XlsxWriter.Column("unitPrice", "Đơn giá (đ)", "money"),
                new XlsxWriter.Column("amount", "Thành tiền (đ)", "money"),
                new XlsxWriter.Column("priority", "Ưu tiên", "number"));
        List<Map<String, Object>> lineRows = new ArrayList<>();
        for (ProcurementPlanController.PlanLine l : plan.lines() == null ? List.<ProcurementPlanController.PlanLine>of() : plan.lines()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("proposalCode", l.proposalCode());
            row.put("school", l.school() == null ? null : l.school().name());
            row.put("lineNo", l.lineNo());
            row.put("catalogCode", l.catalog() == null ? null : l.catalog().code());
            row.put("name", l.specification() == null ? l.name() : l.name() + " — " + l.specification());
            row.put("unitName", l.unitName());
            row.put("requestedQuantity", l.requestedQuantity());
            row.put("plannedQuantity", l.plannedQuantity());
            row.put("unitPrice", l.unitPrice());
            row.put("amount", l.amount());
            row.put("priority", l.priority());
            lineRows.add(row);
        }

        List<XlsxWriter.Column> totalColumns = List.of(
                new XlsxWriter.Column("catalogCode", "Mã thiết bị", "text"),
                new XlsxWriter.Column("catalogName", "Tên thiết bị", "text"),
                new XlsxWriter.Column("unitName", "ĐVT", "text"),
                new XlsxWriter.Column("quantity", "Số lượng", "number"),
                new XlsxWriter.Column("amount", "Thành tiền (đ)", "money"),
                new XlsxWriter.Column("schools", "Số trường đề nghị", "number"));
        List<Map<String, Object>> totalRows = new ArrayList<>();
        for (ProcurementPlanService.CatalogTotal t : plan.totals() == null ? List.<ProcurementPlanService.CatalogTotal>of() : plan.totals()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("catalogCode", t.catalogCode());
            row.put("catalogName", t.catalogName());
            row.put("unitName", t.unitName());
            row.put("quantity", t.quantity());
            row.put("amount", t.amount());
            row.put("schools", t.schools());
            totalRows.add(row);
        }

        BigDecimal total = plan.totalAmount() == null ? BigDecimal.ZERO : plan.totalAmount();
        String subtitle = "%s — %s. Năm ngân sách %s. %d đề xuất, %d dòng, tổng %s đ."
                .formatted(plan.code(), plan.title(),
                        plan.budgetYear() == null ? "—" : plan.budgetYear(),
                        plan.proposalCount() == null ? 0 : plan.proposalCount(),
                        lineRows.size(), new java.text.DecimalFormat("#,##0").format(total));

        return XlsxWriter.writeAll(List.of(
                new XlsxWriter.Tab("Chi tiết theo đề xuất",
                        new XlsxWriter.Sheet("Chi tiết kế hoạch mua sắm", subtitle, lineColumns, lineRows)),
                new XlsxWriter.Tab("Tổng hợp theo thiết bị",
                        new XlsxWriter.Sheet("Tổng hợp thiết bị của kế hoạch", subtitle, totalColumns, totalRows))));
    }
}
