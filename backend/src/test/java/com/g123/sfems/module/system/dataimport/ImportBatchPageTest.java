package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
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

/** Danh sách lô nhập dữ liệu chia trang: đúng số dòng, không trùng không sót, tổng và số đếm khớp nhau. */
@SpringBootTest
@Transactional
class ImportBatchPageTest {

    @Autowired
    OnboardingService service;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    long school;

    @BeforeEach
    void pick() {
        List<Long> schools = jdbc.queryForList("SELECT id FROM schools ORDER BY id LIMIT 1", Long.class);
        List<String> admins = jdbc.queryForList("SELECT username FROM users WHERE user_type = 'SYSTEM' ORDER BY id LIMIT 1",
                String.class);
        Assumptions.assumeTrue(!schools.isEmpty() && !admins.isEmpty(), "Thiếu dữ liệu nền");
        school = schools.get(0);
        User user = users.findByUsernameOrEmail(admins.get(0)).orElseThrow();
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        List<SimpleGrantedAuthority> granted = jdbc.queryForList("SELECT DISTINCT p.code FROM user_roles ur"
                + " JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id"
                + " WHERE ur.user_id = ?", String.class, user.getId()).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token), granted));
        // Cùng một thời điểm tạo: thứ tự trang vẫn phải cố định.
        for (int i = 0; i < 5; i++) {
            jdbc.update("INSERT INTO data_import_batches (school_id, file_name, created_at) VALUES (?, ?, now())", school,
                    "thu-" + i + ".xlsx");
        }
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void pagesDoNotOverlap() {
        long total = service.list(school, "school_data", 0, 2).total();
        assertThat(total).isGreaterThanOrEqualTo(5);
        List<Long> first = ids(0, 2);
        List<Long> second = ids(2, 4);
        List<Long> third = ids(4, 6);
        assertThat(first).hasSize(2);
        assertThat(second).hasSize(2).doesNotContainAnyElementsOf(first);
        assertThat(third).isNotEmpty().doesNotContainAnyElementsOf(first).doesNotContainAnyElementsOf(second);
        assertThat(ids((int) total, (int) total + 20)).isEmpty();
    }

    @Test
    void countsMatchTotals() {
        assertThat(service.countByKind().get("school_data")).isEqualTo(service.list(null, "school_data", 0, 1).total());
        assertThat(service.list(school, "schools", 0, 20).rows()).isEmpty();
    }

    private List<Long> ids(int start, int end) {
        return service.list(school, "school_data", start, end).rows().stream().map(OnboardingService.Batch::id).toList();
    }
}
