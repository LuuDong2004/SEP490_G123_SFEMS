package com.g123.sfems.module.report;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Tổng hợp số liệu BC-01 từ các bảng nghiệp vụ đã có trong bản đồ án. */
@Service
public class DashboardService {

    private final SchoolYearService schoolYears;
    private final RowLevelPrincipalResolver principals;
    private final VisibleSchools visible;
    private final JdbcTemplate jdbc;
    private final AdequacyReportService adequacyReports;

    public DashboardService(SchoolYearService schoolYears,
            RowLevelPrincipalResolver principals, VisibleSchools visible, JdbcTemplate jdbc,
            AdequacyReportService adequacyReports) {
        this.schoolYears = schoolYears;
        this.principals = principals;
        this.visible = visible;
        this.jdbc = jdbc;
        this.adequacyReports = adequacyReports;
    }

    /** Mỗi truy vấn tự trả kết nối; việc tổng hợp hàng trăm trường không giữ một connection suốt vòng lặp. */
    public DashboardResponse get(Long requestedSchoolYearId, String requestedPeriod) {
        List<SchoolYear> years = schoolYears.activeForDashboard();
        SchoolYear selected = years.stream().filter(year -> requestedSchoolYearId != null
                        && requestedSchoolYearId.equals(year.getId()))
                .findFirst()
                .orElseGet(() -> years.stream().filter(year -> Boolean.TRUE.equals(year.getCurrent())).findFirst()
                        .orElse(years.isEmpty() ? null : years.get(years.size() - 1)));

        String scope = visible.level();
        RowLevelPrincipal principal = principals.current().orElse(null);
        String schoolName = principal == null || principal.schoolId() == null ? null
                : jdbc.query("SELECT name FROM schools WHERE id = ?", rs -> rs.next() ? rs.getString(1) : null,
                        principal.schoolId());
        List<DashboardResponse.SchoolYear> yearOptions = years.stream()
                .map(year -> new DashboardResponse.SchoolYear(year.getId(), year.getName())).toList();
        if (selected == null || "NONE".equals(scope)) {
            return new DashboardResponse(scope, schoolName, yearOptions, selected == null ? null : selected.getId(),
                    null, null);
        }

        LocalDate asOf = selected.getEndDate();
        String period = switch (requestedPeriod == null ? "month" : requestedPeriod) {
            case "quarter", "year", "all" -> requestedPeriod;
            default -> "month";
        };
        if ("SCHOOL".equals(scope)) {
            long schoolId = principal.schoolId();
            return new DashboardResponse(scope, schoolName, yearOptions, selected.getId(), null,
                    schoolDashboard(schoolId, selected, asOf, period));
        }
        return new DashboardResponse(scope, schoolName, yearOptions, selected.getId(),
                cityDashboard(principal, selected, asOf, period), null);
    }

    private DashboardResponse.City cityDashboard(RowLevelPrincipal principal, SchoolYear year, LocalDate asOf,
            String period) {
        DashboardResponse.Devices devices = devices("TRUE", asOf);
        List<AdequacyReportResponse.Row> adequacyRows = adequacyReports.rowsForVisibleSchools(year.getSortOrder());
        List<SchoolRow> schools = adequacyRows.stream()
                .map(row -> new SchoolRow(row.schoolId(), row.schoolName())).toList();
        Map<Long, AdequacyReportResponse.Row> adequacyBySchool = adequacyRows.stream()
                .collect(java.util.stream.Collectors.toMap(AdequacyReportResponse.Row::schoolId, row -> row));
        Map<Long, EquipmentSchoolStats> equipmentBySchool = equipmentStatsBySchool(asOf);
        Map<Long, Integer> pendingBySchool = pendingProposalsBySchool(asOf.getYear());
        int schoolCount = schools.size();
        int meeting = 0;
        List<DashboardResponse.SchoolAttention> attention = new ArrayList<>();
        for (SchoolRow school : schools) {
            AdequacyReportResponse.Row adequacy = adequacyBySchool.get(school.id());
            if (adequacy != null && adequacy.norms() > 0 && adequacy.unknown() == 0
                    && adequacy.met() == adequacy.norms()) meeting++;
            EquipmentSchoolStats equipment = equipmentBySchool.getOrDefault(school.id(), EquipmentSchoolStats.EMPTY);
            int broken = equipment.broken();
            int missing = equipment.missing();
            int pending = pendingBySchool.getOrDefault(school.id(), 0);
            List<String> reasons = new ArrayList<>();
            if (adequacy == null || adequacy.norms() == 0 || adequacy.unknown() > 0
                    || adequacy.met() < adequacy.norms()) {
                reasons.add("Chưa đạt định mức tối thiểu hoặc thiếu dữ liệu tính");
            }
            if (broken > 0) reasons.add(broken + " thiết bị hỏng/đang sửa");
            if (missing > 0) reasons.add(missing + " thiết bị mất");
            if (pending > 0) reasons.add(pending + " đề xuất chờ duyệt");
            if (!reasons.isEmpty() && attention.size() < 10) {
                attention.add(new DashboardResponse.SchoolAttention(school.id(), school.name(), String.join("; ", reasons),
                        equipment.total(), broken, missing, pending));
            }
        }

        int budgetYear = asOf.getYear();
        int pendingProposals = count("SELECT COUNT(*) FROM purchase_proposals p WHERE p.status = 'PENDING'"
                + " AND p.approval_step = 'MANAGING_BODY' AND COALESCE(p.budget_year, ?) = ?"
                + visible.sqlFilter("p.school_id"), budgetYear, budgetYear);
        Long bodyId = dashboardBodyId(principal);
        DashboardResponse.ProcurementPlan plan = bodyId == null ? null : jdbc.query("""
                SELECT p.budget_year, p.status,
                       COALESCE((SELECT SUM(COALESCE(l.planned_quantity, l.quantity) * COALESCE(l.unit_price, 0))
                                 FROM purchase_proposals pp JOIN purchase_proposal_lines l ON l.proposal_id = pp.id
                                 WHERE pp.plan_id = p.id), 0)::bigint
                FROM procurement_plans p
                WHERE p.managing_body_id = ? AND p.school_year_id = ?
                ORDER BY p.created_at DESC LIMIT 1
                """, rs -> rs.next() ? new DashboardResponse.ProcurementPlan(rs.getInt(1), rs.getString(2), rs.getLong(3)) : null,
                bodyId, year.getId());
        DashboardResponse.Inventory inventory = bodyId == null ? null : cityInventory(bodyId);
        double rate = schoolCount == 0 ? 0 : roundPercent(meeting, schoolCount);
        List<DashboardResponse.PendingTask> pendingByType = pendingByType("MANAGING_BODY", null, asOf.getYear());
        return new DashboardResponse.City(devices, new DashboardResponse.MinimumStandard(meeting, schoolCount, rate),
                pendingProposals, plan, inventory, attention, deviceStatuses(devices), months(), pendingByType);
    }

    private DashboardResponse.School schoolDashboard(long schoolId, SchoolYear year, LocalDate asOf, String period) {
        DashboardResponse.Devices devices = devices("e.school_id = " + schoolId, asOf);
        AdequacyReportResponse.Row adequacy = adequacyReports.rowsForVisibleSchools(year.getSortOrder()).stream()
                .filter(row -> row.schoolId() == schoolId).findFirst().orElse(null);
        int required = adequacy == null ? 0 : adequacy.norms() - adequacy.unknown();
        DashboardResponse.SchoolMinimumStandard standard = new DashboardResponse.SchoolMinimumStandard(
                adequacy == null ? 0 : adequacy.met(), required, adequacy == null || adequacy.percent() == null
                        ? 0.0 : adequacy.percent().doubleValue());
        int pending = count("SELECT (SELECT COUNT(*) FROM equipment_intakes WHERE school_id = ? AND status = 'PENDING' AND approval_step = 'SCHOOL')"
                + " + (SELECT COUNT(*) FROM purchase_proposals WHERE school_id = ? AND status = 'PENDING' AND approval_step = 'SCHOOL')"
                + " + (SELECT COUNT(*) FROM inventory_sessions WHERE school_id = ? AND status = 'PENDING' AND approval_step = 'SCHOOL')",
                schoolId, schoolId, schoolId);
        Long bodyId = jdbc.query("SELECT department_of_education_id FROM schools WHERE id = ?",
                rs -> rs.next() ? (Long) rs.getObject(1) : null, schoolId);
        DashboardResponse.SchoolInventory inventory = bodyId == null ? null : schoolInventory(bodyId, schoolId);
        return new DashboardResponse.School(devices, standard, pending, inventory, deviceStatuses(devices),
                voucherStatuses(schoolId, period), months(), pendingByType("SCHOOL", schoolId, null));
    }

    private DashboardResponse.Devices devices(String schoolPredicate, LocalDate asOf) {
        return jdbc.query("""
                SELECT COALESCE(SUM(e.quantity) FILTER (WHERE e.status NOT IN ('LIQUIDATED', 'LOST')), 0)::int,
                       COALESCE(SUM(e.quantity * COALESCE(e.original_value, 0)) FILTER (WHERE e.status NOT IN ('LIQUIDATED', 'LOST')), 0)::bigint,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'IN_USE'), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'IN_STOCK'), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status IN ('BROKEN', 'REPAIRING')), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'MISSING'), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'LIQUIDATED'), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'PENDING_LIQUIDATION'), 0)::int
                FROM equipment e
                WHERE e.active AND (e.received_date IS NULL OR e.received_date <= ?)
                  AND """ + " " + schoolPredicate
                        + ("SCHOOL".equals(visible.level()) ? "" : visible.sqlFilter("e.school_id")),
                rs -> rs.next() ? new DashboardResponse.Devices(rs.getInt(1), rs.getLong(2), rs.getInt(3),
                        rs.getInt(4), rs.getInt(5), rs.getInt(6), rs.getInt(7), rs.getInt(8)) : emptyDevices(), asOf);
    }

    private Map<Long, EquipmentSchoolStats> equipmentStatsBySchool(LocalDate asOf) {
        return jdbc.query("""
                SELECT e.school_id,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status NOT IN ('LIQUIDATED', 'LOST')), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status IN ('BROKEN', 'REPAIRING')), 0)::int,
                       COALESCE(SUM(e.quantity) FILTER (WHERE e.status = 'MISSING'), 0)::int
                FROM equipment e
                WHERE e.active AND (e.received_date IS NULL OR e.received_date <= ?)
                """ + visible.sqlFilter("e.school_id") + " GROUP BY e.school_id",
                (rs, row) -> Map.entry(rs.getLong(1), new EquipmentSchoolStats(rs.getInt(2), rs.getInt(3), rs.getInt(4))),
                asOf).stream().collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private Map<Long, Integer> pendingProposalsBySchool(int budgetYear) {
        return jdbc.query("""
                SELECT p.school_id, COUNT(*)::int
                FROM purchase_proposals p
                WHERE p.status = 'PENDING' AND p.approval_step = 'MANAGING_BODY'
                  AND COALESCE(p.budget_year, ?) = ?
                """ + visible.sqlFilter("p.school_id") + " GROUP BY p.school_id",
                (rs, row) -> Map.entry(rs.getLong(1), rs.getInt(2)), budgetYear, budgetYear)
                .stream().collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private DashboardResponse.Inventory cityInventory(long bodyId) {
        return jdbc.query("""
                SELECT c.title, c.deadline,
                       (SELECT COUNT(DISTINCT i.school_id) FROM inventory_sessions i
                        WHERE i.campaign_id = c.id AND i.status IN ('PENDING', 'APPROVED', 'COMPLETED')),
                       (SELECT COUNT(*) FROM schools s WHERE s.status = 'ACTIVE' AND s.department_of_education_id = c.managing_body_id)
                FROM inventory_campaigns c
                WHERE c.managing_body_id = ? AND NOT c.closed
                ORDER BY c.deadline DESC LIMIT 1
                """, rs -> rs.next() ? new DashboardResponse.Inventory(rs.getString(1), rs.getInt(3), rs.getInt(4),
                rs.getDate(2).toLocalDate().toString()) : null, bodyId);
    }

    private DashboardResponse.SchoolInventory schoolInventory(long bodyId, long schoolId) {
        return jdbc.query("""
                SELECT c.title, c.deadline,
                       EXISTS(SELECT 1 FROM inventory_sessions i WHERE i.campaign_id = c.id AND i.school_id = ?
                           AND i.status IN ('PENDING', 'APPROVED', 'COMPLETED'))
                FROM inventory_campaigns c WHERE c.managing_body_id = ? AND NOT c.closed
                ORDER BY c.deadline DESC LIMIT 1
                """, rs -> rs.next() ? new DashboardResponse.SchoolInventory(rs.getString(1),
                rs.getDate(2).toLocalDate().toString(), rs.getBoolean(3)) : null, schoolId, bodyId);
    }

    private List<DashboardResponse.StatusCount> deviceStatuses(DashboardResponse.Devices devices) {
        return List.of(
                new DashboardResponse.StatusCount("use", "Đang sử dụng", devices.inUse()),
                new DashboardResponse.StatusCount("stock", "Trong kho", devices.inStorage()),
                new DashboardResponse.StatusCount("broken", "Hỏng, đang sửa", devices.broken()),
                new DashboardResponse.StatusCount("missing", "Mất", devices.missing()),
                new DashboardResponse.StatusCount("leaving", "Chờ ghi giảm", devices.pendingLiquidation()));
    }

    private List<DashboardResponse.PendingTask> pendingByType(String approvalStep, Long schoolId, Integer budgetYear) {
        List<DashboardResponse.PendingTask> pending = new ArrayList<>();
        List<Map.Entry<String, String>> types = "MANAGING_BODY".equals(approvalStep)
                ? List.of(Map.entry("purchase_proposals", "Đề xuất mua sắm"))
                : List.of(Map.entry("equipment_intakes", "Phiếu nhập thiết bị"),
                        Map.entry("purchase_proposals", "Đề xuất mua sắm"),
                        Map.entry("inventory_sessions", "Phiếu kiểm kê"));
        for (Map.Entry<String, String> type : types) {
            String sql = "SELECT COUNT(*) FROM " + type.getKey()
                    + " WHERE status = 'PENDING' AND approval_step = ?";
            List<Object> args = new ArrayList<>();
            args.add(approvalStep);
            if (schoolId != null) {
                sql += " AND school_id = ?";
                args.add(schoolId);
            } else if ("MANAGING_BODY".equals(approvalStep)) {
                sql += " AND COALESCE(budget_year, ?) = ?";
                args.add(budgetYear);
                args.add(budgetYear);
                sql += visible.sqlFilter("school_id");
            }
            int amount = count(sql, args.toArray());
            if (amount > 0) pending.add(new DashboardResponse.PendingTask(type.getKey(), type.getValue(), amount));
        }
        return pending;
    }

    private List<DashboardResponse.StatusCount> voucherStatuses(long schoolId, String period) {
        String since = switch (period) {
            case "quarter" -> "DATE_TRUNC('quarter', CURRENT_DATE)";
            case "year" -> "DATE_TRUNC('year', CURRENT_DATE)";
            case "all" -> "DATE '1900-01-01'";
            default -> "DATE_TRUNC('month', CURRENT_DATE)";
        };
        Map<String, Integer> counts = new java.util.HashMap<>();
        jdbc.query("""
                SELECT v.status, COUNT(*)::int FROM (
                    SELECT status, created_at, school_id FROM equipment_intakes
                    UNION ALL SELECT status, created_at, school_id FROM purchase_proposals
                    UNION ALL SELECT status, created_at, school_id FROM inventory_sessions
                ) v WHERE v.school_id = ? AND v.created_at >= """ + since + " GROUP BY v.status",
                rs -> {
                    counts.put(rs.getString(1), rs.getInt(2));
                }, schoolId);
        return List.of(
                new DashboardResponse.StatusCount("COMPLETED", "Hoàn tất", counts.getOrDefault("COMPLETED", 0)),
                new DashboardResponse.StatusCount("APPROVED", "Đang thực hiện", counts.getOrDefault("APPROVED", 0)),
                new DashboardResponse.StatusCount("PENDING", "Chờ duyệt", counts.getOrDefault("PENDING", 0)),
                new DashboardResponse.StatusCount("DRAFT", "Nháp", counts.getOrDefault("DRAFT", 0)),
                new DashboardResponse.StatusCount("CLOSED", "Từ chối, huỷ", counts.getOrDefault("REJECTED", 0)
                        + counts.getOrDefault("CANCELLED", 0)));
    }

    private List<DashboardResponse.Month> months() {
        return jdbc.query("""
                WITH months AS (
                    SELECT generate_series(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
                                           DATE_TRUNC('month', CURRENT_DATE), INTERVAL '1 month') AS month
                )
                SELECT TO_CHAR(m.month, 'MM/YYYY'),
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action = 'GHI_TANG')::int,
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action IN ('CAP_PHAT', 'THU_HOI', 'DIEU_CHUYEN'))::int,
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action = 'BAO_HONG')::int,
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action IN ('THANH_LY', 'TIEU_HUY', 'MAT'))::int
                FROM months m
                LEFT JOIN (
                    SELECT h.* FROM equipment_history h JOIN equipment e ON e.id = h.equipment_id
                    WHERE h.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months' - INTERVAL '1 day'
                    """ + visible.sqlFilter("e.school_id") + """
                ) h ON DATE_TRUNC('month', h.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = m.month
                GROUP BY m.month ORDER BY m.month
                """, (rs, row) -> new DashboardResponse.Month(rs.getString(1), rs.getInt(2), rs.getInt(3),
                rs.getInt(4), rs.getInt(5)));
    }

    private Long dashboardBodyId(RowLevelPrincipal principal) {
        if (principal != null && principal.managingBodyId() != null) return principal.managingBodyId();
        return jdbc.query("SELECT id FROM departments_of_education WHERE type = 'SO' ORDER BY id LIMIT 1",
                rs -> rs.next() ? rs.getLong(1) : null);
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private static double roundPercent(int value, int total) {
        return BigDecimal.valueOf(value * 100.0 / total).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
    private static DashboardResponse.Devices emptyDevices() {
        return new DashboardResponse.Devices(0, 0L, 0, 0, 0, 0, 0, 0);
    }

    private record SchoolRow(long id, String name) {}
    private record EquipmentSchoolStats(int total, int broken, int missing) {
        private static final EquipmentSchoolStats EMPTY = new EquipmentSchoolStats(0, 0, 0);
    }
}
