package com.g123.sfems.module.report;

import com.g123.sfems.module.report.ReportService.Column;
import com.g123.sfems.module.report.ReportService.Definition;
import com.g123.sfems.module.report.ReportService.Dim;
import com.g123.sfems.module.report.ReportService.Group;
import com.g123.sfems.module.report.ReportService.Params;
import com.g123.sfems.module.report.ReportService.Report;
import com.g123.sfems.module.school.equipment.EquipmentSummaryService;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Báo cáo về VẬT TƯ, HOÁ CHẤT (thiết bị quản lý theo số lượng — {@code tracking_type = 'BULK'}): tiêu hao trong kỳ
 * và lô hết hạn / sắp hết hạn. Tách khỏi {@link ReportService} như {@link AnalysisReports}: cùng hình báo cáo, cùng
 * phạm vi ({@link ReportService#scope}), không phải bean.
 */
final class SupplyReports {

    static final Definition CONSUMPTION = new Definition("supply-consumption", "Tiêu hao vật tư",
            "Vật tư, hoá chất đã dùng trong kỳ theo phiếu ghi tiêu hao (và phiếu xuất kho cũ): số lượng và giá trị, "
                    + "theo thiết bị, đơn vị, địa bàn, cấp học hoặc loại thiết bị.",
            true, false, List.of(new Group("catalog", "Theo thiết bị"), new Group("school", "Theo đơn vị"),
                    new Group("body", "Theo địa bàn (cơ quan quản lý)"), new Group("level", "Theo cấp học"),
                    new Group("type", "Theo loại thiết bị")));

    static final Definition EXPIRY = new Definition("supply-expiry", "Hoá chất, vật tư hết hạn",
            "Lô vật tư, hoá chất còn trong hệ thống đã quá hạn sử dụng hoặc hết hạn trong "
                    + EquipmentSummaryService.EXPIRY_WARNING_DAYS + " ngày tới: còn bao nhiêu, ở đâu, hạn ngày nào.",
            false, false, List.of(), List.of(new Group("all", "Đã hết hạn và sắp hết hạn"),
                    new Group("expired", "Đã hết hạn"), new Group("soon", "Sắp hết hạn")));

    /** Phiếu đã có hiệu lực — lúc duyệt (hoặc trình, khi không cần duyệt) mới trừ số lượng của lô. */
    private static final String DONE = " ('APPROVED', 'COMPLETED') ";

    private final JdbcTemplate jdbc;
    private final ReportService reports;

    SupplyReports(JdbcTemplate jdbc, ReportService reports) {
        this.jdbc = jdbc;
        this.reports = reports;
    }

    /**
     * Tiêu hao trong kỳ: mỗi phiếu ghi tiêu hao một dòng, mỗi dòng phiếu xuất kho một dòng. Giá trị = số lượng ×
     * đơn giá của một đơn vị tính: lấy của đúng lô ghi trên phiếu (đơn giá dòng phiếu ghi tăng ÷ quy cách), phiếu
     * không ghi lô thì đơn giá bình quân của thiết bị đó ở trường đó; xuất kho có đơn giá trên dòng thì dùng nó.
     * Không tìm được đơn giá nào thì dòng vẫn được đếm số lượng, cột "Chưa có đơn giá" đếm nó.
     */
    Report consumption(Params p, String group, LocalDate from, LocalDate to, String period) {
        String sql = "WITH cost AS (SELECT ce.school_id, ce.catalog_id,"
                + " SUM(cl.unit_price * cl.received_quantity) / NULLIF(SUM(cl.received_quantity * COALESCE(cl.pack_size, 1)), 0) AS unit_cost"
                + " FROM equipment ce JOIN equipment_intake_lines cl ON cl.id = ce.intake_line_id"
                + " WHERE cl.unit_price IS NOT NULL GROUP BY ce.school_id, ce.catalog_id),"
                // room_id: phòng của phiếu (không thì của lô) — cho bộ lọc cơ sở; trống = cơ sở chính.
                + " x AS (SELECT cr.school_id, COALESCE(cr.room_id, le.room_id) AS room_id, cr.catalog_id,"
                + " cr.quantity AS consumed, 0::numeric AS issued,"
                + " cr.quantity * COALESCE(li.unit_price / NULLIF(COALESCE(li.pack_size, 1), 0), cost.unit_cost) AS value"
                + " FROM consumption_records cr"
                + " LEFT JOIN equipment le ON le.id = cr.equipment_id"
                + " LEFT JOIN equipment_intake_lines li ON li.id = le.intake_line_id"
                + " LEFT JOIN cost ON cost.school_id = cr.school_id AND cost.catalog_id = cr.catalog_id"
                + " WHERE cr.status IN" + DONE + " AND cr.consumed_date BETWEEN ?::date AND ?::date"
                + " UNION ALL SELECT si.school_id, sl.room_id, sl.catalog_id, 0::numeric, sl.quantity,"
                + " sl.quantity * COALESCE(sl.unit_value, cost.unit_cost)"
                + " FROM stock_issue_lines sl JOIN stock_issues si ON si.id = sl.issue_id"
                + " LEFT JOIN cost ON cost.school_id = si.school_id AND cost.catalog_id = sl.catalog_id"
                + " WHERE si.status IN" + DONE + " AND si.issue_date BETWEEN ?::date AND ?::date) ";
        String aggregates = " COUNT(DISTINCT e.school_id) AS schools, COUNT(*) AS entries,"
                + " ROUND(COALESCE(SUM(e.value), 0), 0) AS value, COUNT(*) FILTER (WHERE e.value IS NULL) AS unvalued";
        String where = " WHERE TRUE" + reports.assets("e", p);
        List<Map<String, Object>> rows;
        List<Column> columns = new ArrayList<>();
        if ("catalog".equals(group)) {
            // Nhiều trường: thiết bị ngoài danh mục (mỗi trường một tên) gộp thành MỘT dòng "Khác" — và số lượng của
            // dòng đó bỏ trống, vì cộng lít với gam là con số không đọc được.
            String other = reports.otherCatalog("c", p);
            rows = jdbc.queryForList(sql + "SELECT CASE WHEN " + other + " THEN NULL ELSE c.code END AS code,"
                    + " CASE WHEN " + other + " THEN '" + ReportService.OTHER_LABEL + "' ELSE c.name END AS name,"
                    + " CASE WHEN " + other + " THEN NULL ELSE u.name END AS unit,"
                    + " CASE WHEN bool_or(" + other + ") THEN NULL ELSE SUM(e.consumed) END AS consumed,"
                    + " CASE WHEN bool_or(" + other + ") THEN NULL ELSE SUM(e.issued) END AS issued,"
                    + " CASE WHEN bool_or(" + other + ") THEN NULL ELSE SUM(e.consumed + e.issued) END AS quantity,"
                    + aggregates
                    + " FROM x e JOIN schools s ON s.id = e.school_id"
                    + " JOIN equipment_catalogs c ON c.id = e.catalog_id LEFT JOIN units u ON u.id = c.unit_id"
                    + where + " GROUP BY CASE WHEN " + other + " THEN 0 ELSE c.id END, 1, 2, 3"
                    + " ORDER BY bool_or(" + other + "), entries DESC, name",
                    from.toString(), to.toString(), from.toString(), to.toString());
            columns.add(col("code", "Mã DM thiết bị", "text"));
            columns.add(col("name", "Thiết bị", "text"));
            columns.add(col("unit", "Đơn vị tính", "text"));
            columns.add(col("schools", "Số trường", "number"));
            columns.add(col("entries", "Số lượt", "number"));
            columns.add(col("consumed", "Ghi tiêu hao", "number"));
            if (rows.stream().anyMatch(r -> r.get("issued") instanceof Number n && n.doubleValue() != 0)) {
                columns.add(col("issued", "Xuất kho", "number"));
                columns.add(col("quantity", "Tổng số lượng", "number"));
            }
        } else {
            // Gộp theo đơn vị / địa bàn / cấp học / loại: các thiết bị khác đơn vị tính nên không cộng số lượng —
            // đếm lượt và số thiết bị.
            Dim d = ReportService.dim(group);
            rows = jdbc.queryForList(sql + "SELECT " + d.select() + ", COUNT(DISTINCT e.catalog_id) AS catalogs,"
                    + aggregates + " FROM x e JOIN schools s ON s.id = e.school_id" + d.joins()
                    + where + " GROUP BY " + d.groupBy() + " ORDER BY entries DESC, name",
                    from.toString(), to.toString(), from.toString(), to.toString());
            if (d.code() != null) {
                columns.add(col("code", "Mã trường", "text"));
            }
            columns.add(col("name", d.header(), "text"));
            if (d.code() == null) {
                columns.add(col("schools", "Số trường", "number"));
            }
            columns.add(col("catalogs", "Số thiết bị", "number"));
            columns.add(col("entries", "Số lượt", "number"));
        }
        columns.add(col("value", "Giá trị tiêu hao (đ)", "money"));
        columns.add(col("unvalued", "Chưa có đơn giá", "number"));
        String title = "catalog".equals(group) ? "Tiêu hao vật tư theo thiết bị" : "Tiêu hao vật tư " + ReportService.groupTitle(group);
        return new Report("supply-consumption", title, reports.subtitle(p, period), columns, rows);
    }

    /**
     * Lô vật tư, hoá chất còn trên sổ (còn số lượng) đã quá hạn hoặc hết hạn trong {@code EXPIRY_WARNING_DAYS} ngày
     * tới — cùng ngưỡng với bộ lọc "sắp hết hạn" của màn Thiết bị. Sắp theo hạn: cái hết trước đứng trước.
     */
    Report expiry(Params p, String choice) {
        String when = switch (choice) {
            case "expired" -> " AND e.expiry_date < CURRENT_DATE";
            case "soon" -> " AND e.expiry_date >= CURRENT_DATE";
            default -> "";
        };
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT s.name AS school, e.code, e.name, c.name AS catalog,"
                + " r.name AS room, u.name AS unit, e.quantity, e.expiry_date,"
                + " CASE WHEN e.expiry_date < CURRENT_DATE THEN 'Quá hạn ' || (CURRENT_DATE - e.expiry_date) || ' ngày'"
                + "      WHEN e.expiry_date = CURRENT_DATE THEN 'Hết hạn hôm nay'"
                + "      ELSE 'Còn ' || (e.expiry_date - CURRENT_DATE) || ' ngày' END AS state,"
                + " e.remaining_value"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
                + " JOIN equipment_catalogs c ON c.id = e.catalog_id"
                + " LEFT JOIN units u ON u.id = COALESCE(e.unit_id, c.unit_id) LEFT JOIN rooms r ON r.id = e.room_id"
                + " WHERE c.tracking_type = 'BULK' AND e.status NOT IN" + ReportService.OFF_BOOK
                + " AND e.quantity > 0 AND e.expiry_date IS NOT NULL AND e.expiry_date <= CURRENT_DATE + ?" + when
                + reports.assets("e", p)
                + " ORDER BY e.expiry_date, s.name, e.code LIMIT " + ReportService.LIST_LIMIT,
                EquipmentSummaryService.EXPIRY_WARNING_DAYS);
        String title = switch (choice) {
            case "expired" -> "Hoá chất, vật tư đã hết hạn";
            case "soon" -> "Hoá chất, vật tư sắp hết hạn";
            default -> "Hoá chất, vật tư hết hạn và sắp hết hạn";
        };
        return new Report("supply-expiry", title, reports.subtitle(p, "tính đến " + vn(LocalDate.now())),
                List.of(col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("catalog", "DM thiết bị", "text"),
                        col("room", "Chỗ để", "text"), col("unit", "Đơn vị tính", "text"),
                        col("quantity", "Số lượng còn", "number"), col("expiry_date", "Hạn sử dụng", "date"),
                        col("state", "Tình trạng hạn", "text"),
                        col("remaining_value", "Giá trị còn lại (đ)", "money")),
                rows);
    }

    private static Column col(String key, String label, String type) {
        return new Column(key, label, type);
    }

    private static String vn(LocalDate d) {
        return "%02d/%02d/%d".formatted(d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }
}
