package com.g123.sfems.module.catalog.facilitystandard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.facilitystandard.FacilityStandardTypeRequest.Tier;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Lưu chuẩn của một loại CSVC đủ ba mức một lần (291): tạo, sửa, bỏ mức trống, báo lỗi đúng cột, gắn văn bản. */
@SpringBootTest
@Transactional
class FacilityStandardTypeSaveTest {

    @Autowired
    FacilityStandardRuleService service;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    EntityManager em;

    long type;
    long document;

    @BeforeEach
    void pick() {
        List<Long> types = jdbc.queryForList("SELECT id FROM room_types WHERE code = 'PHONG_HOP'", Long.class);
        List<Long> docs = jdbc.queryForList("SELECT id FROM legal_documents WHERE code = '13/2020/TT-BGDĐT'", Long.class);
        Assumptions.assumeTrue(!types.isEmpty() && !docs.isEmpty(), "Thiếu danh mục mẫu");
        type = types.get(0);
        document = docs.get(0);
    }

    @Test
    void savesAllTiersAndDropsBlankOnes() {
        service.saveType(type, request(tier("MIN", 1, true), tier("LEVEL1", 2, true), tier("LEVEL2", null, false)), true);
        assertThat(tiers()).containsEntry("MIN", 1).containsEntry("LEVEL1", 2).doesNotContainKey("LEVEL2");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM facility_standard_rule_documents x JOIN facility_standard_rules r ON r.id = x.rule_id
                WHERE r.room_type_id = ?""", Integer.class, type)).isEqualTo(2);
        service.saveType(type, request(tier("MIN", 3, true), tier("LEVEL1", null, false), tier("LEVEL2", null, false)), true);
        assertThat(tiers()).containsEntry("MIN", 3).doesNotContainKey("LEVEL1");
    }

    @Test
    void withoutDeleteRightBlankTierIsDeactivated() {
        service.saveType(type, request(tier("MIN", 1, true), tier("LEVEL1", 2, true), tier("LEVEL2", null, false)), false);
        service.saveType(type, request(tier("MIN", 1, true), tier("LEVEL1", null, false), tier("LEVEL2", null, false)), false);
        em.flush();
        assertThat(jdbc.queryForObject("SELECT active FROM facility_standard_rules WHERE room_type_id = ? AND tier = 'LEVEL1'",
                Boolean.class, type)).isFalse();
    }

    @Test
    void errorNamesTheTier() {
        FieldValidationException e = catchThrowableOfType(FieldValidationException.class,
                () -> service.saveType(type, request(tier("MIN", 1, true), tier("LEVEL1", 2, false),
                        tier("LEVEL2", null, false)), true));
        assertThat(e.errors()).containsKey("LEVEL1.legalDocuments");
    }

    private Map<String, Integer> tiers() {
        em.flush();
        Map<String, Integer> out = new java.util.HashMap<>();
        jdbc.query("SELECT tier, min_count FROM facility_standard_rules WHERE room_type_id = ? AND level_code = 'THPT'",
                rs -> {
                    out.put(rs.getString(1), rs.getInt(2));
                }, type);
        return out;
    }

    private FacilityStandardTypeRequest request(Tier... tiers) {
        return new FacilityStandardTypeRequest("THPT", List.of(tiers));
    }

    private Tier tier(String tier, Integer count, boolean withDocument) {
        return new Tier(tier, count, null, null, null, null, null, null, null, false,
                withDocument ? List.of(new IdRef(document)) : List.of(), null, null);
    }
}
