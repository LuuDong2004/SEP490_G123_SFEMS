package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
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
 * <p><b>Định mức gắn với THIẾT BỊ (catalog), không với loại.</b> Dòng phụ lục
 * "mỗi lớp một máy chiếu hoặc ti vi" là một dòng của MỘT thiết bị cụ thể; gộp
 * theo loại thì hai thiết bị khác nhau của cùng loại cộng vào nhau và trường
 * nào cũng "đủ" một cách giả tạo. Dòng định mức chưa gắn thiết bị (catalog_id
 * rỗng) mới rơi về đếm theo loại.
 *
 * <p>Hai dòng định mức cùng trỏ một thiết bị (phụ lục nhắc lại ở nhiều mục) thì
 * giữ dòng ĐÒI NHIỀU NHẤT — cộng dồn sẽ đòi gấp đôi cho cùng một thứ.
 *
 * <p>Số lớp, số học sinh lấy từ cột khai báo của trường. Hệ thống chưa có bảng
 * cán bộ, giáo viên nên định mức THEO GIÁO VIÊN không tính được — trả
 * {@code required = null} kèm lý do, chứ không đoán số 0.
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
    public record NormRow(Long normId, String normCode, String normName, Long catalogId, String catalogCode,
            Long subjectId, String subjectName, Long typeId, String typeName, String basis,
            BigDecimal minQuantity, Integer basisSize, String quantityText, String gradeLevels, boolean optional,
            Integer required, int current, int proposed, Integer shortage, Integer surplus, String warning) {

        /** Có vào thống kê đủ / thiếu không: dòng không ghi số hoặc dòng tự chọn thì không. */
        boolean counted() {
            return minQuantity != null && !optional;
        }
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

    /** Ảnh chụp cho một dòng đề xuất: số đang dùng được của thiết bị, và định mức của nó. */
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

    /** Số đang dùng được và định mức của MỘT thiết bị ở MỘT trường — ảnh chụp lưu vào dòng đề xuất. */
    public Snapshot snapshot(Long schoolId, Long catalogId) {
        Integer current = jdbc.queryForObject("""
                SELECT COALESCE(SUM(COALESCE(e.quantity, 1)), 0)::int FROM equipment e
                WHERE e.school_id = ? AND e.catalog_id = ? AND e.status IN %s""".formatted(USABLE),
                Integer.class, schoolId, catalogId);
        List<Integer> matching = compute(Set.of(schoolId)).stream()
                .flatMap(a -> a.rows().stream())
                .filter(r -> catalogId.equals(r.catalogId()) && r.required() != null)
                .map(NormRow::required).toList();
        // Thiết bị nằm ở nhiều dòng định mức: cộng các dòng lại, đúng như màn đáp ứng định mức hiển thị.
        Integer required = matching.isEmpty() ? null : matching.stream().mapToInt(Integer::intValue).sum();
        return new Snapshot(current == null ? 0 : current, required);
    }

    // ------------------------------------------------------------------ nội bộ

    /** {@code schoolIds == null} là mọi trường. */
    private List<SchoolAdequacy> compute(Set<Long> schoolIds) {
        if (schoolIds != null && schoolIds.isEmpty()) {
            return List.of();
        }
        String ids = schoolIds == null ? "" : schoolIds.stream().map(String::valueOf)
                .collect(Collectors.joining(","));
        String schoolFilter = schoolIds == null ? "" : " AND s.id IN (" + ids + ")";
        String eqFilter = schoolIds == null ? "" : " AND e.school_id IN (" + ids + ")";
        String prFilter = schoolIds == null ? "" : " AND p.school_id IN (" + ids + ")";
        String rmFilter = schoolIds == null ? "" : " AND r.school_id IN (" + ids + ")";

        String sql = """
                WITH eq AS (
                    SELECT e.school_id, e.catalog_id, SUM(COALESCE(e.quantity, 1))::int AS n
                    FROM equipment e
                    WHERE e.status IN %1$s%3$s
                    GROUP BY 1, 2),
                et AS (
                    SELECT e.school_id, c.equipment_type_id AS type_id, SUM(COALESCE(e.quantity, 1))::int AS n
                    FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id
                    WHERE e.status IN %1$s AND c.equipment_type_id IS NOT NULL%3$s
                    GROUP BY 1, 2),
                pr AS (
                    SELECT p.school_id, l.catalog_id, SUM(l.quantity)::int AS n
                    FROM purchase_proposals p
                    JOIN purchase_proposal_lines l ON l.proposal_id = p.id
                    WHERE p.status IN ('PENDING', 'APPROVED', 'COMPLETED') AND p.intake_id IS NULL%4$s
                    GROUP BY 1, 2),
                rm AS (
                    SELECT r.school_id, r.subject_id, count(*)::int AS n
                    FROM rooms r
                    WHERE r.active AND r.subject_id IS NOT NULL%5$s
                    GROUP BY 1, 2)
                SELECT s.id, s.code, s.name, lv.name AS level, s.class_count, s.student_count,
                       n.id AS norm_id, n.code AS norm_code, n.name AS norm_name,
                       n.catalog_id, c.code AS catalog_code,
                       n.subject_id, sub.name AS subject_name,
                       n.equipment_type_id AS type_id, t.name AS type_name,
                       n.norm_basis, n.min_quantity, n.basis_size, n.quantity_text, n.grade_levels, n.optional,
                       COALESCE(eq.n, 0) AS eq_catalog, COALESCE(et.n, 0) AS eq_type,
                       COALESCE(pr.n, 0) AS proposed, COALESCE(rm.n, 0) AS subject_rooms
                FROM schools s
                JOIN education_levels lv ON lv.id = s.education_level_id
                JOIN equipment_standards sd ON sd.education_level_id = s.education_level_id AND sd.active
                JOIN equipment_norms n ON n.standard_id = sd.id AND n.active
                LEFT JOIN equipment_catalogs c ON c.id = n.catalog_id
                LEFT JOIN subjects sub ON sub.id = n.subject_id
                LEFT JOIN equipment_types t ON t.id = n.equipment_type_id
                LEFT JOIN eq ON eq.school_id = s.id AND eq.catalog_id = n.catalog_id
                LEFT JOIN et ON et.school_id = s.id AND et.type_id = n.equipment_type_id
                LEFT JOIN pr ON pr.school_id = s.id AND pr.catalog_id = n.catalog_id
                LEFT JOIN rm ON rm.school_id = s.id AND rm.subject_id = n.subject_id
                WHERE s.status = 'ACTIVE'%2$s
                ORDER BY s.name, n.sort_order, n.id"""
                .formatted(USABLE, schoolFilter, eqFilter, prFilter, rmFilter);

        Map<Long, List<Map<String, Object>>> bySchool = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(sql)) {
            bySchool.computeIfAbsent(((Number) row.get("id")).longValue(), k -> new ArrayList<>()).add(row);
        }
        List<SchoolAdequacy> result = new ArrayList<>();
        for (List<Map<String, Object>> rows : bySchool.values()) {
            result.add(school(rows));
        }
        return result;
    }

    private SchoolAdequacy school(List<Map<String, Object>> rows) {
        Map<String, Object> first = rows.get(0);
        Integer classes = (Integer) first.get("class_count");
        Integer students = (Integer) first.get("student_count");

        // Hai dòng định mức cùng một thiết bị: giữ dòng đòi nhiều nhất.
        Map<String, NormRow> byKey = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            NormRow row = row(r, classes, students);
            String key = row.catalogId() != null ? "c" + row.catalogId() : "n" + row.normId();
            NormRow existing = byKey.get(key);
            if (existing == null || stronger(row, existing)) {
                byKey.put(key, row);
            }
        }

        List<NormRow> norms = new ArrayList<>(byKey.values());
        int met = 0;
        int unknown = 0;
        int shortageTotal = 0;
        for (NormRow r : norms) {
            if (!r.counted()) {
                continue;
            }
            if (r.required() == null) {
                unknown++;
            } else if (r.shortage() == 0) {
                met++;
            } else {
                shortageTotal += r.shortage();
            }
        }
        // Số "định mức" của thẻ tổng hợp chỉ đếm dòng có nghĩa — dòng tự chọn / không ghi số không vào.
        int counted = (int) norms.stream().filter(NormRow::counted).count();
        return new SchoolAdequacy(((Number) first.get("id")).longValue(), (String) first.get("code"),
                (String) first.get("name"), (String) first.get("level"), classes, students, counted, met,
                unknown, shortageTotal, norms);
    }

    private NormRow row(Map<String, Object> r, Integer classes, Integer students) {
        Long catalogId = longOf(r.get("catalog_id"));
        Long typeId = longOf(r.get("type_id"));
        BigDecimal minQuantity = (BigDecimal) r.get("min_quantity");
        boolean optional = Boolean.TRUE.equals(r.get("optional"));
        int subjectRooms = ((Number) r.get("subject_rooms")).intValue();
        String basis = (String) r.get("norm_basis");

        // Đếm theo thiết bị khi dòng định mức đã gắn thiết bị; chưa gắn thì đếm cả loại.
        int current = catalogId != null ? ((Number) r.get("eq_catalog")).intValue()
                : ((Number) r.get("eq_type")).intValue();
        int proposed = catalogId == null ? 0 : ((Number) r.get("proposed")).intValue();

        Integer required = null;
        String warning = null;
        if (minQuantity != null) {
            int size = r.get("basis_size") == null ? 1 : Math.max(1, ((Number) r.get("basis_size")).intValue());
            int factor;
            switch (basis == null ? "PER_SCHOOL" : basis) {
                case "PER_CLASS" -> {
                    factor = classes == null ? -1 : ceil(classes, size);
                    if (classes == null) {
                        warning = "Trường chưa nhập số lớp";
                    }
                }
                case "PER_STUDENT" -> {
                    factor = students == null ? -1 : ceil(students, size);
                    if (students == null) {
                        warning = "Trường chưa nhập số học sinh";
                    }
                }
                case "PER_ROOM" -> {
                    // Chưa khai phòng bộ môn của môn: vẫn đòi đủ cho MỘT phòng — danh mục là thứ phải có.
                    factor = Math.max(1, ceil(subjectRooms, size));
                    if (subjectRooms == 0) {
                        warning = "Chưa khai phòng bộ môn của môn — tính một phòng";
                    }
                }
                case "PER_TEACHER" -> {
                    // Hệ thống chưa có bảng cán bộ, giáo viên: không đoán, trả "chưa tính được".
                    factor = -1;
                    warning = "Chưa có dữ liệu giáo viên — không tính được định mức theo giáo viên";
                }
                default -> factor = 1;
            }
            if (factor > 0) {
                required = minQuantity.multiply(BigDecimal.valueOf(factor))
                        .setScale(0, RoundingMode.CEILING).intValue();
            }
        }
        Integer shortage = required == null ? null : Math.max(0, required - current);
        Integer surplus = required == null ? null : Math.max(0, current - required);
        return new NormRow(((Number) r.get("norm_id")).longValue(), (String) r.get("norm_code"),
                (String) r.get("norm_name"), catalogId, (String) r.get("catalog_code"),
                longOf(r.get("subject_id")), (String) r.get("subject_name"), typeId, (String) r.get("type_name"),
                basis, minQuantity, r.get("basis_size") == null ? null : ((Number) r.get("basis_size")).intValue(),
                (String) r.get("quantity_text"), (String) r.get("grade_levels"), optional,
                required, current, proposed, shortage, surplus, warning);
    }

    /** Số đơn vị cần để phủ {@code count} đối tượng, mỗi đơn vị phục vụ {@code size} đối tượng. */
    private static int ceil(int count, int size) {
        return (count + size - 1) / size;
    }

    /** Dòng nào "đòi" hơn: dòng bắt buộc hơn dòng tự chọn, có số hơn không số, số lớn hơn số nhỏ. */
    private static boolean stronger(NormRow a, NormRow b) {
        if (a.optional() != b.optional()) {
            return !a.optional();
        }
        if (b.required() == null) {
            return a.required() != null;
        }
        return a.required() != null && a.required() > b.required();
    }

    private static Long longOf(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    Set<Long> visibleSchools() {
        return visibleSchools.current();
    }

    private static int percent(int part, int whole) {
        return whole == 0 ? 0 : Math.round(part * 100f / whole);
    }
}
