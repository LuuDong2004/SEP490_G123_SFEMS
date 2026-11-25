package com.g123.sfems.module.school.voucher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** Khoá số liệu khi kiểm kê: loại phiếu nào bị khoá, và câu từ chối nêu đúng phiếu kiểm kê. */
class InventoryFreezeTest {

    @Test
    void coversVouchersThatChangeAssetsButNotInventoryItself() {
        assertThat(InventoryFreeze.covers("equipment_intakes")).isTrue();
        assertThat(InventoryFreeze.covers("inventory_sessions")).isFalse();
        assertThat(InventoryFreeze.covers("purchase_proposals")).isFalse();
    }

    @Test
    void uncoveredResourceNeverQueries() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new InventoryFreeze(jdbc).requireNotFrozen("inventory_sessions", 1L);
        verifyNoInteractions(jdbc);
    }

    @Test
    void refusesNamingTheSessionCode() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        Map<String, Object> row = new HashMap<>();
        row.put("code", "KK-2026-001");
        row.put("title", "Kiểm kê cuối năm");
        row.put("room", null);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row));
        assertThatThrownBy(() -> new InventoryFreeze(jdbc).requireNotFrozen("equipment_intakes", 5L))
                .isInstanceOf(FieldValidationException.class)
                .hasMessageContaining("KK-2026-001")
                .hasMessageContaining("cả trường");
    }

    @Test
    void draftSessionIsNamedByTitleAndRoom() {
        Map<String, Object> row = new HashMap<>();
        row.put("code", null);
        row.put("title", "Kiểm kê phòng Lý");
        row.put("room", "P.Lý 1");
        assertThat(InventoryFreeze.message(row)).contains("nháp \"Kiểm kê phòng Lý\"").contains("phòng P.Lý 1");
    }

    @Test
    void freeWhenNoSessionMatches() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        new InventoryFreeze(jdbc).requireNotFrozen("equipment_intakes", 5L);
    }
}
