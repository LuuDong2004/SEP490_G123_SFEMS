package com.g123.sfems.module.report;

import com.g123.sfems.module.report.ReportService.Column;
import com.g123.sfems.module.report.ReportService.Definition;
import com.g123.sfems.module.report.ReportService.Group;
import com.g123.sfems.module.report.ReportService.Params;
import com.g123.sfems.module.report.ReportService.Report;
import com.g123.sfems.module.school.equipment.EquipmentSummaryService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Báo cáo về VẬT TƯ, HOÁ CHẤT (thiết bị quản lý theo số lượng — {@code tracking_type = 'BULK'}): hết hạn và
 * sắp hết hạn sử dụng. Tách khỏi {@link ReportService} như {@link AnalysisReports}: cùng hình báo cáo, cùng
 * phạm vi ({@link ReportService#scope}), không phải bean.
 */
final class SupplyReports {

    static final Definition EXPIRY = new Definition("supply-expiry", "Hoá chất, vật tư hết hạn",
            "Vật tư, hoá chất còn trong hệ thống đã quá hạn sử dụng hoặc hết hạn trong "
                    + EquipmentSummaryService.EXPIRY_WARNING_DAYS + " ngày tới: còn bao nhiêu, ở đâu, hạn ngày nào.",
            false, false, List.of(), List.of(new Group("all", "Đã hết hạn và sắp hết hạn"),
                    new Group("expired", "Đã hết hạn"), new Group("soon", "Sắp hết hạn")));

    private final JdbcTemplate jdbc;
    private final ReportService reports;

    SupplyReports(JdbcTemplate jdbc, ReportService reports) {
        this.jdbc = jdbc;
        this.reports = reports;
    }

    /**
     * Vật tư, hoá chất còn trên sổ (còn số lượng) đã quá hạn hoặc hết hạn trong {@code EXPIRY_WARNING_DAYS} ngày
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
                + "      ELSE 'Còn ' || (e.expiry_date - CURRENT_DATE) || ' ngày' END AS state"
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
                        col("state", "Tình trạng hạn", "text")),
                rows);
    }

    private static Column col(String key, String label, String type) {
        return new Column(key, label, type);
    }

    private static String vn(LocalDate d) {
        return "%02d/%02d/%d".formatted(d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }
}
