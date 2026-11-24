package com.g123.sfems.module.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Báo cáo của năm học đã qua: thiết bị vào sổ sau ngày cắt không đếm, trạng thái là trạng thái trước lần đổi sau đó. */
@SpringBootTest
@Transactional
class ReportYearTest {

    @Autowired
    JdbcTemplate jdbc;

    ReportYear years;
    long year;
    long equipment;

    @BeforeEach
    void pick() {
        years = new ReportYear(jdbc);
        List<Long> past = jdbc.queryForList("SELECT id FROM school_years WHERE NOT is_current AND end_date < CURRENT_DATE"
                + " ORDER BY end_date DESC LIMIT 1", Long.class);
        List<Long> items = jdbc.queryForList("SELECT e.id FROM equipment e WHERE e.status = 'IN_USE' AND NOT EXISTS"
                + " (SELECT 1 FROM equipment_history h WHERE h.equipment_id = e.id AND h.field IS NOT NULL) LIMIT 1", Long.class);
        Assumptions.assumeTrue(!past.isEmpty() && !items.isEmpty(), "Thiếu năm học đã qua hoặc thiết bị");
        year = past.get(0);
        equipment = items.get(0);
    }

    @Test
    void currentYearAndOtherReportsIgnoreTheYear() {
        Long current = jdbc.queryForList("SELECT id FROM school_years WHERE is_current", Long.class).stream().findFirst().orElse(null);
        assertThat(years.past("equipment-by-status", current)).isNull();
        assertThat(years.past("facility-standard", year)).isNull();
        assertThat(years.past("equipment-by-status", year)).isEqualTo(year);
        assertThat(years.equipment(null)).isEqualTo("equipment");
    }

    @Test
    void equipmentReceivedAfterTheCutIsNotCounted() {
        receive("2099-01-01");
        assertThat(atYearEnd()).isEmpty();
        receive("2001-01-01");
        assertThat(atYearEnd()).hasSize(1);
    }

    @Test
    void statusIsTheOneBeforeTheFirstLaterChange() {
        receive("2001-01-01");
        jdbc.update("INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, created_at)"
                + " VALUES (?, 'KIEM_KE', 'status', 'Trong kho', 'Đang sử dụng', now())", equipment);
        jdbc.update("INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, created_at)"
                + " VALUES (?, 'KIEM_KE', 'condition', 'Kém', 'Tốt', now())", equipment);
        Map<String, Object> row = atYearEnd().get(0);
        assertThat(row).containsEntry("status", "IN_STOCK").containsEntry("condition", "KEM");
    }

    private void receive(String day) {
        jdbc.update("UPDATE equipment SET received_date = ?::date, created_at = now() WHERE id = ?", day, equipment);
    }

    private List<Map<String, Object>> atYearEnd() {
        return jdbc.queryForList("SELECT e.status, e.condition FROM " + years.equipment(year) + " e WHERE e.id = ?", equipment);
    }
}
