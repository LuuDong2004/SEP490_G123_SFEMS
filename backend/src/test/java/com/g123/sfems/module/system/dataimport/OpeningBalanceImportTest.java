package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.module.system.dataimport.OnboardingValidator.Result;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.Staged;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trường đã khoá khai thiết bị ban đầu: tệp nhập vẫn ghi được phòng, cán bộ, lớp; dòng trang Thiết bị được bỏ qua kèm
 * lời giải thích (không chặn cả lô). Trường chưa khoá: dòng thiết bị kiểm như thường.
 */
@SpringBootTest
@Transactional
class OpeningBalanceImportTest {

    @Autowired
    OnboardingValidator validator;

    @Autowired
    JdbcTemplate jdbc;

    long school;

    @BeforeEach
    void pick() {
        List<Long> schools = jdbc.queryForList("SELECT id FROM schools ORDER BY id LIMIT 1", Long.class);
        Assumptions.assumeTrue(!schools.isEmpty(), "Thiếu trường");
        school = schools.get(0);
        jdbc.update("DELETE FROM school_opening_balances WHERE school_id = ?", school);
    }

    @Test
    void lockedSchoolSkipsEquipmentRowsButKeepsTheRest() {
        jdbc.update("INSERT INTO school_opening_balances (school_id, closed_at, equipment_count) VALUES (?, now(), 0)",
                school);
        Map<Long, Result> results = validator.validate(school, rows());
        assertThat(results.get(1L).status()).isEqualTo(OnboardingValidator.SKIPPED);
        assertThat(results.get(1L).messages()).anySatisfy(m -> assertThat(m.text()).contains("khoá khai thiết bị"));
        assertThat(results.get(2L).status()).isNotEqualTo(OnboardingValidator.SKIPPED);
    }

    @Test
    void openSchoolStillChecksEquipmentRows() {
        Map<Long, Result> results = validator.validate(school, rows());
        assertThat(results.get(1L).status()).isNotEqualTo(OnboardingValidator.SKIPPED);
    }

    private static List<Staged> rows() {
        return List.of(
                new Staged(1L, OnboardingSheet.EQUIPMENT, 2, Map.of("name", "Bàn thí nghiệm thử", "quantity", "1"), false),
                new Staged(2L, OnboardingSheet.STAFF, 2, Map.of("code", "THU01", "name", "Nguyễn Văn Thử"), false));
    }
}
