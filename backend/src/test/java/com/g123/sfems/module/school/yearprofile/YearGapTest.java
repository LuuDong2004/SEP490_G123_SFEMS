package com.g123.sfems.module.school.yearprofile;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.school.procurement.PurchaseProposalService;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
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
 * Bước 5 / 7: đề xuất mua sắm lập từ số thiếu (đúng số thiếu theo điều chỉnh), mỗi dòng có căn cứ truy ngược; căn cứ
 * cho biết năm học đã chốt chưa (không chặn trình — trưởng nhóm 23/11/2026).
 */
@SpringBootTest
@Transactional
class YearGapTest {

    @Autowired
    YearGapService gaps;

    @Autowired
    YearAdequacyService adequacy;

    @Autowired
    PurchaseProposalService proposals;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void proposalTakesTheShortageAndFlagsTheOpenYear() {
        signIn("thcs.canbo");
        Long school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = 'thcs.canbo'", Long.class);
        Long year = jdbc.queryForObject("SELECT id FROM school_years WHERE is_current", Long.class);
        jdbc.update("DELETE FROM school_year_profiles WHERE school_id = ? AND school_year_id = ?", school, year);
        Row shortRow = adequacy.compute(Set.of(school), adequacy.year(year)).get(school).campusRows().stream()
                .filter(r -> r.catalogId() != null && r.shortageAdjusted() != null && r.shortageAdjusted() > 0)
                .findFirst().orElse(null);
        Assumptions.assumeTrue(shortRow != null, "Trường mẫu không thiếu thiết bị nào");
        YearGapService.ProposalResult created = gaps.toProposal(new YearGapService.ProposalRequest(year,
                List.of(new YearGapService.ProposalLine(shortRow.normId(), shortRow.campusId()))));
        assertThat(jdbc.queryForObject("SELECT quantity FROM purchase_proposal_lines WHERE proposal_id = ?",
                Integer.class, created.proposalId())).isEqualTo(shortRow.shortageAdjusted());
        List<YearGapService.Trace> traces = gaps.traces(created.proposalId(), null);
        assertThat(traces).hasSize(1);
        assertThat(traces.get(0).requiredTt()).isEqualTo(shortRow.requiredTt());
        assertThat(traces.get(0).campusName()).isEqualTo(shortRow.campusName());
        // Trường chưa xác nhận đã khai năm học: căn cứ mang cờ để màn hình gắn nhãn — không chặn trình.
        assertThat(traces.get(0).yearConfirmed()).isFalse();
        jdbc.update("""
                INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at)
                VALUES (?, ?, NULL, 'CONFIRMED', now())""", school, year);
        assertThat(gaps.traces(created.proposalId(), null).get(0).yearConfirmed()).isTrue();
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
