package com.g123.sfems.module.school.facilitystandard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.g123.sfems.module.school.facilitystandard.FacilityStandardService.Evaluation;
import com.g123.sfems.module.school.facilitystandard.FacilityStandardService.Item;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chuẩn CSVC THPT (changelog 291, theo 14/VBHN-BGDĐT): tổng phòng học bộ môn, phòng kết hợp truyền thống – Đoàn, quy tắc
 * chỉ xét khi có phòng, thư viện tính trên 30% học sinh.
 */
@SpringBootTest
@Transactional
class FacilityStandardThptTest {

    @Autowired
    FacilityStandardService service;

    @Autowired
    JdbcTemplate jdbc;

    /** Phạm vi trường không phải thứ test này xét: không người gọi thì thấy mọi trường. */
    @MockitoBean
    VisibleSchools visible;

    long school;

    @BeforeEach
    void pick() {
        List<Long> schools = jdbc.queryForList("""
                SELECT s.id FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                WHERE lv.code = 'THPT' AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.school_id = s.id)
                ORDER BY s.id LIMIT 1""", Long.class);
        Assumptions.assumeTrue(!schools.isEmpty(), "Không có trường THPT chưa có phòng");
        when(visible.sqlFilter(anyString())).thenReturn(" ");
        school = schools.get(0);
    }

    @Test
    void subjectRoomsCountTogether() {
        for (int i = 0; i < 3; i++) {
            room("PHONG_BO_MON_VAT_LY", 60);
        }
        room("PHONG_BO_MON_HOA_HOC", 60);
        assertThat(item("PHONG_BO_MON").status()).containsEntry("MIN", "FAIL");
        room("PHONG_MAY", 60);
        Item five = item("PHONG_BO_MON");
        assertThat(five.status()).containsEntry("MIN", "PASS").containsEntry("LEVEL2", "FAIL");
    }

    @Test
    void combinedRoomCountsUntilLevel2() {
        room("PHONG_KET_HOP_TRUYEN_THONG_VOI_PHONG", 60);
        Item item = item("PHONG_TRUYEN_THONG");
        assertThat(item.status()).containsEntry("MIN", "PASS").containsEntry("LEVEL1", "PASS")
                .containsEntry("LEVEL2", "FAIL");
    }

    @Test
    void conditionalRuleSkippedWhenAbsent() {
        assertThat(item("KHO_BEP_THUC_PHAM").status()).containsEntry("MIN", "NONE");
        room("KHO_BEP_THUC_PHAM", 8);
        assertThat(item("KHO_BEP_THUC_PHAM").status()).containsEntry("MIN", "FAIL");
    }

    @Test
    void libraryUsesThirtyPercentOfStudents() {
        FacilityStandardService.RuleRow rule = new FacilityStandardService.RuleRow(1L, "THPT", "MIN", 1, null, null,
                new java.math.BigDecimal("0.600"), new java.math.BigDecimal("60"), null, null,
                new java.math.BigDecimal("30"), false, false);
        assertThat(FacilityStandardService.studentArea(rule, 1200)).isEqualByComparingTo("216");
    }

    private void room(String type, int area) {
        jdbc.update("""
                INSERT INTO rooms (school_id, code, name, room_type_id, area, usage_status, created_at)
                SELECT ?, ?, 'Phòng thử', t.id, ?, NULL, now() FROM room_types t WHERE t.system_key = ?""", school,
                "T" + UUID.randomUUID().toString().substring(0, 8), area, type);
    }

    /** Mục của loại theo khoá hệ thống (312) — mã hiển thị là LPH…, đổi theo quy tắc sinh mã. */
    private Item item(String type) {
        String code = jdbc.queryForObject("SELECT code FROM room_types WHERE system_key = ?", String.class, type);
        Evaluation e = service.evaluate(school);
        return e.groups().stream().flatMap(g -> g.items().stream()).filter(i -> i.code().equals(code)).findFirst()
                .orElseThrow();
    }
}
