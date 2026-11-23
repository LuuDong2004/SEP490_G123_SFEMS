package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Cần hoàn thiện" của MỘT trường: những chỗ dữ liệu CSVC còn thiếu (ERROR — làm sai số của chuẩn CSVC, biểu số liệu,
 * định mức) và những chỗ đáng ngờ (WARNING — vẫn lưu được, nên xem lại). Chỉ trả mục có số đếm lớn hơn 0.
 *
 * <p>Hạng mục "được tính" = đang dùng ({@code active}) và chưa ngừng sử dụng. Mọi câu truy vấn chỉ đọc đúng một trường, trường phải nằm trong phạm vi người gọi.
 */
@Service
public class FacilityTodoService {

    public static final String ERROR = "ERROR";
    public static final String WARNING = "WARNING";

    /** Hạng mục được tính: đang dùng, chưa ngừng sử dụng. Luôn đi với bí danh {@code r}. */
    private static final String COUNTED = " r.school_id = ? AND r.active AND r.usage_status IS DISTINCT FROM 'NGUNG_SU_DUNG' ";

    /** Lớp đang dùng của năm học hiện tại, bí danh {@code k}. */
    private static final String CURRENT_CLASSES = """
            FROM school_classes k JOIN school_years y ON y.id = k.school_year_id AND y.is_current
            WHERE k.school_id = ? AND k.active""";

    private final JdbcTemplate jdbc;
    private final SchoolService schools;
    private final VisibleSchools visibleSchools;
    private final CampusScope campusScope;

    public FacilityTodoService(JdbcTemplate jdbc, SchoolService schools, VisibleSchools visibleSchools,
            CampusScope campusScope) {
        this.jdbc = jdbc;
        this.schools = schools;
        this.visibleSchools = visibleSchools;
        this.campusScope = campusScope;
    }

    /** Gợi ý cho giao diện: mở mục nào ({@code classes}, {@code rooms}, {@code buildings}, {@code landArea}). */
    public record TodoAction(String kind, String filter) {
    }

    public record TodoItem(String key, String severity, long count, String title, String impact, TodoAction action) {
    }

    @Transactional(readOnly = true)
    public List<TodoItem> todo(Long schoolId) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        schools.get(schoolId);

        Map<String, Object> s = jdbc.queryForMap("""
                SELECT s.land_area, s.construction_area, lv.code AS level_code
                FROM schools s LEFT JOIN education_levels lv ON lv.id = s.education_level_id
                WHERE s.id = ?""", schoolId);
        BigDecimal land = (BigDecimal) s.get("land_area");
        BigDecimal construction = (BigDecimal) s.get("construction_area");
        String level = (String) s.get("level_code");

        // Tài khoản một cơ sở (271): việc cần làm của cơ sở mình — lớp theo phòng học, hạng mục, khối nhà.
        Long pinned = campusScope.pinnedCampusIn(schoolId);
        String c = pinned == null ? null : String.valueOf(pinned.longValue());
        String pinClass = c == null ? " " : FacilityCounting.roomInCampusSql("k.room_id", "k.school_id", c);
        String pinRoom = c == null ? " " : FacilityCounting.roomInCampusSql("r.id", "r.school_id", c);
        String pinBuilding = c == null ? " " : FacilityCounting.ownCampusInSql("bb.campus_id", "bb.school_id", c);
        String classes0 = CURRENT_CLASSES + pinClass;

        Map<String, Object> cl = jdbc.queryForMap("SELECT count(*) AS classes, "
                + "count(*) FILTER (WHERE coalesce(k.student_count, 0) = 0) AS no_size " + classes0, schoolId);
        Long outliers = jdbc.queryForObject("""
                WITH c AS (SELECT k.grade_id, k.student_count %s AND k.student_count > 0),
                     g AS (SELECT grade_id, avg(student_count) AS mean FROM c GROUP BY grade_id HAVING count(*) >= 3)
                SELECT count(*) FROM c JOIN g ON g.grade_id = c.grade_id
                WHERE c.student_count > 1.5 * g.mean OR c.student_count < 0.5 * g.mean""".formatted(classes0),
                Long.class, schoolId);

        Map<String, Object> r = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE r.structure IS NULL) AS no_structure,
                       count(*) FILTER (WHERE r.room_type_id IS NULL) AS no_type,
                       count(*) FILTER (WHERE r.area IS NULL AND EXISTS (
                           SELECT 1 FROM facility_standard_rules f
                           WHERE f.active AND f.room_type_id = r.room_type_id AND f.level_code = CAST(? AS VARCHAR)
                             AND (f.min_room_area IS NOT NULL OR f.area_per_student IS NOT NULL
                                  OR f.min_total_area IS NOT NULL))) AS no_area,
                       -- Diện tích bất thường: phòng, nhà trên 500 m²; khu vực (sân, bãi…) trên 20.000 m².
                       count(*) FILTER (WHERE r.area > CASE WHEN t.kind = 'AREA' THEN 20000 ELSE 500 END) AS big,
                       count(*) FILTER (WHERE t.functional AND r.subject_id IS NULL) AS no_subject,
                       coalesce(sum(r.area) FILTER (WHERE t.kind IS DISTINCT FROM 'AREA' AND r.building_id IS NOT NULL),
                                0) AS room_area
                FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
                WHERE""" + COUNTED + pinRoom, level, schoolId);

        Long duplicates = jdbc.queryForObject("""
                SELECT coalesce(sum(n), 0) FROM (
                    SELECT count(*) AS n FROM rooms r WHERE r.school_id = ? AND r.active""" + pinRoom + """
                    GROUP BY r.building_id, lower(trim(r.name)) HAVING count(*) >= 2) d""", Long.class, schoolId);
        // floor_area của khối nhà là TỔNG diện tích sàn (Building.floorArea) — không nhân số tầng.
        Map<String, Object> b = jdbc.queryForMap("""
                SELECT count(*) AS total, count(floor_area) AS known, coalesce(sum(floor_area), 0) AS floor_area
                FROM buildings bb WHERE bb.school_id = ? AND bb.active""" + pinBuilding, schoolId);

        List<TodoItem> items = new ArrayList<>();
        long classes = n(cl.get("classes"));
        if (classes == 0) {
            add(items, "no_classes", ERROR, 1, "Chưa có danh sách lớp năm học hiện hành",
                    "Chuẩn CSVC, biểu số liệu và định mức không tính được số học sinh, số lớp", "classes", null);
        }
        long noSize = n(cl.get("no_size"));
        add(items, "class_no_size", ERROR, noSize, fmt(noSize) + " lớp chưa có sĩ số", "Số học sinh đang thiếu",
                "classes", null);
        long noStructure = n(r.get("no_structure"));
        add(items, "no_structure", ERROR, noStructure, fmt(noStructure) + " hạng mục chưa khai kết cấu",
                "Biểu số liệu không chia được kiên cố / bán kiên cố", "rooms", "no_structure");
        long noArea = n(r.get("no_area"));
        add(items, "no_area", ERROR, noArea, fmt(noArea) + " hạng mục chưa có diện tích",
                "Chưa chấm được chuẩn diện tích", "rooms", "no_area");
        if (land == null) {
            add(items, "no_land", ERROR, 1, "Chưa khai diện tích đất", "Không tính được m² đất / học sinh",
                    "landArea", null);
        }
        long noType = n(r.get("no_type"));
        add(items, "no_type", ERROR, noType, fmt(noType) + " hạng mục chưa có loại CSVC",
                "Không vào được khối nào trong biểu số liệu", "rooms", "no_type");

        long dup = n(duplicates);
        add(items, "dup_name", WARNING, dup, fmt(dup) + " hạng mục trùng tên trong cùng khối nhà",
                "Dễ khai trùng một phòng hai lần", "rooms", "dup_name");
        long big = n(r.get("big"));
        add(items, "big_room", WARNING, big, fmt(big) + " hạng mục diện tích bất thường", "Kiểm tra lại số m²",
                "rooms", "big_room");
        if (land != null && construction != null && construction.compareTo(land) > 0) {
            add(items, "construction_gt_land", WARNING, 1, "Diện tích xây dựng lớn hơn diện tích đất",
                    "Kiểm tra lại hai số này", "landArea", null);
        }
        long buildings = n(b.get("total"));
        BigDecimal floorArea = (BigDecimal) b.get("floor_area");
        BigDecimal roomArea = (BigDecimal) r.get("room_area");
        if (buildings > 0 && n(b.get("known")) == buildings && roomArea.compareTo(floorArea) > 0) {
            add(items, "rooms_gt_floor_area", WARNING, 1, "Tổng diện tích phòng vượt diện tích sàn các khối nhà",
                    "Kiểm tra diện tích phòng hoặc diện tích sàn", "buildings", null);
        }
        long outlier = n(outliers);
        add(items, "class_size_outlier", WARNING, outlier, fmt(outlier) + " lớp sĩ số lệch xa trung bình khối",
                "Kiểm tra lại sĩ số", "classes", null);
        long noSubject = n(r.get("no_subject"));
        add(items, "subject_room_no_subject", WARNING, noSubject, fmt(noSubject) + " phòng bộ môn chưa chọn môn",
                "Định mức thiết bị theo phòng bộ môn chưa tính được", "rooms", "subject_room_no_subject");

        items.sort(Comparator.comparing((TodoItem i) -> ERROR.equals(i.severity()) ? 0 : 1)
                .thenComparing(TodoItem::count, Comparator.reverseOrder()));
        return items;
    }

    /** Điều kiện của từng việc trên hạng mục — cùng điều kiện với số đếm ở {@link #todo}, để "Xem" mở đúng các dòng đó. */
    private static final Map<String, String> ROOM_CONDITIONS = Map.of(
            "no_structure", "r.structure IS NULL",
            "no_type", "r.room_type_id IS NULL",
            "no_area", """
                    r.area IS NULL AND EXISTS (
                        SELECT 1 FROM facility_standard_rules f
                        WHERE f.active AND f.room_type_id = r.room_type_id AND f.level_code = CAST(? AS VARCHAR)
                          AND (f.min_room_area IS NOT NULL OR f.area_per_student IS NOT NULL
                               OR f.min_total_area IS NOT NULL))""",
            "big_room", "r.area > CASE WHEN t.kind = 'AREA' THEN 20000 ELSE 500 END",
            "subject_room_no_subject", "t.functional AND r.subject_id IS NULL",
            "dup_name", """
                    EXISTS (SELECT 1 FROM rooms o WHERE o.school_id = r.school_id AND o.active AND o.id <> r.id
                              AND o.building_id IS NOT DISTINCT FROM r.building_id
                              AND lower(trim(o.name)) = lower(trim(r.name)))""");

    /** Các việc lọc được trên danh sách hạng mục ({@code todo=<khoá>}). */
    public static boolean isRoomKey(String key) {
        return ROOM_CONDITIONS.containsKey(key);
    }

    /** Id các hạng mục của một việc — danh sách hạng mục lọc {@code todo=<khoá>} qua đây. */
    @Transactional(readOnly = true)
    public List<Long> roomIds(Long schoolId, String key) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(schoolId)) {
            return List.of();
        }
        String condition = ROOM_CONDITIONS.get(key);
        if (condition == null) {
            return List.of();
        }
        String sql = "SELECT r.id FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id WHERE" + COUNTED
                + "AND " + condition;
        if ("no_area".equals(key)) {
            String level = jdbc.queryForObject("""
                    SELECT lv.code FROM schools s LEFT JOIN education_levels lv ON lv.id = s.education_level_id
                    WHERE s.id = ?""", String.class, schoolId);
            return jdbc.queryForList(sql, Long.class, schoolId, level);
        }
        return jdbc.queryForList(sql, Long.class, schoolId);
    }

    private static void add(List<TodoItem> items, String key, String severity, long count, String title,
            String impact, String kind, String filter) {
        if (count > 0) {
            items.add(new TodoItem(key, severity, count, title, impact, new TodoAction(kind, filter)));
        }
    }

    private static String fmt(long value) {
        return NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN")).format(value);
    }

    private static long n(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }
}
