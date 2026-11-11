package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** BC-05: kết quả và chênh lệch của các phiên kiểm kê trong phạm vi trường được phép xem. */
@Service
public class InventoryReportService {
    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public InventoryReportService(JdbcTemplate jdbc, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.visible = visible;
    }

    @Transactional(readOnly = true)
    public InventoryReportResponse get(Long campaignId, Long schoolId) {
        String scope = visible.level();
        String where = " WHERE i.status NOT IN ('CANCELLED', 'REJECTED') " + visible.sqlFilter("i.school_id");
        List<Object> args = new ArrayList<>();
        if (campaignId != null) {
            where += " AND i.campaign_id = ?";
            args.add(campaignId);
        }
        if (schoolId != null) {
            where += " AND i.school_id = ?";
            args.add(schoolId);
        }

        List<InventoryReportResponse.Row> rows = jdbc.query("""
                SELECT i.id, COALESCE(i.code, 'KK-' || i.id), COALESCE(c.title, 'Kiểm kê ngoài đợt'), s.name,
                       i.inventory_date, i.status,
                       CASE i.status WHEN 'DRAFT' THEN 'Nháp' WHEN 'PENDING' THEN 'Chờ duyệt'
                            WHEN 'APPROVED' THEN 'Đã duyệt' WHEN 'COMPLETED' THEN 'Hoàn tất' ELSE i.status END,
                       COALESCE(SUM(e.quantity), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE l.found IS TRUE
                           AND l.expected_room_id IS NOT DISTINCT FROM l.found_room_id
                           AND (l.found_condition IS NULL OR l.expected_condition IS NOT DISTINCT FROM l.found_condition)), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE l.found IS FALSE), 0),
                       COALESCE(surplus.quantity, 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE l.found IS TRUE AND l.found_condition = 'HONG'), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE l.found IS TRUE
                           AND l.expected_room_id IS DISTINCT FROM l.found_room_id), 0),
                       COALESCE(SUM(e.quantity * COALESCE(e.original_value, 0)) FILTER (WHERE l.found IS FALSE), 0)
                FROM inventory_sessions i
                JOIN schools s ON s.id = i.school_id
                LEFT JOIN inventory_campaigns c ON c.id = i.campaign_id
                LEFT JOIN inventory_lines l ON l.session_id = i.id
                LEFT JOIN equipment e ON e.id = l.equipment_id
                LEFT JOIN LATERAL (SELECT SUM(x.quantity) AS quantity FROM inventory_surplus x
                                   WHERE x.session_id = i.id) surplus ON TRUE
                """ + where + " GROUP BY i.id, s.name, c.title, surplus.quantity "
                        + "ORDER BY i.inventory_date DESC, s.name, i.code",
                (rs, rowNum) -> new InventoryReportResponse.Row(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getDate(5).toLocalDate().toString(), rs.getString(6), rs.getString(7),
                        rs.getBigDecimal(8), rs.getBigDecimal(9), rs.getBigDecimal(10), rs.getBigDecimal(11),
                        rs.getBigDecimal(12), rs.getBigDecimal(13), rs.getBigDecimal(14)), args.toArray());

        InventoryReportResponse.Summary summary = summarize(rows);
        List<InventoryReportResponse.Option> campaigns = jdbc.query("""
                SELECT DISTINCT c.id, c.title, c.cutoff_date
                FROM inventory_campaigns c
                JOIN inventory_sessions i ON i.campaign_id = c.id
                WHERE i.status NOT IN ('CANCELLED', 'REJECTED')
                """ + visible.sqlFilter("i.school_id") + " ORDER BY c.cutoff_date DESC, c.title",
                (rs, n) -> new InventoryReportResponse.Option(rs.getLong(1), rs.getString(2)));
        List<InventoryReportResponse.Option> schools = "SCHOOL".equals(scope) || "NONE".equals(scope)
                ? List.of()
                : jdbc.query("""
                        SELECT DISTINCT s.id, s.name FROM schools s
                        JOIN inventory_sessions i ON i.school_id = s.id
                        WHERE i.status NOT IN ('CANCELLED', 'REJECTED')
                        """ + visible.sqlFilter("s.id") + " ORDER BY s.name",
                        (rs, n) -> new InventoryReportResponse.Option(rs.getLong(1), rs.getString(2)));

        return new InventoryReportResponse(scope, new InventoryReportResponse.Filters(campaigns, schools), summary, rows);
    }

    private static InventoryReportResponse.Summary summarize(List<InventoryReportResponse.Row> rows) {
        return new InventoryReportResponse.Summary(rows.size(), sum(rows, InventoryReportResponse.Row::bookQuantity),
                sum(rows, InventoryReportResponse.Row::matchedQuantity), sum(rows, InventoryReportResponse.Row::shortageQuantity),
                sum(rows, InventoryReportResponse.Row::surplusQuantity), sum(rows, InventoryReportResponse.Row::damagedQuantity),
                sum(rows, InventoryReportResponse.Row::wrongLocationQuantity), sum(rows, InventoryReportResponse.Row::discrepancyValue));
    }

    private static BigDecimal sum(List<InventoryReportResponse.Row> rows,
            java.util.function.Function<InventoryReportResponse.Row, BigDecimal> value) {
        return rows.stream().map(value).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
