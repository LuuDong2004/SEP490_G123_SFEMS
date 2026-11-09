package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** BC-04: tổng hợp đề xuất mua sắm theo năm ngân sách và phạm vi trường được phép xem. */
@Service
public class PurchaseReportService {
    private static final Set<String> STATUSES = Set.of("DRAFT", "PENDING", "APPROVED", "COMPLETED", "REJECTED", "CANCELLED");
    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public PurchaseReportService(JdbcTemplate jdbc, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.visible = visible;
    }

    @Transactional(readOnly = true)
    public PurchaseReportResponse get(Integer requestedYear, Long requestedSchoolId, Long requestedEquipmentId,
            String requestedStatus) {
        int year = requestedYear == null ? LocalDate.now().getYear() : requestedYear;
        String status = requestedStatus != null && STATUSES.contains(requestedStatus) ? requestedStatus : null;
        String scope = visible.level();
        boolean schoolView = "SCHOOL".equals(scope);
        String groupKey = schoolView ? "s.id" : "COALESCE(d.id, 0)";
        String groupName = schoolView ? "s.name" : "COALESCE(d.name, 'Chưa phân công')";
        String where = " WHERE p.budget_year = ? " + visible.sqlFilter("p.school_id");
        List<Object> args = new java.util.ArrayList<>();
        args.add(year);
        if (requestedSchoolId != null) { where += " AND p.school_id = ?"; args.add(requestedSchoolId); }
        if (requestedEquipmentId != null) {
            where += " AND EXISTS (SELECT 1 FROM purchase_proposal_lines f WHERE f.proposal_id = p.id AND f.catalog_id = "
                    + requestedEquipmentId + ")";
        }
        if (status == null) where += " AND p.status IN ('PENDING','APPROVED','COMPLETED')";
        else { where += " AND p.status = ?"; args.add(status); }

        String equipmentJoinFilter = requestedEquipmentId == null ? "" : " AND l.catalog_id = " + requestedEquipmentId;
        String receivedEquipmentFilter = requestedEquipmentId == null ? "" : " AND il.catalog_id = " + requestedEquipmentId;

        String proposalTotals = "WITH proposal_totals AS (SELECT p.id, p.school_id, p.status, p.plan_id, "
                + "COALESCE(SUM(l.quantity),0) AS quantity, "
                + "COALESCE(SUM(l.quantity * COALESCE(l.unit_price,0)),0) AS amount, "
                + "COALESCE((SELECT SUM(il.received_quantity) FROM equipment_intakes i "
                + "JOIN equipment_intake_lines il ON il.intake_id = i.id "
                + "WHERE (i.id = p.intake_id OR (i.source_resource = 'purchase_proposals' AND i.source_id = p.id)) "
                + "AND i.status = 'COMPLETED'" + receivedEquipmentFilter + "),0) AS received_quantity "
                + "FROM purchase_proposals p LEFT JOIN purchase_proposal_lines l ON l.proposal_id = p.id" + equipmentJoinFilter
                + where + " GROUP BY p.id, p.intake_id) ";
        String select = "SELECT CAST(" + groupKey + " AS text), " + groupName
                + ", COUNT(DISTINCT p.school_id), COUNT(p.id),"
                + " COUNT(p.id) FILTER (WHERE p.status = 'PENDING'),"
                + " COUNT(p.id) FILTER (WHERE p.status IN ('APPROVED','COMPLETED')) ,"
                + " COUNT(p.id) FILTER (WHERE p.plan_id IS NOT NULL),"
                + " COALESCE(SUM(p.quantity),0), COALESCE(SUM(p.received_quantity),0),"
                + " COALESCE(SUM(p.amount),0),"
                + " COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('APPROVED','COMPLETED')),0)"
                + " FROM proposal_totals p JOIN schools s ON s.id = p.school_id "
                + "LEFT JOIN departments_of_education d ON d.id = s.department_of_education_id";
        List<PurchaseReportResponse.Row> rows = jdbc.query(proposalTotals + select + " GROUP BY " + groupKey + ", "
                        + groupName + " ORDER BY 10 DESC, 2", (rs, n) -> new PurchaseReportResponse.Row(
                rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getLong(6),
                rs.getLong(7), rs.getBigDecimal(8), rs.getBigDecimal(9), rs.getBigDecimal(10), rs.getBigDecimal(11)), args.toArray());

        long proposals = rows.stream().mapToLong(PurchaseReportResponse.Row::proposals).sum();
        long pending = rows.stream().mapToLong(PurchaseReportResponse.Row::pending).sum();
        long approved = rows.stream().mapToLong(PurchaseReportResponse.Row::approved).sum();
        long planned = rows.stream().mapToLong(PurchaseReportResponse.Row::planned).sum();
        BigDecimal quantity = sum(rows, true, false);
        BigDecimal receivedQuantity = rows.stream().map(PurchaseReportResponse.Row::receivedQuantity)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal amount = sum(rows, false, false);
        BigDecimal approvedAmount = sum(rows, false, true);
        List<PurchaseReportResponse.Option> schools = schoolView ? List.of() : jdbc.query(
                "SELECT s.id, s.name FROM schools s WHERE s.status = 'ACTIVE'" + visible.sqlFilter("s.id") + " ORDER BY s.name",
                (rs, n) -> new PurchaseReportResponse.Option(String.valueOf(rs.getLong(1)), rs.getString(2)));
        List<PurchaseReportResponse.Option> years = jdbc.query("SELECT DISTINCT p.budget_year FROM purchase_proposals p "
                        + "WHERE p.budget_year IS NOT NULL " + visible.sqlFilter("p.school_id") + " ORDER BY p.budget_year DESC",
                (rs, n) -> new PurchaseReportResponse.Option(String.valueOf(rs.getInt(1)), String.valueOf(rs.getInt(1))));
        List<PurchaseReportResponse.Option> equipment = jdbc.query("SELECT DISTINCT c.id, c.name "
                        + "FROM equipment_catalogs c JOIN purchase_proposal_lines l ON l.catalog_id = c.id "
                        + "JOIN purchase_proposals p ON p.id = l.proposal_id "
                        + "WHERE c.active " + visible.sqlFilter("p.school_id") + "ORDER BY c.name",
                (rs, n) -> new PurchaseReportResponse.Option(String.valueOf(rs.getLong(1)), rs.getString(2)));
        if (years.stream().noneMatch(option -> option.key().equals(String.valueOf(year)))) {
            years = new java.util.ArrayList<>(years);
            years.add(new PurchaseReportResponse.Option(String.valueOf(year), String.valueOf(year)));
            years.sort((a, b) -> Integer.compare(Integer.parseInt(b.key()), Integer.parseInt(a.key())));
        }
        List<PurchaseReportResponse.Option> statuses = List.of(
                new PurchaseReportResponse.Option("PENDING", "Chờ duyệt"),
                new PurchaseReportResponse.Option("APPROVED", "Đã duyệt"),
                new PurchaseReportResponse.Option("COMPLETED", "Hoàn tất / đã vào kế hoạch"),
                new PurchaseReportResponse.Option("DRAFT", "Bản nháp"),
                new PurchaseReportResponse.Option("REJECTED", "Từ chối"),
                new PurchaseReportResponse.Option("CANCELLED", "Đã hủy"));
        return new PurchaseReportResponse(scope, new PurchaseReportResponse.Filters(schools, years, equipment, statuses),
                new PurchaseReportResponse.Summary(proposals, pending, approved, planned, quantity, receivedQuantity, amount, approvedAmount), rows);
    }

    private static BigDecimal sum(List<PurchaseReportResponse.Row> rows, boolean quantity, boolean approved) {
        return rows.stream().map(row -> quantity ? row.quantity() : approved ? row.approvedAmount() : row.amount())
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
