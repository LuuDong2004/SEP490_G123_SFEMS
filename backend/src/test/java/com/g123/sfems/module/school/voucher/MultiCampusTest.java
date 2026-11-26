package com.g123.sfems.module.school.voucher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.security.user.SchoolUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.school.procurement.PurchaseProposalService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.user.service.SchoolUserService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Trường nhiều cơ sở: lãnh đạo một cơ sở chỉ duyệt phiếu chỉ chạm cơ sở mình, phiếu chạm nhiều cơ sở để lãnh đạo cả
 * trường duyệt; người quản lý một cơ sở chỉ cấp, xem tài khoản của cơ sở mình; đề xuất mua sắm mang cơ sở của người lập.
 */
@SpringBootTest
@Transactional
// Giả người gọi bằng spy dựng thêm một ngữ cảnh Spring riêng: đóng ngay sau lớp này, không giữ thêm kết nối CSDL.
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MultiCampusTest {

    @MockitoSpyBean
    RowLevelPrincipalResolver principals;

    @Autowired
    VoucherWorkflow workflow;

    @Autowired
    VoucherCampus campus;

    @Autowired
    SchoolUserService schoolUsers;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    EntityManager em;

    long school;
    long main;
    long branch;
    long roomMain;
    long roomBranch;

    @BeforeEach
    void setUp() {
        List<Long> schools = jdbc.queryForList("SELECT s.id FROM schools s WHERE EXISTS (SELECT 1 FROM campuses c"
                + " WHERE c.school_id = s.id AND c.is_primary AND c.active) AND (SELECT COUNT(*) FROM rooms r"
                + " WHERE r.school_id = s.id) >= 2 AND (SELECT COUNT(*) FROM user_schools us WHERE us.school_id = s.id) >= 2"
                + " ORDER BY s.id LIMIT 1", Long.class);
        Assumptions.assumeTrue(!schools.isEmpty(), "Thiếu trường có cơ sở chính, hai phòng, hai tài khoản");
        school = schools.get(0);
        main = jdbc.queryForObject("SELECT id FROM campuses WHERE school_id = ? AND is_primary AND active"
                + " ORDER BY id LIMIT 1", Long.class, school);
        branch = jdbc.queryForObject("INSERT INTO campuses (school_id, code, name, active, is_primary, branch,"
                + " created_at) VALUES (?, 'THU-CS2', 'Cơ sở thử', TRUE, FALSE, TRUE, now()) RETURNING id", Long.class,
                school);
        List<Long> rooms = jdbc.queryForList("SELECT id FROM rooms WHERE school_id = ? ORDER BY id LIMIT 2", Long.class,
                school);
        roomMain = rooms.get(0);
        roomBranch = rooms.get(1);
        jdbc.update("UPDATE rooms SET campus_id = ? WHERE id = ?", main, roomMain);
        jdbc.update("UPDATE rooms SET campus_id = ? WHERE id = ?", branch, roomBranch);
        em.flush();
        em.clear();
    }

    @Test
    void campusLeaderApprovesOnlyVouchersOfTheirOwnCampus() {
        PurchaseProposal own = proposal(branch);
        PurchaseProposal mainOnly = proposal(null);
        EquipmentIntake both = intake(roomMain, roomBranch);
        assertThat(campus.touchedCampuses(own)).containsExactly(branch);
        assertThat(campus.touchedCampuses(mainOnly)).containsExactly(main);
        assertThat(campus.touchedCampuses(both)).containsExactlyInAnyOrder(main, branch);

        as(branch);
        assertThat(workflow.inTier(own)).isTrue();
        assertThat(workflow.inTier(mainOnly)).isFalse();
        assertThat(workflow.inTier(both)).as("phiếu chạm hai cơ sở").isFalse();

        as(main);
        assertThat(workflow.inTier(own)).isFalse();
        assertThat(workflow.inTier(mainOnly)).isTrue();
        assertThat(workflow.inTier(both)).isFalse();

        as(null);
        assertThat(workflow.inTier(own)).isTrue();
        assertThat(workflow.inTier(both)).as("lãnh đạo cả trường").isTrue();
    }

    @Test
    void branchStaffCanKeepTheirOwnProposal() {
        as(branch);
        // Trước đây đề xuất không phòng, không thiết bị luôn thuộc cơ sở chính: cơ sở phụ lập là bị từ chối.
        campus.requireWritable(PurchaseProposalService.CAMPUS, proposal(branch), Set.of());
        assertThatThrownBy(() -> campus.requireWritable(PurchaseProposalService.CAMPUS, proposal(null), Set.of()))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void campusManagerOnlyGrantsAndSeesAccountsOfTheirCampus() {
        List<Long> members = jdbc.queryForList("SELECT id FROM user_schools WHERE school_id = ? ORDER BY id LIMIT 2",
                Long.class, school);
        User mine = em.find(User.class, members.get(0));
        as(branch);
        assertThatThrownBy(() -> schoolUsers.assignCampus(mine, null)).isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("cơ sở của mình");
        assertThatThrownBy(() -> schoolUsers.assignCampus(mine, main)).isInstanceOf(FieldValidationException.class);
        schoolUsers.assignCampus(mine, branch);
        em.flush();
        jdbc.update("UPDATE user_schools SET campus_id = NULL WHERE id = ?", members.get(1));
        em.clear();

        assertThat(schoolUsers.get(members.get(0)).getId()).isEqualTo(members.get(0));
        assertThatThrownBy(() -> schoolUsers.get(members.get(1))).isInstanceOf(ResourceNotFoundException.class);
        List<User> listed = schoolUsers.list(new ListParams(new LinkedMultiValueMap<>())).getContent();
        assertThat(listed).isNotEmpty()
                .allSatisfy(u -> assertThat(((SchoolUser) u).getCampus().getId()).isEqualTo(branch));
    }

    /** Người gọi là lãnh đạo của trường thử; {@code campusId} trống = quản lý cả trường. */
    private void as(Long campusId) {
        Set<Long> roles = Set.copyOf(jdbc.queryForList("SELECT id FROM roles WHERE code = 'SCHOOL_LEADER'", Long.class));
        doReturn(Optional.of(new RowLevelPrincipal(-1L, school, null, campusId, Set.of("SCHOOL_LEADER"), roles)))
                .when(principals).current();
    }

    private PurchaseProposal proposal(Long campusId) {
        PurchaseProposal p = new PurchaseProposal();
        p.setSchool(em.find(School.class, school));
        p.setApprovalStep(ApprovalStep.SCHOOL);
        p.setCampus(campusId == null ? null : em.find(Campus.class, campusId));
        return p;
    }

    private EquipmentIntake intake(long... rooms) {
        EquipmentIntake intake = new EquipmentIntake();
        intake.setSchool(em.find(School.class, school));
        intake.setApprovalStep(ApprovalStep.SCHOOL);
        List<EquipmentIntakeLine> lines = new ArrayList<>();
        int no = 1;
        for (long room : rooms) {
            EquipmentIntakeLine line = new EquipmentIntakeLine();
            line.setLineNo(no++);
            line.setRoom(em.find(Room.class, room));
            lines.add(line);
        }
        intake.replaceLines(lines);
        return intake;
    }
}
