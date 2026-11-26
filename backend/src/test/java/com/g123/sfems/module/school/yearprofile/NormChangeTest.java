package com.g123.sfems.module.school.yearprofile;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.norm.EquipmentNormPatchRequest;
import com.g123.sfems.module.catalog.norm.EquipmentNormService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

/** Bước 9: Sở sửa dòng danh mục → điều chỉnh của trường trên dòng đó hết hiệu lực, trường được nhắc chọn lại. */
@SpringBootTest
@Transactional
class NormChangeTest {

    @Autowired
    EquipmentNormService norms;

    @Autowired
    JdbcTemplate jdbc;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void editingANormExpiresSchoolAdjustmentsAndNotifies() {
        List<Long> found = jdbc.queryForList("""
                SELECT n.id FROM equipment_norms n JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id AND lv.code = 'THCS'
                WHERE n.active AND n.catalog_id IS NOT NULL AND n.min_quantity IS NOT NULL ORDER BY n.id LIMIT 1""",
                Long.class);
        Assumptions.assumeTrue(!found.isEmpty(), "Thiếu danh mục THCS");
        Long norm = found.get(0);
        Long school = jdbc.queryForObject("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = 'thcs.canbo'", Long.class);
        Long year = jdbc.queryForObject("SELECT id FROM school_years WHERE is_current", Long.class);
        jdbc.update("DELETE FROM school_year_profiles WHERE school_id = ? AND school_year_id = ?", school, year);
        jdbc.update("DELETE FROM school_norm_adjustments WHERE norm_id = ?", norm);
        Long adjustment = jdbc.queryForObject("""
                INSERT INTO school_norm_adjustments (school_id, school_year_id, norm_id, norm_code, kind, outside_need,
                    reason, norm_fingerprint)
                SELECT ?, ?, n.id, n.code, 'OUTSIDE', 2, 'Cần thêm', %s FROM equipment_norms n WHERE n.id = ?
                RETURNING id""".formatted(SchoolNormAdjustmentService.FINGERPRINT), Long.class, school, year, norm);
        Long legal = jdbc.queryForObject("SELECT id FROM legal_documents ORDER BY id LIMIT 1", Long.class);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("t", "t",
                "equipment_norms:read", "equipment_norms:write", "equipment_standards:read", "legal_documents:read"));
        BigDecimal next = jdbc.queryForObject("SELECT min_quantity + 1 FROM equipment_norms WHERE id = ?",
                BigDecimal.class, norm);
        norms.update(norm, new EquipmentNormPatchRequest(null, null, null, null, null, null, null, null, null,
                null, null, next, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, new IdRef(legal), null));
        assertThat(jdbc.queryForObject("SELECT status FROM school_norm_adjustments WHERE id = ?", String.class,
                adjustment)).isEqualTo("EXPIRED");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM notifications nt JOIN users u ON u.id = nt.recipient_id
                WHERE u.username = 'thcs.canbo' AND nt.title LIKE 'Điều chỉnh chuẩn hết hiệu lực%'""", Long.class))
                .isPositive();
    }
}
