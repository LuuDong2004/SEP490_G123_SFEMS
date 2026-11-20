package com.g123.sfems.module.school.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.ConflictException;
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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/** Phân công giáo viên theo năm học (277): ghi kép sang hồ sơ cho năm hiện tại, một dòng mỗi cán bộ mỗi năm. */
@SpringBootTest
@Transactional
class StaffAssignmentTest {

    @Autowired
    StaffAssignmentService assignments;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    @BeforeEach
    void signIn() {
        User user = users.findByUsernameOrEmail("thcs.canbo").orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo thcs.canbo");
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token)));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void currentYearAssignmentIsMirroredToTheStaffRecord() {
        List<StaffAssignmentService.Assignment> list = assignments.list(null, null, null, null, null);
        Assumptions.assumeTrue(!list.isEmpty(), "Trường mẫu chưa có giáo viên");
        StaffAssignmentService.Assignment a = list.get(0);
        Long other = jdbc.queryForObject("SELECT id FROM subjects WHERE id <> ? ORDER BY id LIMIT 1", Long.class,
                a.mainSubject() == null ? -1L : a.mainSubject().id());
        StaffAssignmentService.Assignment saved = assignments.update(a.id(),
                new StaffAssignmentService.Input(null, null, null, new IdRef(other), List.of(), null));
        assertThat(saved.mainSubject().id()).isEqualTo(other);
        assertThat(saved.subjects()).extracting(StaffAssignmentService.Ref::id).containsExactly(other);
        Map<String, Object> staff = jdbc.queryForMap("SELECT main_subject_id FROM staff WHERE id = ?", a.staffId());
        assertThat(((Number) staff.get("main_subject_id")).longValue()).isEqualTo(other);
        assertThat(jdbc.queryForList("SELECT subject_id FROM staff_subjects WHERE staff_id = ?", Long.class, a.staffId()))
                .containsExactly(other);
    }

    @Test
    void oneAssignmentPerStaffPerYear() {
        List<StaffAssignmentService.Assignment> list = assignments.list(null, null, null, null, null);
        Assumptions.assumeTrue(!list.isEmpty(), "Trường mẫu chưa có giáo viên");
        StaffAssignmentService.Assignment a = list.get(0);
        assertThatThrownBy(() -> assignments.create(new StaffAssignmentService.Input(new IdRef(a.schoolYearId()),
                new IdRef(a.staffId()), null, a.mainSubject() == null ? null : new IdRef(a.mainSubject().id()), null,
                null))).isInstanceOf(ConflictException.class);
    }

    @Test
    void pastYearAssignmentDoesNotTouchTheStaffRecord() {
        List<StaffAssignmentService.Assignment> list = assignments.list(null, null, null, null, null);
        Assumptions.assumeTrue(!list.isEmpty(), "Trường mẫu chưa có giáo viên");
        StaffAssignmentService.Assignment a = list.get(0);
        Long past = jdbc.queryForObject("SELECT id FROM school_years WHERE NOT is_current ORDER BY start_date DESC LIMIT 1",
                Long.class);
        Long before = jdbc.queryForObject("SELECT main_subject_id FROM staff WHERE id = ?", Long.class, a.staffId());
        Long other = jdbc.queryForObject("SELECT id FROM subjects WHERE id <> ? ORDER BY id LIMIT 1", Long.class,
                before == null ? -1L : before);
        assignments.create(new StaffAssignmentService.Input(new IdRef(past), new IdRef(a.staffId()), null,
                new IdRef(other), null, null));
        assertThat(jdbc.queryForObject("SELECT main_subject_id FROM staff WHERE id = ?", Long.class, a.staffId()))
                .isEqualTo(before);
        assertThat(assignments.list(null, past, null, null, null)).extracting(StaffAssignmentService.Assignment::staffId)
                .contains(a.staffId());
    }
}
