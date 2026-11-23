package com.g123.sfems.module.school.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.school.procurement.YearAdequacyService.SchoolYearResult;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chuẩn tối thiểu theo năm học (docs/du-lieu-theo-nam-hoc.md §7): hỏng / mất vẫn đếm (tách cột), thiết bị đang trên đề nghị ghi
 * giảm không đếm, tổng trường = cộng các điểm trường (thừa điểm này không bù thiếu điểm kia).
 */
@SpringBootTest
@Transactional
class YearAdequacyTest {

    @Autowired
    YearAdequacyService service;

    @Autowired
    JdbcTemplate jdbc;

    long school;
    long catalog;
    long norm;

    @BeforeEach
    void pick() {
        List<Long> schools = jdbc.queryForList("""
                SELECT s.id FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                WHERE lv.code = 'THCS' AND s.status = 'ACTIVE'
                  AND EXISTS (SELECT 1 FROM campuses c WHERE c.school_id = s.id AND c.is_primary AND c.active)
                ORDER BY s.id LIMIT 1""", Long.class);
        Assumptions.assumeTrue(!schools.isEmpty(), "Không có trường THCS");
        school = schools.get(0);
        // Dòng tính theo trường, cần 2 — đặt riêng cho test để biết chắc số phải có.
        List<Map<String, Object>> norms = jdbc.queryForList("""
                SELECT n.id, n.catalog_id FROM equipment_norms n
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id
                WHERE lv.code = 'THCS' AND n.active AND n.catalog_id IS NOT NULL AND NOT n.optional
                  AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE)
                ORDER BY n.id LIMIT 1""");
        Assumptions.assumeTrue(!norms.isEmpty(), "Không có danh mục THCS");
        norm = ((Number) norms.get(0).get("id")).longValue();
        catalog = ((Number) norms.get(0).get("catalog_id")).longValue();
        jdbc.update("UPDATE equipment_norms SET norm_basis = 'PER_SCHOOL', min_quantity = 2, basis_size = NULL,"
                + " grade_levels = NULL WHERE catalog_id = ?", catalog);
        jdbc.update("DELETE FROM purchase_proposal_lines WHERE catalog_id = ?", catalog);
    }

    @Test
    void brokenCountsButPendingDisposalDoesNot() {
        Row before = total(compute());
        long broken = equipment("BROKEN", null);
        // Chờ ghi giảm theo trạng thái thiết bị (không còn phiếu ghi giảm từ 285).
        equipment("PENDING_LIQUIDATION", null);
        Row after = total(compute());
        assertThat(after.current()).isEqualTo(before.current() + 1);
        assertThat(after.broken()).isEqualTo(before.broken() + 1);
        assertThat(after.pendingDisposal()).isEqualTo(before.pendingDisposal() + 1);
        assertThat(broken).isPositive();
    }

    @Test
    void schoolTotalIsTheSumOfCampusesWithoutOffsetting() {
        Long main = jdbc.queryForList("SELECT id FROM campuses WHERE school_id = ? AND is_primary AND active", Long.class,
                school).stream().findFirst().orElse(null);
        Assumptions.assumeTrue(main != null, "Trường mẫu chưa có cơ sở chính");
        Long site = jdbc.queryForObject("""
                INSERT INTO campuses (school_id, code, name, is_primary, created_at)
                VALUES (?, 'TEST-DT', 'Điểm trường thử', FALSE, now()) RETURNING id""", Long.class, school);
        Long room = jdbc.queryForObject("""
                INSERT INTO rooms (school_id, code, name, campus_id, created_at)
                VALUES (?, 'TEST-P1', 'Phòng thử', ?, now()) RETURNING id""", Long.class, school, site);
        // Xoá thiết bị sẵn có của thiết bị này ở cả trường cho dễ đếm: cơ sở chính 0, điểm trường 5.
        jdbc.update("UPDATE equipment SET catalog_id = (SELECT id FROM equipment_catalogs WHERE id <> ? ORDER BY id LIMIT 1)"
                + " WHERE school_id = ? AND catalog_id = ?", catalog, school, catalog);
        for (int i = 0; i < 5; i++) {
            equipment("IN_USE", room);
        }
        SchoolYearResult r = compute();
        Row atMain = r.rowsOf(main).stream().filter(x -> Objects.equals(x.catalogId(), catalog)).findFirst().orElseThrow();
        Row atSite = r.rowsOf(site).stream().filter(x -> Objects.equals(x.catalogId(), catalog)).findFirst().orElseThrow();
        Row whole = total(r);
        assertThat(atMain.requiredTt()).isEqualTo(2);
        assertThat(atSite.requiredTt()).isEqualTo(2);
        assertThat(atMain.shortageTt()).isEqualTo(2);
        assertThat(atSite.surplus()).isEqualTo(3);
        // Cả trường cần 4, có 5 — nhưng cơ sở chính vẫn thiếu 2: thừa ở điểm trường không bù.
        assertThat(whole.requiredTt()).isEqualTo(4);
        assertThat(whole.current()).isEqualTo(5);
        assertThat(whole.shortageTt()).isEqualTo(2);
        assertThat(whole.surplus()).isEqualTo(3);
    }

    @Test
    void pastYearCountsOnlyWhatWasOnTheBooksAtTheCutoff() {
        Long past = jdbc.queryForObject("SELECT id FROM school_years WHERE NOT is_current AND end_date < CURRENT_DATE"
                + " ORDER BY start_date DESC LIMIT 1", Long.class);
        int before = service.compute(Set.of(school), service.year(past)).get(school).totalRows().stream()
                .filter(x -> Objects.equals(x.catalogId(), catalog)).mapToInt(Row::current).sum();
        equipment("IN_USE", null);
        int after = service.compute(Set.of(school), service.year(past)).get(school).totalRows().stream()
                .filter(x -> Objects.equals(x.catalogId(), catalog)).mapToInt(Row::current).sum();
        // Ghi tăng hôm nay — sau ngày cắt của năm cũ.
        assertThat(after).isEqualTo(before);
    }

    private long equipment(String status, Long room) {
        return jdbc.queryForObject("""
                INSERT INTO equipment (school_id, code, name, catalog_id, status, room_id, created_at)
                VALUES (?, 'TEST-' || gen_random_uuid(), 'Thiết bị thử', ?, ?, ?, now() - interval '1 minute')
                RETURNING id""", Long.class, school, catalog, status, room);
    }

    private SchoolYearResult compute() {
        return service.compute(Set.of(school), service.year(null)).get(school);
    }

    private Row total(SchoolYearResult r) {
        return r.totalRows().stream().filter(x -> Objects.equals(x.catalogId(), catalog)).findFirst().orElseThrow();
    }
}
