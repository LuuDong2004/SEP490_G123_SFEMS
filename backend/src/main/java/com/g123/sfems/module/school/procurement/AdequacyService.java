package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mức độ đáp ứng định mức thiết bị: với mỗi định mức của cấp học của trường,
 * định mức đòi bao nhiêu, trường đang có bao nhiêu cái DÙNG ĐƯỢC, thiếu bao nhiêu.
 *
 * <p>"Dùng được" là trong kho, đang dùng hoặc đang cho mượn — hỏng, đang sửa,
 * chờ thanh lý hay báo mất đều không tính, vì định mức hỏi lớp học có thiết bị
 * để dạy hay không, không hỏi sổ còn ghi bao nhiêu dòng. Thiết bị theo lô cộng
 * theo số tồn kho.
 *
 * <p>Định mức gắn với LOẠI thiết bị, không với từng nhóm: "mỗi lớp một máy
 * chiếu hoặc ti vi" được đáp ứng bởi bất kỳ nhóm nào thuộc loại đó.
 *
 * <p>Số lớp, số học sinh chưa nhập thì định mức theo lớp / theo học sinh không
 * tính được — trả về {@code required = null} kèm lý do, chứ không đoán số 0.
 */
@Service
@Transactional(readOnly = true)
public class AdequacyService {

    private static final String USABLE = "('IN_STOCK', 'IN_USE', 'BORROWED')";

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;

    public AdequacyService(JdbcTemplate jdbc, VisibleSchools visibleSchools) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
    }

    /** Một định mức của một trường. */
    public record NormRow(Long normId, String normCode, String normName, Long typeId, String typeName,
            String basis, int minQuantity, Integer required, int current, int proposed, Integer shortage,
            String warning) {
    }

    public record SchoolAdequacy(Long schoolId, String schoolCode, String schoolName, String level,
            Integer classCount, Integer studentCount, int norms, int met, int unknown, int shortageTotal,
            List<NormRow> rows) {
    }

    /** Một dòng của bảng tổng hợp: một trường, không kèm từng định mức. */
    public record SchoolSummary(Long schoolId, String schoolCode, String schoolName, String level, int norms,
            int met, int unknown, int shortageTotal, int percent) {
    }

    public record Summary(int schools, int fullyMet, int withShortage, int missingSize, int percent,
            List<SchoolSummary> rows) {
    }

    /** Ảnh chụp cho một dòng đề xuất: số đang dùng được của nhóm, và định mức của loại. */
    public record Snapshot(int current, Integer required) {
    }

    public SchoolAdequacy forSchool(Long schoolId) {
        Set<Long> visible = visibleSchools();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        List<SchoolAdequacy> result = compute(Set.of(schoolId));
        if (result.isEmpty()) {
            Map<String, Object> school = jdbc.queryForList("""
                    SELECT s.code, s.name, l.name AS level, s.class_count, s.student_count
                    FROM schools s LEFT JOIN education_levels l ON l.id = s.education_level_id
                    WHERE s.id = ?""", schoolId).stream().findFirst()
                    .orElseThrow(() -> new ResourceNotFoundException("School", schoolId));
            return new SchoolAdequacy(schoolId, (String) school.get("code"), (String) school.get("name"),
                    (String) school.get("level"), (Integer) school.get("class_count"),
                    (Integer) school.get("student_count"), 0, 0, 0, 0, List.of());
        }
        return result.get(0);
    }

    /** Tổng hợp cho cơ quan quản lý: mọi trường người xem được thấy. */
    public Summary summary() {
        List<SchoolAdequacy> all = compute(visibleSchools());
        List<SchoolSummary> rows = all.stream()
                .map(a -> new SchoolSummary(a.schoolId(), a.schoolCode(), a.schoolName(), a.level(), a.norms(),
                        a.met(), a.unknown(), a.shortageTotal(), percent(a.met(), a.norms())))
                .sorted((x, y) -> Integer.compare(x.percent(), y.percent()))
                .toList();
        int fully = (int) rows.stream().filter(r -> r.norms() > 0 && r.met() == r.norms()).count();
        int shortage = (int) rows.stream().filter(r -> r.shortageTotal() > 0).count();
        int missingSize = (int) rows.stream().filter(r -> r.unknown() > 0).count();
        int norms = rows.stream().mapToInt(SchoolSummary::norms).sum();
        int met = rows.stream().mapToInt(SchoolSummary::met).sum();
        return new Summary(rows.size(), fully, shortage, missingSize, percent(met, norms), rows);
    }

    public Snapshot snapshot(Long schoolId, Long catalogId) {
        Integer current = jdbc.queryForObject("""
                SELECT COALESCE(SUM(COALESCE(e.quantity, 1)), 0)::int FROM equipment e
                WHERE e.school_id = ? AND e.catalog_id = ? AND e.status IN %s""".formatted(USABLE),
                Integer.class, schoolId, catalogId);
        Long typeId = jdbc.queryForList("SELECT equipment_type_id FROM equipment_catalogs WHERE id = ?",
                Long.class, catalogId).stream().findFirst().orElse(null);
        Integer required = null;
        if (typeId != null) {
            List<SchoolAdequacy> rows = compute(Set.of(schoolId));
            if (!rows.isEmpty()) {
                List<Integer> matching = rows.get(0).rows().stream()
                        .filter(r -> typeId.equals(r.typeId()) && r.required() != null)
                        .map(NormRow::required).toList();
                required = matching.isEmpty() ? null : matching.stream().mapToInt(Integer::intValue).sum();
            }
        }
        return new Snapshot(current == null ? 0 : current, required);
    }

    // ------------------------------------------------------------------ nội bộ

    /** {@code schoolIds == null} là mọi trường. */
    private List<SchoolAdequacy> compute(Set<Long> schoolIds) {
        if (schoolIds != null && schoolIds.isEmpty()) {
            return List.of();
        }
        String filter = schoolIds == null ? "" : " AND s.id IN (" + schoolIds.stream().map(String::valueOf)
                .collect(Collectors.joining(",")) + ")";
        String sql = """
                WITH eq AS (
                    SELECT e.school_id, c.equipment_type_id AS type_id, SUM(COALESCE(e.quantity, 1)) AS n
                    FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id
                    WHERE e.status IN %1$s GROUP BY 1, 2),
                pr AS (
                    SELECT p.school_id, c.equipment_type_id AS type_id, SUM(l.quantity) AS n
                    FROM purchase_proposals p
                    JOIN purchase_proposal_lines l ON l.proposal_id = p.id
                    JOIN equipment_catalogs c ON c.id = l.catalog_id
                    WHERE p.status IN ('PENDING', 'APPROVED', 'COMPLETED') AND p.intake_id IS NULL
                    GROUP BY 1, 2)
                SELECT s.id, s.code, s.name, lv.name AS level, s.class_count, s.student_count,
                       n.id AS norm_id, n.code AS norm_code, n.name AS norm_name, t.id AS type_id,
                       t.name AS type_name, n.norm_basis, n.min_quantity,
                       COALESCE(eq.n, 0) AS current, COALESCE(pr.n, 0) AS proposed
                FROM schools s
                JOIN education_levels lv ON lv.id = s.education_level_id
                JOIN equipment_standards sd ON sd.education_level_id = s.education_level_id AND sd.active
                JOIN equipment_norms n ON n.standard_id = sd.id AND n.active
                JOIN equipment_types t ON t.id = n.equipment_type_id
                LEFT JOIN eq ON eq.school_id = s.id AND eq.type_id = n.equipment_type_id
                LEFT JOIN pr ON pr.school_id = s.id AND pr.type_id = n.equipment_type_id
                WHERE s.status = 'ACTIVE'%2$s
                ORDER BY s.name, n.sort_order, n.id""".formatted(USABLE, filter);

        Map<Long, List<Map<String, Object>>> bySchool = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            bySchool.computeIfAbsent(((Number) row.get("id")).longValue(), k -> new ArrayList<>()).add(row);
        }
        List<SchoolAdequacy> result = new ArrayList<>();
        for (List<Map<String, Object>> rows : bySchool.values()) {
            Map<String, Object> first = rows.get(0);
            Integer classes = (Integer) first.get("class_count");
            Integer students = (Integer) first.get("student_count");
            List<NormRow> norms = new ArrayList<>();
            int met = 0;
            int unknown = 0;
            int shortageTotal = 0;
            for (Map<String, Object> r : rows) {
                String basis = (String) r.get("norm_basis");
                int min = ((Number) r.get("min_quantity")).intValue();
                int current = ((Number) r.get("current")).intValue();
                int proposed = ((Number) r.get("proposed")).intValue();
                Integer factor = switch (basis) {
                    case "PER_CLASS" -> classes;
                    case "PER_STUDENT" -> students;
                    default -> 1;
                };
                Integer required = factor == null ? null : min * factor;
                Integer shortage = required == null ? null : Math.max(0, required - current);
                String warning = null;
                if (required == null) {
                    unknown++;
                    warning = "PER_CLASS".equals(basis) ? "Trường chưa nhập số lớp" : "Trường chưa nhập số học sinh";
                } else if (shortage == 0) {
                    met++;
                } else {
                    shortageTotal += shortage;
                }
                norms.add(new NormRow(((Number) r.get("norm_id")).longValue(), (String) r.get("norm_code"),
                        (String) r.get("norm_name"), ((Number) r.get("type_id")).longValue(),
                        (String) r.get("type_name"), basis, min, required, current, proposed, shortage, warning));
            }
            result.add(new SchoolAdequacy(((Number) first.get("id")).longValue(), (String) first.get("code"),
                    (String) first.get("name"), (String) first.get("level"), classes, students, norms.size(), met,
                    unknown, shortageTotal, norms));
        }
        return result;
    }

    Set<Long> visibleSchools() {
        return visibleSchools.current();
    }

    private static int percent(int part, int whole) {
        return whole == 0 ? 0 : Math.round(part * 100f / whole);
    }
}
