package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.module.school.voucher.VoucherApprovers;
import com.g123.sfems.module.system.approvalflow.ApprovalFlowService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.JwtService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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
 * Luồng đề xuất mua sắm THPT – Sở (BF-01, NC-02 – NC-07) với tài khoản thử thật: cán bộ thiết bị lập và trình, lãnh đạo
 * trường duyệt, lãnh đạo Sở duyệt, chuyên viên Sở đưa vào kế hoạch và trình, lãnh đạo Sở duyệt kế hoạch thì đề xuất hoàn
 * tất, trường lập phiếu ghi tăng khi hàng về. Chạy trong một giao dịch rồi rollback — không để lại phiếu.
 */
@SpringBootTest
@Transactional
class ProposalApprovalFlowTest {

    /** Tài khoản thật chọn theo quyền và cấp (xem {@link #pick}) — tên in ra đầu mỗi lần chạy. */
    String CANBO;
    String HIEUTRUONG;
    String SO_LANHDAO;
    String SO_CHUYENVIEN;
    /**
     * Năm ngân sách xa nhất đề xuất được phép (năm nay + 5, PurchaseProposalService.BUDGET_YEAR_AHEAD) — chưa có dữ
     * liệu thật, để kế hoạch thử không đụng kế hoạch đang có.
     */
    private static final int YEAR = LocalDate.now().getYear() + 5;

    @Autowired
    PurchaseProposalService proposals;

    @Autowired
    ApprovalFlowService flows;

    @Autowired
    VoucherApprovers approvers;

    @Autowired
    ProcurementPlanService plans;

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
    long catalog;

    @BeforeEach
    void pick() {
        // Trường có Sở quản lý, có cán bộ lập đề xuất và lãnh đạo duyệt (cả trường, không riêng cơ sở). Ưu tiên THPT.
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT s.id AS school, s.department_of_education_id AS body,
                  (SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id
                    WHERE us.school_id = s.id AND us.campus_id IS NULL
                      AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
                                  JOIN permissions p ON p.id = rp.permission_id
                                  WHERE ur.user_id = u.id AND p.code = 'purchase_proposals:write')
                    ORDER BY u.id LIMIT 1) AS canbo,
                  (SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id
                    WHERE us.school_id = s.id AND us.campus_id IS NULL
                      AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
                                  JOIN permissions p ON p.id = rp.permission_id
                                  WHERE ur.user_id = u.id AND p.code = 'purchase_proposals:approve')
                    ORDER BY u.id LIMIT 1) AS hieutruong
                FROM schools s WHERE s.department_of_education_id IS NOT NULL
                ORDER BY (s.name ILIKE '%THPT%') DESC, s.id""");
        Map<String, Object> row = rows.stream().filter(r -> r.get("canbo") != null && r.get("hieutruong") != null)
                .findFirst().orElse(null);
        Assumptions.assumeTrue(row != null, "Thiếu trường có cán bộ và lãnh đạo");
        school = ((Number) row.get("school")).longValue();
        long body = ((Number) row.get("body")).longValue();
        CANBO = (String) row.get("canbo");
        HIEUTRUONG = (String) row.get("hieutruong");
        SO_LANHDAO = soWith(body, "purchase_proposals:approve");
        // Lãnh đạo Sở cũng lập được kế hoạch (303): chuyên viên là người lập kế hoạch mà KHÔNG duyệt đề xuất.
        SO_CHUYENVIEN = soWith(body, "procurement_plans:write", "purchase_proposals:approve");
        Assumptions.assumeTrue(SO_LANHDAO != null && SO_CHUYENVIEN != null, "Thiếu tài khoản Sở");
        System.out.printf("[luong-de-xuat] truong=%d %s / %s, so=%s / %s%n", school, CANBO, HIEUTRUONG, SO_LANHDAO,
                SO_CHUYENVIEN);
        jdbc.queryForList("""
                SELECT u.username, string_agg(DISTINCT p.code, ' ' ORDER BY p.code) AS codes FROM users u
                JOIN user_sos x ON x.id = u.id JOIN user_roles ur ON ur.user_id = u.id
                JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
                WHERE x.managing_body_id = ? AND (p.code LIKE 'purchase_proposals:%' OR p.code LIKE 'procurement_plans:%')
                GROUP BY u.username ORDER BY u.username""", body)
                .forEach(r -> System.out.printf("[luong-de-xuat] %s: %s%n", r.get("username"), r.get("codes")));
        List<Long> catalogs = jdbc.queryForList("""
                SELECT c.id FROM equipment_catalogs c JOIN schools s ON s.id = ?
                WHERE c.owner_school_id IS NULL AND c.education_level_id = s.education_level_id
                ORDER BY c.id LIMIT 1""", Long.class, school);
        Assumptions.assumeTrue(!catalogs.isEmpty(), "Thiếu thiết bị trong danh mục cấp THPT");
        catalog = catalogs.get(0);
        // Đề xuất trình được cả khi năm học chưa chốt (MSG53); bỏ chặn khác (nếu có) không phải việc của test này.
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void luongCoDinhTruongRoiSo() {
        assertThat(flows.stepsOf("purchase_proposals")).as("luồng đề xuất")
                .contains(List.of(ApprovalStep.SCHOOL, ApprovalStep.MANAGING_BODY));
        // Quản trị viên không đổi được luồng đề xuất, cũng không khôi phục về gì khác.
        assertThatThrownBy(() -> flows.save("purchase_proposals",
                new ApprovalFlowService.FlowRequest(List.of(ApprovalStep.SCHOOL), null)))
                .isInstanceOf(FieldValidationException.class);
        assertThatThrownBy(() -> flows.reset("purchase_proposals")).isInstanceOf(FieldValidationException.class);
        // Dòng cấu hình cũ (nếu còn) không được làm đổi luồng.
        jdbc.update("INSERT INTO approval_flows (resource, steps, created_at) VALUES ('purchase_proposals', 'SCHOOL', now())"
                + " ON CONFLICT (resource) DO UPDATE SET steps = 'SCHOOL'");
        assertThat(flows.stepsOf("purchase_proposals")).contains(List.of(ApprovalStep.SCHOOL, ApprovalStep.MANAGING_BODY));
    }

    @Test
    void quyenDungVai() {
        assertThat(has(CANBO, "purchase_proposals:write")).as("cán bộ lập đề xuất").isTrue();
        assertThat(has(CANBO, "purchase_proposals:approve")).as("cán bộ không duyệt").isFalse();
        assertThat(has(HIEUTRUONG, "purchase_proposals:approve")).as("hiệu trưởng duyệt").isTrue();
        assertThat(has(HIEUTRUONG, "purchase_proposals:write")).as("hiệu trưởng không lập").isFalse();
        assertThat(has(SO_LANHDAO, "purchase_proposals:approve")).as("lãnh đạo Sở duyệt đề xuất").isTrue();
        assertThat(has(SO_CHUYENVIEN, "purchase_proposals:approve")).as("chuyên viên Sở không duyệt đề xuất").isFalse();
        assertThat(has(SO_CHUYENVIEN, "procurement_plans:write")).as("chuyên viên lập kế hoạch").isTrue();
        assertThat(has(SO_CHUYENVIEN, "procurement_plans:approve")).as("chuyên viên không duyệt kế hoạch").isFalse();
        assertThat(has(SO_LANHDAO, "procurement_plans:approve")).as("lãnh đạo Sở duyệt kế hoạch").isTrue();
        // Lãnh đạo Sở lập được kế hoạch và tự duyệt kế hoạch mình lập (303) — kế hoạch là việc nội bộ của Sở.
        assertThat(has(SO_LANHDAO, "procurement_plans:write")).as("lãnh đạo Sở lập kế hoạch").isTrue();
    }

    @Test
    void troiTronLuong() {
        long id = submitted();
        PurchaseProposal p = proposals.get(id);
        assertThat(p.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(p.getApprovalStep()).as("trình xong chờ lãnh đạo trường").isEqualTo(ApprovalStep.SCHOOL);
        assertThat(p.getCode()).startsWith("MS");
        var waiting = approvers.current("purchase_proposals", id);
        assertThat(waiting.pending()).isTrue();
        assertThat(waiting.people()).as("người duyệt lúc chờ trường").extracting(VoucherApprovers.Person::name).contains(nameOf(HIEUTRUONG));

        // Sở chưa duyệt được khi phiếu còn ở bước trường — Sở chỉ thấy đề xuất đã trình tới mình, nên phiếu "không tìm thấy".
        signIn(SO_LANHDAO);
        assertThatThrownBy(() -> proposals.approve(id, null)).isInstanceOf(ResourceNotFoundException.class);

        signIn(HIEUTRUONG);
        proposals.approve(id, "Đồng ý");
        p = reload(id);
        assertThat(p.getStatus()).isEqualTo(VoucherStatus.PENDING);
        assertThat(p.getApprovalStep()).as("trường duyệt xong chờ Sở").isEqualTo(ApprovalStep.MANAGING_BODY);
        assertThat(approvers.current("purchase_proposals", id).people()).as("người duyệt lúc chờ Sở")
                .extracting(VoucherApprovers.Person::name).contains(nameOf(SO_LANHDAO)).doesNotContain(nameOf(HIEUTRUONG));
        // Trường đã duyệt xong bước của mình, không duyệt thêm bước Sở.
        assertThatThrownBy(() -> proposals.approve(id, null)).isInstanceOf(FieldValidationException.class);

        signIn(SO_LANHDAO);
        proposals.approve(id, "Đồng ý đưa vào kế hoạch");
        p = reload(id);
        assertThat(p.getStatus()).as("Sở duyệt xong").isEqualTo(VoucherStatus.APPROVED);
        assertThat(p.getApprovalStep()).isNull();
        var decided = approvers.current("purchase_proposals", id);
        assertThat(decided.pending()).isFalse();
        assertThat(decided.people()).as("đã duyệt bởi").extracting(VoucherApprovers.Person::name)
                .containsExactly(nameOf(HIEUTRUONG), nameOf(SO_LANHDAO));

        // Chuyên viên Sở gom vào kế hoạch, đặt giá, trình.
        signIn(SO_CHUYENVIEN);
        PurchaseProposalLine line = p.getLines().get(0);
        ProcurementPlan plan = plans.create(new ProcurementPlanService.Input(null, "Kế hoạch thử " + YEAR, YEAR, null,
                LocalDate.now(), null, List.of(new ProcurementPlanService.LineQuantity(line.getId(), 2,
                        new BigDecimal("1500000"))), null));
        // Lập và trình là hai request riêng khi chạy thật; ở đây cùng giao dịch nên đẩy xuống CSDL (trình kiểm giá bằng SQL).
        em.flush();
        plans.submit(plan.getId());
        assertThat(plans.get(plan.getId()).getStatus()).isEqualTo(ProcurementPlan.Status.PENDING);
        assertThat(reload(id).getStatus()).as("đề xuất chờ kế hoạch được duyệt").isEqualTo(VoucherStatus.APPROVED);

        signIn(SO_LANHDAO);
        plans.approve(plan.getId(), null);
        p = reload(id);
        assertThat(p.getStatus()).as("kế hoạch duyệt thì đề xuất hoàn tất").isEqualTo(VoucherStatus.COMPLETED);
        assertThat(p.getLines().get(0).effectiveQuantity()).isEqualTo(2);

        // Hàng về: trường lập phiếu ghi tăng nháp từ đề xuất.
        signIn(CANBO);
        EquipmentIntake intake = proposals.createIntake(id, null);
        assertThat(intake.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(intake.getFundingSource()).isEqualTo(FundingSource.STATE_BUDGET);
    }

    @Test
    void traLaiThiVeNhapGiuSoVaDuyetLaiTuDau() {
        long id = submitted();
        String code = proposals.get(id).getCode();
        // Đã trình: không thêm, không xoá được tệp đính kèm.
        assertThatThrownBy(() -> proposals.checkAttachmentsEditable(id)).isInstanceOf(FieldValidationException.class);
        signIn(HIEUTRUONG);
        proposals.approve(id, null);
        signIn(SO_LANHDAO);
        assertThatThrownBy(() -> proposals.returnToDraft(id, " ")).isInstanceOf(FieldValidationException.class);
        proposals.returnToDraft(id, "Bổ sung lý do đề xuất");
        PurchaseProposal p = reload(id);
        assertThat(p.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(p.getCode()).isEqualTo(code);

        signIn(CANBO);
        // Bị trả về nháp: người lập thêm, xoá được tệp.
        proposals.checkAttachmentsEditable(id);
        proposals.submit(id);
        p = reload(id);
        assertThat(p.getCode()).isEqualTo(code);
        assertThat(p.getApprovalStep()).as("trình lại duyệt lại từ bước trường").isEqualTo(ApprovalStep.SCHOOL);
    }

    @Test
    void biTraVeThiNguoiLapHuyDuoc() {
        long id = submitted();
        signIn(HIEUTRUONG);
        proposals.returnToDraft(id, "Không cần nữa");
        signIn(CANBO);
        assertThat(proposals.actions(reload(id), java.util.Map.of("write", true), false)).contains("cancel");
        proposals.cancel(id, "Trường không xin nữa");
        PurchaseProposal p = reload(id);
        assertThat(p.getStatus()).isEqualTo(VoucherStatus.CANCELLED);
        assertThat(p.getCancelReason()).isEqualTo("Trường không xin nữa");
    }

    @Test
    void soTuChoiThiDungHan() {
        long id = submitted();
        signIn(HIEUTRUONG);
        proposals.approve(id, null);
        signIn(SO_LANHDAO);
        assertThatThrownBy(() -> proposals.reject(id, null)).isInstanceOf(FieldValidationException.class);
        proposals.reject(id, "Không đủ ngân sách");
        assertThat(reload(id).getStatus()).isEqualTo(VoucherStatus.REJECTED);
    }

    /** Cán bộ thiết bị lập và trình một đề xuất một dòng, chưa ghi giá. */
    private long submitted() {
        signIn(CANBO);
        PurchaseProposal created = proposals.create(new PurchaseProposalApi.Request(new IdRef(school),
                LocalDate.now(), YEAR, "Thiếu so với định mức", null,
                List.of(new PurchaseProposalApi.LineInput(new IdRef(catalog), PurchaseProposalLine.Kind.NEW, null, null,
                        3, null, null, null)), null), new IdRef(school));
        proposals.submit(created.getId());
        return created.getId();
    }

    private PurchaseProposal reload(long id) {
        em.flush();
        em.clear();
        return proposals.get(id);
    }

    /** Tài khoản Sở của cơ quan {@code body} có mã quyền đó, ưu tiên tên so.*. */
    private String soWith(long body, String permission) {
        return soWith(body, permission, null);
    }

    /** Như trên, và KHÔNG có mã quyền {@code without} (vd. chuyên viên: lập kế hoạch mà không duyệt đề xuất). */
    private String soWith(long body, String permission, String without) {
        List<String> names = jdbc.queryForList("""
                SELECT u.username FROM users u JOIN user_sos x ON x.id = u.id
                WHERE x.managing_body_id = ? AND EXISTS (SELECT 1 FROM user_roles ur
                  JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
                  WHERE ur.user_id = u.id AND p.code = ?)
                  AND NOT EXISTS (SELECT 1 FROM user_roles ur
                  JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
                  WHERE ur.user_id = u.id AND p.code = ?)
                ORDER BY (u.username LIKE 'so.%') DESC, u.id LIMIT 1""", String.class, body, permission,
                without == null ? "" : without);
        return names.isEmpty() ? null : names.get(0);
    }

    private String nameOf(String username) {
        return jdbc.queryForObject("SELECT COALESCE(NULLIF(full_name, ''), username) FROM users WHERE username = ?",
                String.class, username);
    }

    private boolean has(String username, String permission) {
        Integer n = jdbc.queryForObject("""
                SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id
                JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
                WHERE u.username = ? AND p.code = ?""", Integer.class, username, permission);
        return n != null && n > 0;
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
