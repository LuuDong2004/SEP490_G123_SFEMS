package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** BC-02: tổng hợp và tra cứu tài sản trong phạm vi trường người xem được phép. */
@Service
public class AssetReportService {
    private static final int ROW_LIMIT = 1000;
    private static final int EXPORT_ROW_LIMIT = 5000;
    private static final Set<String> STATUSES = Set.of("IN_USE", "IN_STOCK", "BROKEN", "REPAIRING",
            "MISSING", "PENDING_LIQUIDATION", "LIQUIDATED", "LOST");

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public AssetReportService(JdbcTemplate jdbc, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.visible = visible;
    }

    @Transactional(readOnly = true)
    public AssetReportResponse get(String fromValue, String toValue, Long schoolId, Long subjectId,
            Long equipmentTypeId, String requestedStatus, Long originId) {
        return get(fromValue, toValue, schoolId, subjectId, equipmentTypeId, requestedStatus, originId, ROW_LIMIT, null);
    }

    @Transactional(readOnly = true)
    public AssetReportResponse getForExport(String fromValue, String toValue, Long schoolId, Long subjectId,
            Long equipmentTypeId, String requestedStatus, Long originId, String search) {
        return get(fromValue, toValue, schoolId, subjectId, equipmentTypeId, requestedStatus, originId,
                EXPORT_ROW_LIMIT, search);
    }

    private AssetReportResponse get(String fromValue, String toValue, Long schoolId, Long subjectId,
            Long equipmentTypeId, String requestedStatus, Long originId, int rowLimit, String search) {
        LocalDate today = LocalDate.now();
        LocalDate to = parseOr(toValue, today);
        LocalDate earliest = jdbc.query("SELECT MIN(e.received_date) FROM equipment e WHERE e.active "
                        + "AND e.received_date <= ? " + visible.sqlFilter("e.school_id"),
                rs -> { Date date = rs.next() ? rs.getDate(1) : null; return date == null ? null : date.toLocalDate(); },
                Date.valueOf(to));
        LocalDate from = parseOr(fromValue, earliest == null ? to.withDayOfYear(1) : earliest);
        if (from.isAfter(to)) from = to;
        // Immutable Set implementations reject null in contains(), while the filter is optional.
        String status = requestedStatus != null && STATUSES.contains(requestedStatus) ? requestedStatus : null;
        String scope = visible.level();

        // BC-02 lọc theo thời điểm ghi tăng: cả danh sách và các số liệu đều thuộc khoảng ngày được chọn.
        String where = " WHERE e.active AND e.received_date >= ? AND e.received_date <= ? "
                + visible.sqlFilter("e.school_id");
        List<Object> args = new ArrayList<>();
        args.add(Date.valueOf(from));
        args.add(Date.valueOf(to));
        if (schoolId != null) { where += " AND e.school_id = ?"; args.add(schoolId); }
        if (subjectId != null) { where += " AND c.subject_id = ?"; args.add(subjectId); }
        if (equipmentTypeId != null) { where += " AND c.equipment_type_id = ?"; args.add(equipmentTypeId); }
        if (status != null) { where += " AND e.status = ?"; args.add(status); }
        if (originId != null) { where += " AND e.origin_source_id = ?"; args.add(originId); }
        if (search != null && !search.isBlank()) {
            where += " AND (e.code ILIKE ? OR e.name ILIKE ? OR s.name ILIKE ?)";
            String pattern = "%" + search.trim() + "%";
            args.add(pattern); args.add(pattern); args.add(pattern);
        }
        String joins = " FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id "
                + "JOIN schools s ON s.id = e.school_id "
                + "LEFT JOIN subjects sub ON sub.id = c.subject_id "
                + "LEFT JOIN equipment_types et ON et.id = c.equipment_type_id "
                + "LEFT JOIN origin_sources os ON os.id = e.origin_source_id ";

        AssetReportResponse.Summary summary = jdbc.query("""
                SELECT COALESCE(SUM(e.quantity) FILTER (WHERE e.status NOT IN ('LIQUIDATED','LOST')), 0),
                       COALESCE(SUM(e.quantity * COALESCE(e.original_value,0)) FILTER (WHERE e.status NOT IN ('LIQUIDATED','LOST')), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'IN_USE'), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'IN_STOCK'), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status IN ('BROKEN','REPAIRING')), 0),
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status IN ('MISSING','LOST')), 0)
                """ + joins + where,
                rs -> rs.next() ? new AssetReportResponse.Summary(rs.getBigDecimal(1), rs.getBigDecimal(2),
                        rs.getBigDecimal(3), rs.getBigDecimal(4), rs.getBigDecimal(5), rs.getBigDecimal(6),
                        BigDecimal.ZERO) : emptySummary(), args.toArray());

        String historyWhere = where + " AND EXISTS (SELECT 1 FROM equipment_history h WHERE h.equipment_id = e.id "
                + "AND h.action = 'GHI_TANG' AND h.created_at >= ? AND h.created_at < ? )";
        List<Object> historyArgs = new ArrayList<>(args);
        historyArgs.add(Date.valueOf(from)); historyArgs.add(Date.valueOf(to.plusDays(1)));
        BigDecimal additions = jdbc.query("SELECT COALESCE(SUM(e.quantity),0)" + joins + historyWhere,
                rs -> rs.next() ? rs.getBigDecimal(1) : BigDecimal.ZERO, historyArgs.toArray());
        summary = new AssetReportResponse.Summary(summary.quantity(), summary.originalValue(), summary.inUse(),
                summary.inStorage(), summary.broken(), summary.missing(), additions);

        Long total = jdbc.queryForObject("SELECT COUNT(*)" + joins + where, Long.class, args.toArray());
        List<Object> rowArgs = new ArrayList<>(args);
        rowArgs.add(rowLimit);
        List<AssetReportResponse.Row> rows = jdbc.query("""
                SELECT e.id, e.code, e.name, s.name, sub.name, et.name, e.status, os.name,
                       e.condition, e.quantity, e.original_value, e.received_date
                """ + joins + where + " ORDER BY s.name, e.code LIMIT ?",
                (rs, n) -> new AssetReportResponse.Row(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), statusLabel(rs.getString(7)),
                        rs.getString(8), rs.getString(9), rs.getBigDecimal(10), rs.getBigDecimal(11),
                        rs.getDate(12) == null ? null : rs.getDate(12).toLocalDate().toString()), rowArgs.toArray());

        List<AssetReportResponse.Option> schools = "SCHOOL".equals(scope) || "NONE".equals(scope)
                ? List.of() : jdbc.query("SELECT s.id, s.name FROM schools s WHERE s.status = 'ACTIVE'"
                        + visible.sqlFilter("s.id") + " ORDER BY s.name",
                        (rs, n) -> new AssetReportResponse.Option(rs.getLong(1), null, rs.getString(2)));
        // Giữ nguyên các lựa chọn khi tổ hợp bộ lọc hiện tại không có bản ghi phù hợp.
        String optionWhere = " WHERE e.active " + visible.sqlFilter("e.school_id");
        List<AssetReportResponse.Option> subjects = options("SELECT DISTINCT sub.id, sub.code, sub.name" + joins
                + optionWhere + " AND sub.id IS NOT NULL ORDER BY sub.name", List.of());
        List<AssetReportResponse.Option> equipmentTypes = options("SELECT DISTINCT et.id, et.code, et.name" + joins
                + optionWhere + " AND et.id IS NOT NULL ORDER BY et.name", List.of());
        List<AssetReportResponse.Option> origins = options("SELECT DISTINCT os.id, os.code, os.name" + joins
                + optionWhere + " AND os.id IS NOT NULL ORDER BY os.name", List.of());
        List<AssetReportResponse.Option> statuses = List.of(
                new AssetReportResponse.Option(null, "IN_USE", "Đang sử dụng"),
                new AssetReportResponse.Option(null, "IN_STOCK", "Trong kho"),
                new AssetReportResponse.Option(null, "BROKEN", "Hỏng"),
                new AssetReportResponse.Option(null, "REPAIRING", "Đang sửa chữa"),
                new AssetReportResponse.Option(null, "MISSING", "Báo mất"),
                new AssetReportResponse.Option(null, "PENDING_LIQUIDATION", "Chờ ghi giảm"),
                new AssetReportResponse.Option(null, "LIQUIDATED", "Đã thanh lý"),
                new AssetReportResponse.Option(null, "LOST", "Đã mất"));
        return new AssetReportResponse(scope, from.toString(), to.toString(),
                new AssetReportResponse.Filters(schools, subjects, equipmentTypes, origins, statuses), summary,
                total == null ? 0 : total, total != null && total > rowLimit, rows);
    }

    private List<AssetReportResponse.Option> options(String sql, List<Object> args) {
        return jdbc.query(sql, (rs, n) -> new AssetReportResponse.Option(rs.getLong(1), rs.getString(2),
                rs.getString(3)), args.toArray());
    }

    private static LocalDate parseOr(String value, LocalDate fallback) {
        return value == null || value.isBlank() ? fallback : LocalDate.parse(value);
    }

    private static AssetReportResponse.Summary emptySummary() {
        return new AssetReportResponse.Summary(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static String statusLabel(String status) {
        return switch (status) {
            case "IN_USE" -> "Đang sử dụng"; case "IN_STOCK" -> "Trong kho";
            case "BROKEN" -> "Hỏng"; case "REPAIRING" -> "Đang sửa chữa";
            case "MISSING", "LOST" -> "Báo mất"; case "PENDING_LIQUIDATION" -> "Chờ ghi giảm";
            case "LIQUIDATED" -> "Đã thanh lý"; default -> status;
        };
    }
}
