package com.g123.sfems.module.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.report.ReportService.Params;
import com.g123.sfems.module.report.ReportService.Report;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/** Báo cáo nhu cầu và kế hoạch mua sắm (BC-04), và số liệu biểu đồ của báo cáo chuẩn CSVC. */
@SpringBootTest
@Transactional
class PurchaseReportTest {

    /** Năm ngân sách không có dữ liệu thật. */
    private static final int YEAR = 2099;

    @Autowired
    ReportService reports;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    long school;
    long catalog;
    long other;

    @BeforeEach
    void pick() {
        List<Long> schools = jdbc.queryForList("SELECT id FROM schools ORDER BY id LIMIT 1", Long.class);
        List<Long> catalogs = jdbc.queryForList("SELECT id FROM equipment_catalogs WHERE equipment_type_id IS NOT NULL"
                + " ORDER BY id LIMIT 2", Long.class);
        List<String> admins = jdbc.queryForList("SELECT username FROM users WHERE user_type = 'SYSTEM' ORDER BY id LIMIT 1",
                String.class);
        Assumptions.assumeTrue(!schools.isEmpty() && catalogs.size() == 2 && !admins.isEmpty(), "Thiếu dữ liệu nền");
        school = schools.get(0);
        catalog = catalogs.get(0);
        other = catalogs.get(1);
        signIn(admins.get(0));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void countsPlannedAndReceivedPerLine() {
        Long plan = jdbc.queryForObject("INSERT INTO procurement_plans (managing_body_id, code, plan_date, title, budget_year, created_at)"
                + " SELECT id, 'THU-2099', CURRENT_DATE, 'Thử', ?, now() FROM departments_of_education ORDER BY id LIMIT 1 RETURNING id", Long.class, YEAR);
        // Chưa vào kế hoạch, đang ở kế hoạch nháp, đã hoàn tất (hai dòng cùng thiết bị, kế hoạch bớt dòng đầu còn 4).
        line(proposal("PENDING", null), 1, catalog, 10, null);
        line(proposal("APPROVED", plan), 1, other, 5, null);
        long done = proposal("COMPLETED", plan);
        line(done, 1, catalog, 6, 4);
        line(done, 2, catalog, 3, 3);
        intake(done, "COMPLETED", 5);
        intake(done, "DRAFT", 2);

        Report report = build("school");
        assertThat(report.rows()).hasSize(1);
        Map<String, Object> row = report.rows().get(0);
        assertThat(number(row, "proposals")).isEqualTo(3);
        assertThat(number(row, "pending")).isEqualTo(1);
        assertThat(number(row, "approved")).isEqualTo(2);
        // "Vào kế hoạch" chỉ khi kế hoạch đã duyệt (đề xuất hoàn tất) — đề xuất ở kế hoạch nháp chưa tính.
        assertThat(number(row, "planned")).isEqualTo(1);
        assertThat(number(row, "quantity")).isEqualTo(24);
        assertThat(number(row, "planned_quantity")).isEqualTo(7);
        assertThat(number(row, "received")).isEqualTo(5);
        assertThat(number(row, "remaining")).isEqualTo(2);

        Report byCatalog = build("catalog");
        assertThat(byCatalog.rows()).hasSize(2);
        assertThat(byCatalog.rows().stream().mapToInt(r -> number(r, "received")).sum()).isEqualTo(5);
        assertThat(number(byCatalog.totals(), "proposals")).isEqualTo(3);
    }

    @Test
    void neverReceivesMoreThanPlanned() {
        long done = proposal("COMPLETED", null);
        line(done, 1, catalog, 2, null);
        intake(done, "COMPLETED", 9);
        Map<String, Object> row = build("type").rows().get(0);
        assertThat(number(row, "received")).isEqualTo(2);
        assertThat(number(row, "remaining")).isZero();
    }

    @Test
    void facilityChartsMatchTheTable() {
        Report report = reports.build("facility-standard", new Params(null, null, null, null, null, null, null, null));
        Assumptions.assumeTrue(!report.rows().isEmpty(), "Chưa có trường nào");
        for (Map<String, Object> row : report.rows()) {
            int passed = list(row, "groups").stream().mapToInt(g -> number(g, "passed")).sum();
            int failed = list(row, "groups").stream().mapToInt(g -> number(g, "failed")).sum();
            assertThat(passed).isEqualTo(number(row, "min_passed"));
            assertThat(passed + failed).isEqualTo(number(row, "min_total"));
            int failedMin = (int) list(row, "failed").stream().filter(f -> ((List<?>) f.get("tiers")).contains("min")).count();
            assertThat(failedMin).isEqualTo(number(row, "failed_min")).isEqualTo(failed);
        }
    }

    private Report build(String group) {
        return reports.build("purchase", new Params(null, null, YEAR, null, null, null, group, null));
    }

    private long proposal(String status, Long plan) {
        return jdbc.queryForObject("INSERT INTO purchase_proposals (school_id, proposal_date, budget_year, status, plan_id,"
                + " created_at) VALUES (?, CURRENT_DATE, ?, ?, ?, now()) RETURNING id", Long.class, school, YEAR, status, plan);
    }

    private void line(long proposal, int no, long catalogId, int quantity, Integer planned) {
        jdbc.update("INSERT INTO purchase_proposal_lines (proposal_id, line_no, catalog_id, name, quantity, planned_quantity)"
                + " VALUES (?, ?, ?, 'Thử', ?, ?)", proposal, no, catalogId, quantity, planned);
    }

    private void intake(long proposal, String status, int quantity) {
        Long id = jdbc.queryForObject("INSERT INTO equipment_intakes (school_id, code, intake_date, status, confirmed_at,"
                + " source_resource, source_id, created_at) VALUES (?, ?, CURRENT_DATE, ?, now(), 'purchase_proposals', ?, now())"
                + " RETURNING id", Long.class, school, "THU-" + status, status, proposal);
        jdbc.update("INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name, document_quantity,"
                + " received_quantity, created_at) VALUES (?, 1, ?, 'Thử', ?, ?, now())", id, catalog, quantity, quantity);
    }

    private static int number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).intValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> row, String key) {
        return (List<Map<String, Object>>) row.get(key);
    }

    private void signIn(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
    }
}
