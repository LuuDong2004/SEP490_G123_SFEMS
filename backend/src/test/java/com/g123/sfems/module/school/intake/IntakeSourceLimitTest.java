package com.g123.sfems.module.school.intake;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
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
 * Phiếu ghi tăng lập từ phiếu nguồn (đề xuất trong kế hoạch được duyệt, biên bản kiểm kê) chỉ ghi tăng đúng thiết bị và
 * số còn lại của phiếu nguồn — kiểm ở lần sửa nháp và lúc trình, không chỉ lúc lập nháp. Nguồn "Kiểm kê thừa" phải đi
 * từ một biên bản kiểm kê đã duyệt. Tệp đính kèm chỉ thêm / xoá được khi phiếu còn nháp.
 */
@SpringBootTest
@Transactional
class IntakeSourceLimitTest {

    @Autowired
    EquipmentIntakeService intakes;

    @Autowired
    EquipmentIntakeLineAccess lineAccess;

    @Autowired
    EquipmentIntakeDocumentAccess documentAccess;

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
        // Cán bộ trường có quyền lập phiếu ghi tăng, không bị giới hạn trong một cơ sở; ưu tiên tài khoản demo thcs.canbo.
        List<String> staff = jdbc.queryForList("SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id"
                + " WHERE u.user_type = 'SCHOOL' AND us.campus_id IS NULL AND EXISTS (SELECT 1 FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = u.id AND p.code = 'equipment_intakes:write')"
                + " ORDER BY (u.username = 'thcs.canbo') DESC, u.id LIMIT 1", String.class);
        Assumptions.assumeTrue(!staff.isEmpty(), "Thiếu tài khoản cán bộ trường");
        school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = ?", Long.class, staff.get(0));
        // Thiết bị dùng chung, đúng cấp học của trường (như ô chọn thiết bị của phiếu).
        List<Long> catalogs = jdbc.queryForList("SELECT c.id FROM equipment_catalogs c JOIN schools s ON s.id = ?"
                + " WHERE c.owner_school_id IS NULL AND c.active AND (c.education_level_id IS NULL"
                + " OR s.education_level_id IS NULL OR c.education_level_id = s.education_level_id"
                + " OR EXISTS (SELECT 1 FROM equipment_catalog_levels l WHERE l.catalog_id = c.id"
                + " AND l.education_level_id = s.education_level_id))"
                + " ORDER BY c.id LIMIT 2", Long.class, school);
        Assumptions.assumeTrue(catalogs.size() == 2, "Thiếu danh mục thiết bị");
        catalog = catalogs.get(0);
        other = catalogs.get(1);
        signIn(staff.get(0));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------ 1. Số theo kế hoạch

    @Test
    void editingAPlanDraftBeyondThePlanIsRejected() {
        long proposal = proposal("COMPLETED");
        // Trường xin 12, kế hoạch duyệt 10.
        proposalLine(proposal, 1, catalog, 12, 10);
        long draft = intake("DRAFT", "MUA_SAM", "purchase_proposals", proposal);
        intakeLine(draft, 1, catalog, 10);

        assertThatThrownBy(() -> intakes.update(draft, patch(line(catalog, 50))))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("còn 10 chưa nhập")
                .hasMessageContaining("ghi nhận 50");
        // Đúng số kế hoạch thì lưu được.
        assertThatCode(() -> intakes.update(draft, patch(line(catalog, 10)))).doesNotThrowAnyException();
    }

    @Test
    void catalogOutsideThePlanIsRejected() {
        long proposal = proposal("COMPLETED");
        proposalLine(proposal, 1, catalog, 10, null);
        long draft = intake("DRAFT", "MUA_SAM", "purchase_proposals", proposal);
        intakeLine(draft, 1, catalog, 10);

        // Thêm dòng ngoài kế hoạch.
        assertThatThrownBy(() -> intakes.update(draft, patch(line(catalog, 10), line(other, 1))))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("không có trong kế hoạch");
        // Đổi thiết bị của dòng sang thiết bị ngoài kế hoạch (trước đây trả lại số còn lại của thiết bị cũ).
        assertThatThrownBy(() -> intakes.update(draft, patch(line(other, 10))))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("không có trong kế hoạch");
    }

    @Test
    void anotherVoucherOfTheSamePlanHoldsItsShare() {
        long proposal = proposal("COMPLETED");
        proposalLine(proposal, 1, catalog, 10, null);
        intakeLine(intake("DRAFT", "MUA_SAM", "purchase_proposals", proposal), 1, catalog, 6);
        // Phiếu đã huỷ không giữ chỗ.
        intakeLine(intake("CANCELLED", "MUA_SAM", "purchase_proposals", proposal), 1, catalog, 9);
        long draft = intake("DRAFT", "MUA_SAM", "purchase_proposals", proposal);
        intakeLine(draft, 1, catalog, 4);

        assertThatThrownBy(() -> intakes.update(draft, patch(line(catalog, 5))))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("còn 4 chưa nhập");
        assertThatCode(() -> intakes.update(draft, patch(line(catalog, 4)))).doesNotThrowAnyException();
    }

    @Test
    void submitRechecksThePlan() {
        long proposal = proposal("COMPLETED");
        proposalLine(proposal, 1, catalog, 10, null);
        // Số đã nằm sẵn trong nháp (sửa qua đường khác): lúc trình vẫn bị chặn.
        long draft = intake("DRAFT", "MUA_SAM", "purchase_proposals", proposal);
        intakeLine(draft, 1, catalog, 50);

        assertThatThrownBy(() -> intakes.submit(draft))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("còn 10 chưa nhập");
    }

    @Test
    void surplusDraftCannotExceedTheSessionSurplus() {
        long session = session("COMPLETED");
        jdbc.update("INSERT INTO inventory_surplus (session_id, line_no, catalog_id, name, quantity) VALUES (?, 1, ?, 'Thử', 2)",
                session, catalog);
        long draft = intake("DRAFT", "KIEM_KE_THUA", "inventory_sessions", session);
        intakeLine(draft, 1, catalog, 3);

        assertThatThrownBy(() -> intakes.submit(draft))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("còn 2 chưa ghi tăng");
        assertThatThrownBy(() -> intakes.update(draft, patch(line(other, 1))))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("thiết bị thừa");
        assertThatCode(() -> intakes.update(draft, patch(line(catalog, 2)))).doesNotThrowAnyException();
    }

    // ------------------------------------------------------------------ 2. Nguồn "Kiểm kê thừa"

    @Test
    void surplusOriginNeedsAnInventorySession() {
        long manual = intake("DRAFT", "KIEM_KE_THUA", null, null);
        intakeLine(manual, 1, catalog, 1);

        assertThatThrownBy(() -> intakes.submit(manual))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("Kiểm kê thừa");
    }

    @Test
    void surplusOriginNeedsAnApprovedSessionOfTheSameSchool() {
        long pending = session("PENDING");
        jdbc.update("INSERT INTO inventory_surplus (session_id, line_no, catalog_id, name, quantity) VALUES (?, 1, ?, 'Thử', 5)",
                pending, catalog);
        long draft = intake("DRAFT", "KIEM_KE_THUA", "inventory_sessions", pending);
        intakeLine(draft, 1, catalog, 1);
        assertThatThrownBy(() -> intakes.submit(draft))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("chưa được duyệt");

        List<Long> others = jdbc.queryForList("SELECT id FROM schools WHERE id <> ? ORDER BY id LIMIT 1", Long.class, school);
        Assumptions.assumeTrue(!others.isEmpty(), "Chỉ có một trường");
        Long foreign = jdbc.queryForObject("INSERT INTO inventory_sessions (school_id, title, inventory_date, status, created_at)"
                + " VALUES (?, 'Thử', CURRENT_DATE, 'COMPLETED', now()) RETURNING id", Long.class, others.get(0));
        long stolen = intake("DRAFT", "KIEM_KE_THUA", "inventory_sessions", foreign);
        intakeLine(stolen, 1, catalog, 1);
        assertThatThrownBy(() -> intakes.submit(stolen))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("không thuộc trường");
    }

    // ------------------------------------------------------------------ 3. Tệp đính kèm

    @Test
    void attachmentsAreWritableOnlyWhileDraft() {
        long draft = intake("DRAFT", "KHAC", null, null);
        long draftLine = intakeLine(draft, 1, catalog, 1);
        assertThatCode(() -> intakes.checkWritable(draft)).doesNotThrowAnyException();
        assertThatCode(() -> lineAccess.checkWritable(draftLine)).doesNotThrowAnyException();

        long submitted = intake("PENDING", "KHAC", null, null);
        long submittedLine = intakeLine(submitted, 1, catalog, 1);
        long submittedDocument = jdbc.queryForObject("INSERT INTO equipment_intake_documents (intake_id, doc_no, created_at)"
                + " VALUES (?, 1, now()) RETURNING id", Long.class, submitted);
        assertThatThrownBy(() -> intakes.checkWritable(submitted))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("còn nháp");
        assertThatThrownBy(() -> lineAccess.checkWritable(submittedLine)).isInstanceOf(FieldValidationException.class);
        assertThatThrownBy(() -> documentAccess.checkWritable(submittedDocument)).isInstanceOf(FieldValidationException.class);
        // Đọc thì vẫn được.
        assertThatCode(() -> lineAccess.checkReadable(submittedLine)).doesNotThrowAnyException();
    }

    // ------------------------------------------------------------------ dữ liệu thử

    private long proposal(String status) {
        return jdbc.queryForObject("INSERT INTO purchase_proposals (school_id, code, proposal_date, budget_year, status,"
                + " created_at) VALUES (?, ?, CURRENT_DATE, 2099, ?, now()) RETURNING id", Long.class,
                school, "THU-" + System.nanoTime(), status);
    }

    private void proposalLine(long proposal, int no, long catalogId, int quantity, Integer planned) {
        jdbc.update("INSERT INTO purchase_proposal_lines (proposal_id, line_no, catalog_id, name, quantity, planned_quantity)"
                + " VALUES (?, ?, ?, 'Thử', ?, ?)", proposal, no, catalogId, quantity, planned);
    }

    private long session(String status) {
        return jdbc.queryForObject("INSERT INTO inventory_sessions (school_id, code, title, inventory_date, status, created_at)"
                + " VALUES (?, ?, 'Thử', CURRENT_DATE, ?, now()) RETURNING id", Long.class,
                school, "THU-" + System.nanoTime(), status);
    }

    private long intake(String status, String origin, String sourceResource, Long sourceId) {
        return jdbc.queryForObject("INSERT INTO equipment_intakes (school_id, intake_date, status, origin_source_id,"
                + " source_resource, source_id, source_code, created_at)"
                + " VALUES (?, CURRENT_DATE, ?, (SELECT id FROM origin_sources WHERE system_key = ?), ?, ?, ?, now())"
                + " RETURNING id", Long.class, school, status, origin, sourceResource, sourceId,
                sourceResource == null ? null : "THU-NGUON");
    }

    private long intakeLine(long intake, int no, long catalogId, int quantity) {
        return jdbc.queryForObject("INSERT INTO equipment_intake_lines (intake_id, line_no, catalog_id, name,"
                + " document_quantity, received_quantity, created_at) VALUES (?, ?, ?, 'Thử', ?, ?, now()) RETURNING id",
                Long.class, intake, no, catalogId, quantity, quantity);
    }

    /** Sửa nháp chỉ thay các dòng — mọi ô khác để nguyên. */
    private static EquipmentIntakePatchRequest patch(EquipmentIntakeLineInput... lines) {
        return new EquipmentIntakePatchRequest(null, null, null, null, null, null, null, null, null, null, null,
                Arrays.asList(lines), null, null);
    }

    private static EquipmentIntakeLineInput line(long catalogId, int quantity) {
        return new EquipmentIntakeLineInput(new IdRef(catalogId), null, PhysicalDigitalType.PHYSICAL, null,
                quantity, quantity, null, null, null, null,
                null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, null, null, null, null);
    }

    private void signIn(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản " + username);
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
    }
}
