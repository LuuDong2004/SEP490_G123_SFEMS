package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.JwtService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
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

/**
 * Đề xuất và kế hoạch mua sắm (NC-05, NC-06): đề xuất bị cắt hết khi duyệt kế hoạch thì rời kế hoạch, số tổng hợp theo
 * số đưa vào kế hoạch, kế hoạch chỉ nhận đề xuất cùng năm ngân sách, số "đang đề xuất" trừ phần đã nhập về.
 */
@SpringBootTest
@Transactional
class ProcurementPlanFlowTest {

    /** Năm ngân sách không có dữ liệu thật. */
    private static final int YEAR = 2099;

    @Autowired
    ProcurementPlanService plans;

    @Autowired
    PurchaseProposalService proposals;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    EntityManager em;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    long school;
    long body;
    long schoolUser;
    String schoolUsername;
    String soUsername;
    long catalog;
    long other;
    int codes;

    @BeforeEach
    void pick() {
        List<Map<String, Object>> staff = jdbc.queryForList("""
                SELECT u.id, u.username, us.school_id, s.department_of_education_id AS body FROM users u
                JOIN user_schools us ON us.id = u.id JOIN schools s ON s.id = us.school_id
                WHERE u.user_type = 'SCHOOL' AND us.campus_id IS NULL AND s.department_of_education_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id AND p.code = 'purchase_proposals:write')
                  AND EXISTS (SELECT 1 FROM user_sos x2 JOIN users u2 ON u2.id = x2.id
                              WHERE x2.managing_body_id = s.department_of_education_id)
                ORDER BY (u.username = 'thcs.canbo') DESC, u.id LIMIT 1""");
        // Cán bộ trường lập được đề xuất, trường có cơ quan quản lý và cơ quan đó có tài khoản Sở.
        Assumptions.assumeTrue(!staff.isEmpty(), "Thiếu tài khoản cán bộ trường");
        school = ((Number) staff.get(0).get("school_id")).longValue();
        body = ((Number) staff.get(0).get("body")).longValue();
        schoolUser = ((Number) staff.get(0).get("id")).longValue();
        schoolUsername = (String) staff.get(0).get("username");
        List<String> so = jdbc.queryForList("SELECT u.username FROM users u JOIN user_sos x ON x.id = u.id"
                + " WHERE x.managing_body_id = ? ORDER BY EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id AND p.code = 'procurement_plans:approve') DESC, EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id AND p.code = 'procurement_plans:write') DESC, u.id LIMIT 1", String.class, body);
        List<Long> catalogs = jdbc.queryForList("SELECT id FROM equipment_catalogs ORDER BY id LIMIT 2", Long.class);
        Assumptions.assumeTrue(!so.isEmpty() && catalogs.size() == 2, "Thiếu dữ liệu nền");
        soUsername = so.get(0);
        catalog = catalogs.get(0);
        other = catalogs.get(1);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------ #1 đề xuất bị cắt hết

    @Test
    void proposalCutToZeroLeavesThePlanOnApproval() {
        long plan = plan("PENDING", YEAR);
        long cut = proposal("APPROVED", plan, YEAR);
        line(cut, 1, catalog, 3, 0, "100");
        long kept = proposal("APPROVED", plan, YEAR);
        line(kept, 1, catalog, 2, 2, "100");
        line(kept, 2, other, 5, 0, "100");

        signIn(soUsername);
        plans.approve(plan, null);
        em.flush();

        // Bị cắt hết: rời kế hoạch, vẫn "Đã duyệt", không mang số / giá kế hoạch theo — vào được kế hoạch sau.
        Map<String, Object> left = jdbc.queryForMap("SELECT status, plan_id FROM purchase_proposals WHERE id = ?", cut);
        assertThat(left.get("status")).isEqualTo("APPROVED");
        assertThat(left.get("plan_id")).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM purchase_proposal_lines WHERE proposal_id = ?"
                + " AND (planned_quantity IS NOT NULL OR planned_unit_price IS NOT NULL)", Integer.class, cut)).isZero();
        assertThat(jdbc.queryForList("SELECT note FROM voucher_events WHERE resource = 'purchase_proposals'"
                + " AND voucher_id = ?", String.class, cut)).anyMatch(n -> n.startsWith("Không đưa vào kế hoạch"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND link = ?",
                Integer.class, schoolUser, "/purchase-proposals/show/" + cut)).isEqualTo(1);

        // Còn một dòng được mua: hoàn tất, ở lại kế hoạch; dòng 0 không thành dòng nhập hàng.
        Map<String, Object> done = jdbc.queryForMap("SELECT status, plan_id FROM purchase_proposals WHERE id = ?", kept);
        assertThat(done.get("status")).isEqualTo("COMPLETED");
        assertThat(((Number) done.get("plan_id")).longValue()).isEqualTo(plan);
        signIn(schoolUsername);
        List<PurchaseProposalService.IntakeLine> intake = proposals.intakeLines(kept);
        assertThat(intake).hasSize(1);
        assertThat(intake.get(0).catalogId()).isEqualTo(catalog);
        assertThat(intake.get(0).remaining()).isEqualTo(2);
    }

    @Test
    void completedProposalWithNothingPlannedIsNotReportedAsFullyReceived() {
        // Dữ liệu cũ: đề xuất đã hoàn tất mà mọi dòng 0 — không có gì để nhập, không phải "đã nhập đủ".
        long plan = plan("APPROVED", YEAR);
        long p = proposal("COMPLETED", plan, YEAR);
        line(p, 1, catalog, 3, 0, "100");
        signIn(schoolUsername);
        assertThat(proposals.intakeLines(p)).isEmpty();
        assertThatThrownBy(() -> proposals.createIntake(p, null))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("không có gì để nhập");
    }

    // ------------------------------------------------------------------ #2 số tổng hợp

    @Test
    void summaryCountsPlannedQuantitiesAndApprovedPrices() {
        // Chưa vào kế hoạch; ở kế hoạch nháp (giá kế hoạch chưa là quyết định); ở kế hoạch đã duyệt (dòng thứ hai bỏ).
        line(proposal("PENDING", null, YEAR), 1, catalog, 10, null, "100");
        long draft = proposal("APPROVED", plan("DRAFT", YEAR), YEAR);
        line(draft, 1, catalog, 5, 3, "100");
        jdbc.update("UPDATE purchase_proposal_lines SET planned_unit_price = 200 WHERE proposal_id = ?", draft);
        long done = proposal("COMPLETED", plan("APPROVED", YEAR), YEAR);
        line(done, 1, catalog, 4, 2, "100");
        line(done, 2, other, 6, 0, "100");
        jdbc.update("UPDATE purchase_proposal_lines SET planned_unit_price = 150 WHERE proposal_id = ? AND line_no = 1",
                done);

        signIn(soUsername);
        ProcurementPlanService.Summary s = plans.summary(YEAR, body);
        assertThat(s.bodies()).hasSize(1);
        ProcurementPlanService.BodyTotal b = s.bodies().get(0);
        assertThat(b.proposals()).isEqualTo(3);
        assertThat(b.pending()).isEqualTo(1);
        assertThat(b.approved()).isEqualTo(2);
        // "Đã vào kế hoạch": cả đề xuất đang ở kế hoạch nháp.
        assertThat(b.planned()).isEqualTo(2);
        // Đề nghị × giá: 10×100 + 5×100 (kế hoạch nháp: giá trường) + 4×150 + 6×100.
        assertThat(b.amount()).isEqualByComparingTo(new BigDecimal("2700"));
        // Số vào kế hoạch × giá: 3×100 + 2×150 + 0.
        assertThat(b.approvedAmount()).isEqualByComparingTo(new BigDecimal("600"));
        // Thiết bị cần mua: 10 + 3 + 2; dòng bỏ (0) không thành thiết bị cần mua.
        assertThat(s.catalogs()).hasSize(1);
        assertThat(s.catalogs().get(0).catalogId()).isEqualTo(catalog);
        assertThat(s.catalogs().get(0).quantity()).isEqualTo(15);
        assertThat(s.catalogs().get(0).amount()).isEqualByComparingTo(new BigDecimal("1600"));
    }

    @Test
    void planTotalsSkipSchoolsWhoseLineWasCut() {
        List<Long> second = jdbc.queryForList("SELECT id FROM schools WHERE department_of_education_id = ? AND id <> ?"
                + " ORDER BY id LIMIT 1", Long.class, body, school);
        Assumptions.assumeTrue(!second.isEmpty(), "Cơ quan chỉ quản lý một trường");
        long plan = plan("DRAFT", YEAR);
        line(proposal("APPROVED", plan, YEAR), 1, catalog, 4, 2, "100");
        long cut = jdbc.queryForObject("INSERT INTO purchase_proposals (school_id, proposal_date, budget_year, status,"
                + " plan_id, created_at) VALUES (?, CURRENT_DATE, ?, 'APPROVED', ?, now()) RETURNING id", Long.class,
                second.get(0), YEAR, plan);
        line(cut, 1, catalog, 3, 0, "100");

        signIn(soUsername);
        List<ProcurementPlanService.CatalogTotal> totals = plans.detail(plan).totals();
        assertThat(totals).hasSize(1);
        assertThat(totals.get(0).quantity()).isEqualTo(2);
        assertThat(totals.get(0).schools()).isEqualTo(1);
    }

    @Test
    void proposedQuantityFollowsThePlanAndWhatArrived() {
        long done = proposal("COMPLETED", plan("APPROVED", YEAR), YEAR);
        line(done, 1, catalog, 10, 6, null);
        line(done, 2, other, 4, 0, null);
        intake(done, "COMPLETED", 4);
        intake(done, "DRAFT", 1);
        line(proposal("PENDING", null, YEAR), 1, catalog, 3, null, null);

        Map<Long, Integer> proposed = new HashMap<>();
        jdbc.query(ProposedQuantity.sql("'PENDING', 'APPROVED', 'COMPLETED'",
                " AND p.school_id = " + school + " AND p.budget_year = " + YEAR), rs -> {
            proposed.put(rs.getLong("catalog_id"), rs.getInt("n"));
        });
        // Kế hoạch đưa 6, đã lên sổ 4 (phiếu nháp chưa trừ) → còn 2; cộng đề xuất đang chờ duyệt 3. Dòng bỏ không tính.
        assertThat(proposed).containsEntry(catalog, 5).doesNotContainKey(other);
    }

    // ------------------------------------------------------------------ #4 năm ngân sách

    @Test
    void planTakesOnlyProposalsOfItsBudgetYear() {
        long plan = plan("DRAFT", YEAR);
        long same = proposal("APPROVED", null, YEAR);
        line(same, 1, catalog, 2, null, "100");
        long earlier = proposal("APPROVED", null, YEAR - 1);
        line(earlier, 1, catalog, 2, null, "100");

        signIn(soUsername);
        List<Long> candidates = plans.candidates(plan, null).stream().map(PurchaseProposal::getId).toList();
        assertThat(candidates).contains(same).doesNotContain(earlier);
        assertThatThrownBy(() -> plans.setProposals(plan, List.of(earlier)))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("cùng năm ngân sách");
        plans.setProposals(plan, List.of(same));
        em.flush();
        assertThat(jdbc.queryForObject("SELECT plan_id FROM purchase_proposals WHERE id = ?", Long.class, same))
                .isEqualTo(plan);
    }

    // ------------------------------------------------------------------ #3 ngưỡng tiền của luồng duyệt

    @Test
    void amountIsUnknownWhenALineHasNoPrice() {
        PurchaseProposal p = new PurchaseProposal();
        PurchaseProposalLine priced = new PurchaseProposalLine();
        priced.setQuantity(2);
        priced.setUnitPrice(new BigDecimal("1000"));
        p.replaceLines(List.of(priced));
        assertThat(p.approvalAmount()).isEqualByComparingTo(new BigDecimal("2000"));
        // Bỏ trống giá một dòng: số tiền chưa biết (null) — luồng duyệt coi như từ ngưỡng trở lên, không phải 2.000 đ.
        PurchaseProposalLine unpriced = new PurchaseProposalLine();
        unpriced.setQuantity(50);
        p.replaceLines(List.of(priced, unpriced));
        assertThat(p.approvalAmount()).isNull();
    }

    // ------------------------------------------------------------------ dữ liệu thử

    private long plan(String status, int year) {
        return jdbc.queryForObject("INSERT INTO procurement_plans (managing_body_id, code, plan_date, title, budget_year,"
                + " status, created_at) VALUES (?, ?, CURRENT_DATE, 'Thử', ?, ?, now()) RETURNING id", Long.class, body,
                "THU-" + year + "-" + (++codes) + "-" + System.nanoTime(), year, status);
    }

    private long proposal(String status, Long plan, int year) {
        return jdbc.queryForObject("INSERT INTO purchase_proposals (school_id, proposal_date, budget_year, status, plan_id,"
                + " created_by_id, created_at) VALUES (?, CURRENT_DATE, ?, ?, ?, ?, now()) RETURNING id", Long.class,
                school, year, status, plan, schoolUser);
    }

    private void line(long proposal, int no, long catalogId, int quantity, Integer planned, String price) {
        jdbc.update("INSERT INTO purchase_proposal_lines (proposal_id, line_no, catalog_id, name, quantity, planned_quantity,"
                + " unit_price) VALUES (?, ?, ?, 'Thử', ?, ?, ?)", proposal, no, catalogId, quantity, planned,
                price == null ? null : new BigDecimal(price));
    }

    private void intake(long proposal, String status, int quantity) {
        Long id = jdbc.queryForObject("INSERT INTO equipment_intakes (school_id, code, intake_date, status, confirmed_at,"
                + " source_resource, source_id, created_at) VALUES (?, ?, CURRENT_DATE, ?, now(), 'purchase_proposals', ?, now())"
                + " RETURNING id", Long.class, school, "THU-" + status + "-" + System.nanoTime(), status, proposal);
        jdbc.update("INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name, document_quantity,"
                + " received_quantity, created_at) VALUES (?, 1, ?, 'Thử', ?, ?, now())", id, catalog, quantity, quantity);
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
