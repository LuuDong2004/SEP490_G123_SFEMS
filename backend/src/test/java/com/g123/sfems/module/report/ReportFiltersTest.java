package com.g123.sfems.module.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.module.report.ReportService.Params;
import org.junit.jupiter.api.Test;

class ReportFiltersTest {

    private static Params params(Long typeId, String status, String condition) {
        return new Params(null, null, null, null, null, null, null, null, typeId, status, condition);
    }

    @Test
    void reportThatDeclaresNothingDropsEveryFilter() {
        Params p = ReportFilters.only(params(5L, "IN_USE", "TOT"), ReportFilters.of("movements"));
        assertThat(p.typeId()).isNull();
        assertThat(p.status()).isNull();
        assertThat(p.condition()).isNull();
    }

    @Test
    void statusIsDroppedWhereTheReportAlreadySplitsByStatus() {
        Params p = ReportFilters.only(params(5L, "IN_USE", "TOT"), ReportFilters.of("equipment-by-status"));
        assertThat(p.typeId()).isEqualTo(5L);
        assertThat(p.status()).isNull();
        assertThat(p.condition()).isEqualTo("TOT");
    }

    @Test
    void unknownValuesNeverReachTheQuery() {
        Params p = ReportFilters.only(params(null, "x'; DROP TABLE", "?"), ReportFilters.of("asset-value"));
        assertThat(p.status()).isNull();
        assertThat(p.condition()).isNull();
        assertThat(ReportFilters.sql("e", p)).isBlank();
    }

    @Test
    void sqlUsesTheAliasAndGroupedStatuses() {
        String sql = ReportFilters.sql("e", params(7L, "REPAIRING", "NONE"));
        assertThat(sql).contains("e.catalog_id IN (SELECT ftc.id FROM equipment_catalogs ftc WHERE ftc.equipment_type_id = 7)")
                .contains("e.status IN ('REPAIRING', 'WARRANTY')")
                .contains("e.condition IS NULL")
                .startsWith(" ").endsWith(" ");
    }

    @Test
    void definitionsCarryTheirFilters() {
        assertThat(ReportService.DEFINITIONS.stream().filter(d -> d.name().equals("supply-expiry")).findFirst()
                .orElseThrow().filters()).containsExactly(ReportFilters.TYPE);
    }
}
