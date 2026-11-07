package com.g123.sfems.module.report;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearRepository;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Tổng hợp số liệu BC-01 từ các bảng nghiệp vụ đã có trong bản đồ án. */
@Service
public class DashboardService {

    private final SchoolYearRepository schoolYears;
    private final RowLevelSecurity rowLevel;
    private final RowLevelPrincipalResolver principals;
    private final VisibleSchools visible;
    private final JdbcTemplate jdbc;

    public DashboardService(SchoolYearRepository schoolYears, RowLevelSecurity rowLevel,
            RowLevelPrincipalResolver principals, VisibleSchools visible, JdbcTemplate jdbc) {
        this.schoolYears = schoolYears;
        this.rowLevel = rowLevel;
        this.principals = principals;
        this.visible = visible;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public DashboardResponse get(Long requestedSchoolYearId, String requestedPeriod) {
        List<SchoolYear> years = schoolYears.findAll(rowLevel.scope(SchoolYear.class, Action.READ),
                Sort.by(Sort.Direction.ASC, "sortOrder").and(Sort.by("name"))).stream()
                .filter(year -> Boolean.TRUE.equals(year.getActive()))
                .sorted(Comparator.comparing(SchoolYear::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .toList();
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
        int schoolCount = count("SELECT COUNT(*) FROM schools s WHERE s.status = 'ACTIVE'"
                + visible.sqlFilter("s.id"));
        int meeting = 0;
        List<DashboardResponse.SchoolAttention> attention = new ArrayList<>();
        List<SchoolRow> schools = jdbc.query("SELECT s.id, s.name FROM schools s WHERE s.status = 'ACTIVE'"
                        + visible.sqlFilter("s.id") + " ORDER BY s.name",
                (rs, row) -> new SchoolRow(rs.getLong(1), rs.getString(2)));
        for (SchoolRow school : schools) {
            DashboardResponse.SchoolMinimumStandard adequacy = adequacy(school.id(), year);
            if (adequacy.required() > 0 && adequacy.met() >= adequacy.required()) meeting++;
            int broken = count("SELECT COALESCE(SUM(quantity), 0)::int FROM equipment WHERE school_id = ? AND active"
                    + " AND status IN ('BROKEN', 'REPAIRING') AND (received_date IS NULL OR received_date <= ?)",
                    school.id(), asOf);
            int missing = count("SELECT COALESCE(SUM(quantity), 0)::int FROM equipment WHERE school_id = ? AND active"
                    + " AND status = 'MISSING' AND (received_date IS NULL OR received_date <= ?)", school.id(), asOf);
            int equipment = count("SELECT COALESCE(SUM(quantity), 0)::int FROM equipment WHERE school_id = ? AND active"
                    + " AND status NOT IN ('LIQUIDATED', 'LOST') AND (received_date IS NULL OR received_date <= ?)",
                    school.id(), asOf);
            int pending = count("SELECT COUNT(*) FROM purchase_proposals WHERE school_id = ? AND status = 'PENDING'"
                    + " AND approval_step = 'MANAGING_BODY' AND COALESCE(budget_year, ?) = ?",
                    school.id(), asOf.getYear(), asOf.getYear());
            List<String> reasons = new ArrayList<>();
            if (adequacy.required() > adequacy.met()) reasons.add("Chưa đạt định mức tối thiểu");
            if (broken > 0) reasons.add(broken + " thiết bị hỏng/đang sửa");
            if (missing > 0) reasons.add(missing + " thiết bị mất");
            if (pending > 0) reasons.add(pending + " đề xuất chờ duyệt");
            if (!reasons.isEmpty() && attention.size() < 10) {
                attention.add(new DashboardResponse.SchoolAttention(school.id(), school.name(), String.join("; ", reasons),
                        equipment, broken, missing, pending));
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
        DashboardResponse.SchoolMinimumStandard standard = adequacy(schoolId, year);
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

    private DashboardResponse.SchoolMinimumStandard adequacy(long schoolId, SchoolYear year) {
        List<Norm> norms = jdbc.query("""
                SELECT n.catalog_id, n.equipment_type_id, n.subject_id, n.grade_id, n.room_type_id,
                       n.min_quantity, COALESCE(n.basis_size, 1), n.norm_basis,
                       s.class_count, s.student_count,
                       (SELECT COUNT(*) FROM rooms r WHERE r.school_id = s.id AND r.active
                           AND (n.room_type_id IS NULL OR r.room_type_id = n.room_type_id)
                           AND (n.subject_id IS NULL OR r.subject_id = n.subject_id))
                FROM schools s
                JOIN equipment_standards st ON st.education_level_id = s.education_level_id
                    AND st.status = 'ACTIVE' AND st.active
                JOIN equipment_norms n ON n.standard_id = st.id AND n.active AND NOT n.optional
                    AND n.min_quantity IS NOT NULL
                JOIN school_years start_y ON start_y.id = st.start_school_year_id
                LEFT JOIN school_years end_y ON end_y.id = st.end_school_year_id
                WHERE s.id = ? AND start_y.sort_order <= ? AND (end_y.id IS NULL OR end_y.sort_order >= ?)
                """, (rs, row) -> new Norm(rs.getObject(1, Long.class), rs.getObject(2, Long.class),
                rs.getObject(3, Long.class), rs.getObject(4, Long.class), rs.getObject(5, Long.class),
                rs.getBigDecimal(6), rs.getInt(7), rs.getString(8), rs.getObject(9, Integer.class),
                rs.getObject(10, Integer.class), rs.getInt(11)), schoolId, year.getSortOrder(), year.getSortOrder());
        int met = 0;
        int requiredCount = 0;
        for (Norm norm : norms) {
            int base = switch (norm.basis()) {
                case "PER_CLASS" -> nz(norm.classes());
                case "PER_STUDENT" -> nz(norm.students());
                case "PER_ROOM" -> norm.rooms();
                case "PER_TEACHER" -> 0;
                default -> 1;
            };
            if ("PER_TEACHER".equals(norm.basis())) continue;
            int needed = norm.quantity().multiply(BigDecimal.valueOf(base))
                    .divide(BigDecimal.valueOf(Math.max(norm.basisSize(), 1)), 0, RoundingMode.CEILING).intValue();
            if (needed <= 0) continue;
            requiredCount++;
            int available = count("""
                    SELECT COALESCE(SUM(e.quantity), 0)::int
                    FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id
                    WHERE e.school_id = ? AND e.active AND e.status IN ('IN_USE', 'IN_STOCK')
                      AND COALESCE(e.condition, 'TOT') NOT IN ('HONG', 'KHONG_SU_DUNG')
                      AND (CAST(? AS BIGINT) IS NULL OR c.id = CAST(? AS BIGINT))
                      AND (CAST(? AS BIGINT) IS NULL OR c.equipment_type_id = CAST(? AS BIGINT))
                      AND (CAST(? AS BIGINT) IS NULL OR c.subject_id = CAST(? AS BIGINT))
                      AND (CAST(? AS BIGINT) IS NULL OR c.grade_id = CAST(? AS BIGINT))
                    """, schoolId, norm.catalogId(), norm.catalogId(), norm.typeId(), norm.typeId(),
                    norm.subjectId(), norm.subjectId(), norm.gradeId(), norm.gradeId());
            if (available >= needed) met++;
        }
        return new DashboardResponse.SchoolMinimumStandard(met, requiredCount,
                requiredCount == 0 ? 0 : roundPercent(met, requiredCount));
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

    private static int nz(Integer value) { return value == null ? 0 : value; }
    private static double roundPercent(int value, int total) {
        return BigDecimal.valueOf(value * 100.0 / total).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
    private static DashboardResponse.Devices emptyDevices() {
        return new DashboardResponse.Devices(0, 0L, 0, 0, 0, 0, 0, 0);
    }

    private record SchoolRow(long id, String name) {}
    private record Norm(Long catalogId, Long typeId, Long subjectId, Long gradeId, Long roomTypeId,
            BigDecimal quantity, int basisSize, String basis, Integer classes, Integer students, int rooms) {}
}
