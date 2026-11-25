package com.g123.sfems.module.school.yearprofile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
 * Điều chỉnh của trường (279): đúng kiểu Sở cho, có hiệu lực ngay; dòng "Không được phép" chỉ nhận nhu cầu ngoài thông
 * tư; dòng danh mục đổi thì điều chỉnh hết hiệu lực; năm đã chốt không ghi được.
 */
@SpringBootTest
@Transactional
class SchoolNormAdjustmentTest {

    @Autowired
    SchoolNormAdjustmentService adjustments;

    @Autowired
    YearAdequacyService adequacy;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Autowired
    UserRepository users;

    Long school;
    Long year;
    Long reduceNorm;
    Long reduceCatalog;
    Long plainNorm;
    Long plainCatalog;

    @BeforeEach
    void setUp() {
        signIn("thcs.canbo");
        school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = 'thcs.canbo'", Long.class);
        year = jdbc.queryForObject("SELECT id FROM school_years WHERE is_current", Long.class);
        jdbc.update("DELETE FROM school_year_profiles WHERE school_id = ? AND school_year_id = ?", school, year);
        // Hai thiết bị chỉ có MỘT dòng danh mục THCS — dòng của nó chắc chắn là dòng được tính.
        List<Map<String, Object>> single = jdbc.queryForList("""
                SELECT min(n.id) AS id, n.catalog_id FROM equipment_norms n
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id AND lv.code = 'THCS'
                WHERE n.active AND n.catalog_id IS NOT NULL
                GROUP BY n.catalog_id HAVING count(*) = 1 ORDER BY n.catalog_id LIMIT 2""");
        Assumptions.assumeTrue(single.size() == 2, "Thiếu dòng danh mục THCS");
        reduceNorm = ((Number) single.get(0).get("id")).longValue();
        reduceCatalog = ((Number) single.get(0).get("catalog_id")).longValue();
        plainNorm = ((Number) single.get(1).get("id")).longValue();
        plainCatalog = ((Number) single.get(1).get("catalog_id")).longValue();
        jdbc.update("""
                UPDATE equipment_norms SET norm_basis = 'PER_SCHOOL', min_quantity = 4, basis_size = NULL, grade_levels = NULL,
                    optional = FALSE, effective_to = NULL, adjust_kind = 'REDUCE', adjust_quantity = 1,
                    adjust_basis = 'PER_SCHOOL', adjust_basis_size = 1, adjust_basis_text = 'Được giảm'
                WHERE id = ?""", reduceNorm);
        jdbc.update("""
                UPDATE equipment_norms SET norm_basis = 'PER_SCHOOL', min_quantity = 2, basis_size = NULL, grade_levels = NULL,
                    optional = FALSE, effective_to = NULL, adjust_kind = 'NONE' WHERE id = ?""", plainNorm);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void reduceAppliesAtOnceAndOnlyTheAllowedKind() {
        assertThatThrownBy(() -> adjustments.save(input(reduceNorm, "SHARED", null, "dùng chung")))
                .isInstanceOf(FieldValidationException.class);
        adjustments.save(input(reduceNorm, "REDUCE", null, "Chưa đủ phòng"));
        Row r = row(reduceCatalog);
        assertThat(r.requiredTt()).isEqualTo(4);
        assertThat(r.requiredAdjusted()).isEqualTo(1);
        assertThat(r.adjustment().kind()).isEqualTo("REDUCE");
    }

    @Test
    void notAllowedLineTakesOnlyAnOutsideNeed() {
        assertThatThrownBy(() -> adjustments.save(input(plainNorm, "REDUCE", null, "giảm")))
                .isInstanceOf(FieldValidationException.class).hasMessageContaining("ngoài thông tư");
        assertThatThrownBy(() -> adjustments.save(input(plainNorm, "OUTSIDE", null, "cần thêm")))
                .isInstanceOf(FieldValidationException.class);
        adjustments.save(input(plainNorm, "OUTSIDE", 3, "Lớp đông"));
        Row r = row(plainCatalog);
        // Theo thông tư không đổi; nhu cầu ngoài thông tư tách riêng.
        assertThat(r.requiredAdjusted()).isEqualTo(r.requiredTt());
        assertThat(r.outsideNeed()).isEqualTo(3);
    }

    @Test
    void changedNormExpiresTheAdjustment() {
        adjustments.save(input(reduceNorm, "REDUCE", null, "Chưa đủ phòng"));
        // Không đổi gì: vẫn hiệu lực.
        assertThat(adjustments.expireForNorm(reduceNorm, "Sở sửa dòng", false)).isEmpty();
        jdbc.update("UPDATE equipment_norms SET min_quantity = 5 WHERE id = ?", reduceNorm);
        assertThat(adjustments.expireForNorm(reduceNorm, "Sở sửa dòng", false)).containsExactly(school);
        Row r = row(reduceCatalog);
        assertThat(r.adjustment().status()).isEqualTo("EXPIRED");
        assertThat(r.requiredAdjusted()).isEqualTo(r.requiredTt());
    }

    @Test
    void confirmedYearStillTakesAdjustments() {
        // Xác nhận đã khai không khoá (trưởng nhóm 25/11/2026): điều chỉnh vẫn lưu được.
        jdbc.update("""
                INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at)
                VALUES (?, ?, NULL, 'CONFIRMED', now())""", school, year);
        adjustments.save(input(reduceNorm, "REDUCE", null, "Chưa đủ phòng"));
        assertThat(row(reduceCatalog).adjustment()).isNotNull();
    }

    private SchoolNormAdjustmentService.Input input(Long norm, String kind, Integer outside, String reason) {
        Long campus = jdbc.queryForList("SELECT id FROM campuses WHERE school_id = ? AND is_primary AND active",
                Long.class, school).stream().findFirst().orElse(null);
        return new SchoolNormAdjustmentService.Input(year, campus, norm, kind, null, outside, null, reason);
    }

    private Row row(Long catalog) {
        // Dòng của điểm trường được điều chỉnh (trường có thể có nhiều điểm — tổng là cộng các điểm).
        Long campus = input(reduceNorm, "REDUCE", null, "x").campusId();
        return adequacy.compute(Set.of(school), adequacy.year(year)).get(school).rowsOf(campus).stream()
                .filter(x -> Objects.equals(x.catalogId(), catalog)).findFirst().orElseThrow();
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
