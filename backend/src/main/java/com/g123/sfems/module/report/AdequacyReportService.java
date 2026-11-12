package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** BC-03: tính mức đáp ứng định mức từ thiết bị, lớp, học sinh và phòng hiện có của từng trường. */
@Service
public class AdequacyReportService {
    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public AdequacyReportService(JdbcTemplate jdbc, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.visible = visible;
    }

    @Transactional(readOnly = true)
    public AdequacyReportResponse get(Long requestedSchoolId, Long subjectId, Long gradeId, Long typeId) {
        String scope = visible.level();
        List<SchoolInfo> schools = loadSchools(requestedSchoolId);
        List<AdequacyReportResponse.Row> rows = calculateRows(schools, subjectId, gradeId, typeId, currentYearOrder());
        List<AdequacyReportResponse.DetailRow> details = schools.size() == 1
                ? calculateDetails(schools.get(0), subjectId, gradeId, typeId, currentYearOrder()) : List.of();

        int knownSchools = (int) rows.stream().filter(r -> r.percent() != null).count();
        int average = knownSchools == 0 ? 0 : (int) Math.round(rows.stream().filter(r -> r.percent() != null)
                .mapToInt(AdequacyReportResponse.Row::percent).average().orElse(0));
        BigDecimal shortage = rows.stream().map(AdequacyReportResponse.Row::shortageTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal surplus = rows.stream().map(AdequacyReportResponse.Row::surplusTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int unknown = rows.stream().mapToInt(AdequacyReportResponse.Row::unknown).sum();
        List<AdequacyReportResponse.Band> bands = List.of(
                new AdequacyReportResponse.Band("high", "Đạt từ 80%", (int) rows.stream().filter(r -> r.percent() != null && r.percent() >= 80).count()),
                new AdequacyReportResponse.Band("middle", "50% – dưới 80%", (int) rows.stream().filter(r -> r.percent() != null && r.percent() >= 50 && r.percent() < 80).count()),
                new AdequacyReportResponse.Band("low", "Dưới 50%", (int) rows.stream().filter(r -> r.percent() != null && r.percent() < 50).count()),
                new AdequacyReportResponse.Band("unknown", "Chưa tính được", (int) rows.stream().filter(r -> r.percent() == null).count()));

        return new AdequacyReportResponse(scope, new AdequacyReportResponse.Filters(
                "SCHOOL".equals(scope) ? List.of() : schoolOptions(), subjectOptions(), gradeOptions(), typeOptions()),
                new AdequacyReportResponse.Summary(rows.size(), knownSchools, average, shortage, surplus, unknown),
                bands, rows, details);
    }

    /** BC-01 dùng cùng phép tính định mức với BC-03, nhưng theo năm học được chọn. */
    public List<AdequacyReportResponse.Row> rowsForVisibleSchools(Integer yearOrder) {
        return calculateRows(loadSchools(null), null, null, null, yearOrder);
    }

    private List<AdequacyReportResponse.Row> calculateRows(List<SchoolInfo> schools, Long subjectId, Long gradeId,
            Long typeId, Integer yearOrder) {
        List<Norm> allNorms = norms(subjectId, gradeId, typeId, yearOrder);
        java.util.Map<Long, List<Norm>> normsByLevel = allNorms.stream().filter(norm -> norm.educationLevelId() != null)
                .collect(java.util.stream.Collectors.groupingBy(Norm::educationLevelId));
        java.util.Map<Long, List<Availability>> equipmentBySchool = fetchAvailability(schools);
        java.util.Map<Long, List<RoomCount>> roomsBySchool = roomCounts(schools);
        List<AdequacyReportResponse.Row> rows = new ArrayList<>();
        for (SchoolInfo school : schools) {
            List<Norm> norms = school.educationLevelId() == null ? List.of()
                    : normsByLevel.getOrDefault(school.educationLevelId(), List.of());
            int met = 0, unknown = 0, shortageNorms = 0, surplusNorms = 0;
            BigDecimal shortageTotal = BigDecimal.ZERO, surplusTotal = BigDecimal.ZERO;
            int counted = 0;
            for (Norm norm : norms) {
                Integer base = base(school, norm, roomsBySchool.getOrDefault(school.id(), List.of()));
                if (base == null) { unknown++; continue; }
                int required = norm.quantity().multiply(BigDecimal.valueOf(base))
                        .divide(BigDecimal.valueOf(Math.max(norm.basisSize(), 1)), 0, RoundingMode.CEILING).intValue();
                BigDecimal available = available(equipmentBySchool.getOrDefault(school.id(), List.of()), norm);
                BigDecimal delta = available.subtract(BigDecimal.valueOf(required));
                counted++;
                if (delta.signum() >= 0) met++;
                else {
                    shortageNorms++;
                    shortageTotal = shortageTotal.add(delta.abs());
                }
                if (delta.signum() > 0) {
                    surplusNorms++;
                    surplusTotal = surplusTotal.add(delta);
                }
            }
            Integer percent = counted == 0 ? null : (int) Math.round(met * 100.0 / counted);
            rows.add(new AdequacyReportResponse.Row(school.id(), school.code(), school.name(), school.level(),
                    school.classCount(), school.studentCount(), norms.size(), met, unknown, shortageNorms,
                    shortageTotal, surplusNorms, surplusTotal, percent));
        }

        return rows;
    }

    /** Detailed norm rows are returned only for a single visible/selected school to keep the city report compact. */
    private List<AdequacyReportResponse.DetailRow> calculateDetails(SchoolInfo school, Long subjectId, Long gradeId,
            Long typeId, Integer yearOrder) {
        List<Norm> norms = norms(subjectId, gradeId, typeId, yearOrder).stream()
                .filter(norm -> school.educationLevelId() != null
                        && school.educationLevelId().equals(norm.educationLevelId()))
                .toList();
        List<Availability> equipment = fetchAvailability(List.of(school)).getOrDefault(school.id(), List.of());
        List<RoomCount> rooms = roomCounts(List.of(school)).getOrDefault(school.id(), List.of());
        List<AdequacyReportResponse.DetailRow> details = new ArrayList<>(norms.size());
        for (Norm norm : norms) {
            Integer base = base(school, norm, rooms);
            Integer required = base == null ? null : norm.quantity().multiply(BigDecimal.valueOf(base))
                    .divide(BigDecimal.valueOf(Math.max(norm.basisSize(), 1)), 0, RoundingMode.CEILING).intValue();
            BigDecimal available = available(equipment, norm);
            BigDecimal shortage = required == null ? null
                    : BigDecimal.valueOf(required).subtract(available).max(BigDecimal.ZERO);
            BigDecimal surplus = required == null ? null
                    : available.subtract(BigDecimal.valueOf(required)).max(BigDecimal.ZERO);
            Integer percent = required == null || required == 0 ? null
                    : available.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(required), 0,
                            RoundingMode.HALF_UP).min(BigDecimal.valueOf(100)).intValue();
            details.add(new AdequacyReportResponse.DetailRow(school.id(), school.code(), school.name(), norm.code(),
                    norm.name(), norm.itemNo(), norm.catalogCode(), norm.catalogName(), norm.subjectName(),
                    norm.gradeName(), norm.gradeLevels(), norm.typeName(), required, available, shortage, surplus,
                    percent));
        }
        return details;
    }

    private List<SchoolInfo> loadSchools(Long requestedSchoolId) {
        String schoolSql = "SELECT s.id, s.code, s.name, el.name, s.education_level_id, s.class_count, s.student_count "
                + "FROM schools s LEFT JOIN education_levels el ON el.id = s.education_level_id "
                + "WHERE s.status = 'ACTIVE' " + visible.sqlFilter("s.id")
                + (requestedSchoolId == null ? "" : " AND s.id = " + requestedSchoolId) + " ORDER BY s.name";
        return jdbc.query(schoolSql, (rs, n) -> new SchoolInfo(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getObject(5, Long.class), rs.getObject(6, Integer.class),
                rs.getObject(7, Integer.class)));
    }

    private Integer currentYearOrder() {
        Integer yearOrder = jdbc.query("SELECT sort_order FROM school_years WHERE start_date <= CURRENT_DATE "
                        + "AND end_date >= CURRENT_DATE ORDER BY sort_order DESC LIMIT 1",
                rs -> rs.next() ? rs.getObject(1, Integer.class) : null);
        return yearOrder == null
                ? jdbc.query("SELECT MAX(sort_order) FROM school_years", rs -> rs.next() ? rs.getObject(1, Integer.class) : null)
                : yearOrder;
    }

    private List<Norm> norms(Long subjectId, Long gradeId, Long typeId, Integer yearOrder) {
        if (yearOrder == null) return List.of();
        return jdbc.query("""
                SELECT st.education_level_id, n.catalog_id, COALESCE(n.equipment_type_id, c.equipment_type_id),
                       COALESCE(n.subject_id, c.subject_id), COALESCE(n.grade_id, c.grade_id), n.room_type_id,
                       n.min_quantity, COALESCE(n.basis_size, 1), n.norm_basis, n.code, n.name, n.item_no,
                       c.code, c.name, sub.name, g.name, n.grade_levels, et.name
                FROM equipment_standards st
                JOIN school_years sy_start ON sy_start.id = st.start_school_year_id
                LEFT JOIN school_years sy_end ON sy_end.id = st.end_school_year_id
                JOIN equipment_norms n ON n.standard_id = st.id AND n.active AND NOT n.optional
                    AND n.min_quantity IS NOT NULL
                LEFT JOIN equipment_catalogs c ON c.id = n.catalog_id
                LEFT JOIN subjects sub ON sub.id = COALESCE(n.subject_id, c.subject_id)
                LEFT JOIN grades g ON g.id = COALESCE(n.grade_id, c.grade_id)
                LEFT JOIN equipment_types et ON et.id = COALESCE(n.equipment_type_id, c.equipment_type_id)
                WHERE st.active AND st.status = 'ACTIVE'
                  AND sy_start.sort_order <= ? AND (sy_end.id IS NULL OR sy_end.sort_order >= ?)
                  AND (CAST(? AS BIGINT) IS NULL OR COALESCE(n.subject_id, c.subject_id) = CAST(? AS BIGINT))
                  AND (CAST(? AS BIGINT) IS NULL OR COALESCE(n.grade_id, c.grade_id) = CAST(? AS BIGINT))
                  AND (CAST(? AS BIGINT) IS NULL OR COALESCE(n.equipment_type_id, c.equipment_type_id) = CAST(? AS BIGINT))
                ORDER BY st.education_level_id, n.sort_order, n.name
                """, (rs, n) -> new Norm(rs.getObject(1, Long.class), rs.getObject(2, Long.class),
                rs.getObject(3, Long.class), rs.getObject(4, Long.class), rs.getObject(5, Long.class),
                rs.getObject(6, Long.class), rs.getBigDecimal(7), rs.getInt(8), rs.getString(9), rs.getString(10),
                rs.getString(11), rs.getString(12), rs.getString(13), rs.getString(14), rs.getString(15),
                rs.getString(16), rs.getString(17), rs.getString(18)), yearOrder,
                yearOrder, subjectId, subjectId, gradeId, gradeId, typeId, typeId);
    }

    private Integer base(SchoolInfo school, Norm norm, List<RoomCount> roomCounts) {
        return switch (norm.basis()) {
            case "PER_SCHOOL" -> 1;
            case "PER_CLASS" -> school.classCount();
            case "PER_STUDENT" -> school.studentCount();
            case "PER_ROOM" -> roomCounts.stream()
                    .filter(room -> norm.roomTypeId() == null || norm.roomTypeId().equals(room.roomTypeId()))
                    .filter(room -> norm.subjectId() == null || norm.subjectId().equals(room.subjectId()))
                    .mapToInt(RoomCount::count).sum();
            default -> null; // PER_TEACHER: đồ án chưa lưu số lượng giáo viên.
        };
    }

    private java.util.Map<Long, List<Availability>> fetchAvailability(List<SchoolInfo> schools) {
        if (schools.isEmpty()) return java.util.Map.of();
        String schoolIds = schools.stream().map(school -> String.valueOf(school.id())).collect(java.util.stream.Collectors.joining(","));
        String sql = "SELECT e.school_id, c.id, c.equipment_type_id, c.subject_id, c.grade_id, COALESCE(SUM(e.quantity), 0) "
                + "FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id "
                + "WHERE e.school_id IN (" + schoolIds + ") " + visible.sqlFilter("e.school_id")
                + "AND e.active AND e.status IN ('IN_USE', 'IN_STOCK') "
                + "AND COALESCE(e.condition, 'TOT') NOT IN ('HONG', 'KHONG_SU_DUNG') "
                + "GROUP BY e.school_id, c.id, c.equipment_type_id, c.subject_id, c.grade_id";
        return jdbc.query(sql, (rs, n) -> new Availability(rs.getLong(1), rs.getLong(2), rs.getObject(3, Long.class),
                rs.getObject(4, Long.class), rs.getObject(5, Long.class), rs.getBigDecimal(6)))
                .stream().collect(java.util.stream.Collectors.groupingBy(Availability::schoolId));
    }

    private BigDecimal available(List<Availability> equipment, Norm norm) {
        return equipment.stream()
                .filter(item -> norm.catalogId() == null || norm.catalogId().equals(item.catalogId()))
                .filter(item -> norm.typeId() == null || norm.typeId().equals(item.typeId()))
                .filter(item -> norm.subjectId() == null || norm.subjectId().equals(item.subjectId()))
                .filter(item -> norm.gradeId() == null || norm.gradeId().equals(item.gradeId()))
                .map(Availability::quantity).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private java.util.Map<Long, List<RoomCount>> roomCounts(List<SchoolInfo> schools) {
        if (schools.isEmpty()) return java.util.Map.of();
        String schoolIds = schools.stream().map(school -> String.valueOf(school.id())).collect(java.util.stream.Collectors.joining(","));
        return jdbc.query("SELECT r.school_id, r.room_type_id, r.subject_id, COUNT(*) FROM rooms r "
                        + "WHERE r.school_id IN (" + schoolIds + ") " + visible.sqlFilter("r.school_id")
                        + "AND r.active GROUP BY r.school_id, r.room_type_id, r.subject_id",
                (rs, n) -> new RoomCount(rs.getLong(1), rs.getObject(2, Long.class), rs.getObject(3, Long.class), rs.getInt(4)))
                .stream().collect(java.util.stream.Collectors.groupingBy(RoomCount::schoolId));
    }

    private List<AdequacyReportResponse.Option> schoolOptions() {
        return jdbc.query("SELECT s.id, s.name FROM schools s WHERE s.status = 'ACTIVE'" + visible.sqlFilter("s.id") + " ORDER BY s.name",
                (rs, n) -> new AdequacyReportResponse.Option(rs.getLong(1), rs.getString(2)));
    }
    private List<AdequacyReportResponse.Option> subjectOptions() {
        return jdbc.query("SELECT id, name FROM subjects WHERE active ORDER BY sort_order, name",
                (rs, n) -> new AdequacyReportResponse.Option(rs.getLong(1), rs.getString(2)));
    }
    private List<AdequacyReportResponse.Option> gradeOptions() {
        return jdbc.query("SELECT id, name FROM grades ORDER BY sort_order, name",
                (rs, n) -> new AdequacyReportResponse.Option(rs.getLong(1), rs.getString(2)));
    }
    private List<AdequacyReportResponse.Option> typeOptions() {
        return jdbc.query("SELECT id, name FROM equipment_types WHERE active ORDER BY sort_order, name",
                (rs, n) -> new AdequacyReportResponse.Option(rs.getLong(1), rs.getString(2)));
    }

    private record SchoolInfo(Long id, String code, String name, String level, Long educationLevelId,
            Integer classCount, Integer studentCount) {}
    private record Norm(Long educationLevelId, Long catalogId, Long typeId, Long subjectId, Long gradeId,
            Long roomTypeId, BigDecimal quantity, int basisSize, String basis, String code, String name,
            String itemNo, String catalogCode, String catalogName, String subjectName, String gradeName,
            String gradeLevels, String typeName) {}
    private record Availability(Long schoolId, Long catalogId, Long typeId, Long subjectId, Long gradeId, BigDecimal quantity) {}
    private record RoomCount(Long schoolId, Long roomTypeId, Long subjectId, int count) {}
}
