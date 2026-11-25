package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.CampusRef;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Year;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hồ sơ năm học của trường (trưởng nhóm 25/11/2026): Sở đặt năm học mới thành hiện hành → mọi trường được báo và có nút
 * "Khai dữ liệu năm học" (lên lớp, chép phân công, điều chỉnh — {@link SchoolYearInitService}); trường rà soát, sửa rồi
 * lãnh đạo trường bấm "Xác nhận đã khai" → Sở được báo. Đang khai → Đã xác nhận, KHÔNG khoá: sau khi xác nhận trường vẫn
 * sửa được, hồ sơ ghi lần sửa cuối ({@link SchoolYearLock#touched}). Thiết bị chỉ vào sổ qua phiếu. Số liệu năm cũ không
 * chụp lúc xác nhận mà tính theo dữ liệu năm đó, thiết bị lấy sau đợt kiểm kê của năm ({@link YearAdequacyService}).
 *
 * <p>Xác nhận là của cả trường: dòng {@code school_year_profiles} có {@code campus_id} trống. Mỗi điểm trường chỉ có
 * danh sách việc còn thiếu — hết việc thiếu ở mọi điểm thì mới xác nhận được.
 */
@Service
@Transactional(readOnly = true)
public class SchoolYearProfileService {

    public static final String DRAFT = "DRAFT";
    public static final String CONFIRMED = "CONFIRMED";

    public record Todo(String part, String text, int count) {
    }

    public record CampusProfile(Long campusId, String campusName, boolean primary, int classes, int students,
            int teachers, int assignedTeachers, int rooms, int equipment, int equipmentNoRoom, int pendingAdjustments,
            List<Todo> todos) {
    }

    /** Năm học cần khai (năm hiện hành, trường chưa có lớp) và năm liền trước để chép. */
    public record InitYear(Long id, String name, String fromName) {
    }

    /**
     * {@code editedAt}: lần sửa cuối SAU khi xác nhận (trống = chưa sửa gì từ lúc xác nhận). {@code canConfirm}: người xem
     * là lãnh đạo cả trường của trường này, năm chưa xác nhận; {@code ready}: mọi điểm trường hết việc còn thiếu.
     */
    public record YearProfile(Long schoolId, String schoolName, Long schoolYearId, String schoolYearName,
            boolean current, String status, String confirmedAt, String confirmedBy, String editedAt,
            List<CampusProfile> campuses, boolean ready, boolean canConfirm, boolean canWrite, InitYear initYear) {
    }

    public record ProgressRow(Long schoolId, String schoolCode, String schoolName, String levelName, String wardName,
            String status, String confirmedAt, String editedAt) {
    }

    public record YearRequest(Long schoolYearId) {
    }

    private static final String TIME = "'DD/MM/YYYY HH24:MI'";

    /** Sửa trong vòng này kể từ lúc xác nhận coi như cùng lần xác nhận (cùng giao dịch, đồng hồ lệch). */
    private static final String EDITED_AFTER = "interval '1 minute'";

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;
    private final RowLevelPrincipalResolver principals;
    private final YearAdequacyService adequacy;
    private final NotificationService notifications;

    public SchoolYearProfileService(JdbcTemplate jdbc, VisibleSchools visibleSchools,
            RowLevelPrincipalResolver principals, YearAdequacyService adequacy, NotificationService notifications) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
        this.principals = principals;
        this.adequacy = adequacy;
        this.notifications = notifications;
    }

    // ------------------------------------------------------------------ đọc

    public YearProfile profile(Long schoolId, Long yearId) {
        Long school = schoolId != null ? schoolId : ownSchool();
        requireVisible(school);
        Year year = adequacy.year(yearId);
        String schoolName = jdbc.queryForObject("SELECT name FROM schools WHERE id = ?", String.class, school);
        List<CampusProfile> campuses = campusProfiles(school, year);
        boolean ready = !campuses.isEmpty() && campuses.stream()
                .allMatch(c -> c.todos().isEmpty() && c.pendingAdjustments() == 0);
        Map<String, Object> confirmation = confirmation(school, year.id());
        String status = confirmation == null ? DRAFT : CONFIRMED;
        RowLevelPrincipal p = principals.current().orElse(null);
        boolean own = p != null && Objects.equals(p.schoolId(), school) && p.campusId() == null;
        boolean canWrite = own && CurrentUser.has("school_year_profiles:write");
        boolean canConfirm = own && confirmation == null && CurrentUser.has("school_year_profiles:confirm");
        return new YearProfile(school, schoolName, year.id(), year.name(), year.current(), status,
                confirmation == null ? null : (String) confirmation.get("confirmed_at"),
                confirmation == null ? null : (String) confirmation.get("confirmed_by"),
                confirmation == null ? null : (String) confirmation.get("edited_at"),
                campuses, ready, canConfirm, canWrite, canWrite ? initYear(school, year) : null);
    }

    /** Tiến độ khai năm học của các trường trong phạm vi người xem. */
    public List<ProgressRow> progress(Long yearId) {
        Year year = adequacy.year(yearId);
        return jdbc.query("""
                SELECT s.id, s.code, s.name, lv.name AS level_name, COALESCE(w.name, NULLIF(s.ward_text, '')) AS ward,
                       to_char(pr.confirmed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s) AS confirmed_at,
                       CASE WHEN pr.updated_at > pr.confirmed_at + %s
                            THEN to_char(pr.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s) END AS edited_at
                FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                LEFT JOIN wards w ON w.id = s.ward_id
                LEFT JOIN school_year_profiles pr ON pr.school_id = s.id AND pr.school_year_id = ?
                     AND pr.campus_id IS NULL AND pr.status = 'CONFIRMED'
                WHERE s.status = 'ACTIVE'""".formatted(TIME, EDITED_AFTER, TIME) + visibleSchools.sqlFilter("s.id")
                + " ORDER BY s.name", (rs, i) -> new ProgressRow(rs.getLong("id"), rs.getString("code"),
                        rs.getString("name"), rs.getString("level_name"), rs.getString("ward"),
                        rs.getString("confirmed_at") == null ? DRAFT : CONFIRMED, rs.getString("confirmed_at"),
                        rs.getString("edited_at")), year.id());
    }

    // ------------------------------------------------------------------ ghi

    /**
     * Lãnh đạo trường xác nhận đã khai dữ liệu năm học: mọi điểm trường hết việc còn thiếu. Không khoá gì — chỉ đổi trạng
     * thái và báo cơ quan quản lý của trường.
     */
    @Transactional
    public YearProfile confirm(YearRequest request) {
        Long school = ownSchool();
        if (!CurrentUser.has("school_year_profiles:confirm")) {
            throw new AccessDeniedException("Chỉ lãnh đạo trường xác nhận năm học");
        }
        if (principals.current().map(RowLevelPrincipal::campusId).orElse(null) != null) {
            throw new AccessDeniedException("Chỉ lãnh đạo quản lý cả trường xác nhận năm học");
        }
        Year year = adequacy.year(request == null ? null : request.schoolYearId());
        if (confirmation(school, year.id()) != null) {
            throw new FieldValidationException("schoolYearId", year.name() + " đã xác nhận");
        }
        for (CampusProfile c : campusProfiles(school, year)) {
            if (!c.todos().isEmpty()) {
                throw new FieldValidationException("schoolYearId", c.campusName() + " còn việc chưa xong: "
                        + c.todos().get(0).text());
            }
        }
        jdbc.update("""
                INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at,
                    confirmed_by_id, updated_at)
                VALUES (?, ?, NULL, 'CONFIRMED', now(), ?, now())
                ON CONFLICT (school_id, school_year_id, (COALESCE(campus_id, 0))) DO UPDATE
                SET status = 'CONFIRMED', confirmed_at = now(), confirmed_by_id = EXCLUDED.confirmed_by_id,
                    updated_at = now()""", school, year.id(), CurrentUser.id().orElse(null));
        String schoolName = jdbc.queryForObject("SELECT name FROM schools WHERE id = ?", String.class, school);
        for (Long user : bodyUsers(school)) {
            notifications.notify(NotificationType.YEAR_PROFILE, user, NotificationLevel.INFO,
                    schoolName + " đã khai dữ liệu " + year.name().toLowerCase(),
                    "Lớp, sĩ số, phân công giáo viên, phòng đã khai đủ. Trường vẫn cập nhật khi có thay đổi.",
                    "/schools/show/" + school);
        }
        return profile(school, year.id());
    }

    // ------------------------------------------------------------------ nội bộ

    /** Lần xác nhận của cả trường cho một năm (trống = đang khai). */
    private Map<String, Object> confirmation(Long school, Long year) {
        return jdbc.queryForList("""
                SELECT to_char(p.confirmed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s) AS confirmed_at,
                       u.full_name AS confirmed_by,
                       CASE WHEN p.updated_at > p.confirmed_at + %s
                            THEN to_char(p.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s) END AS edited_at
                FROM school_year_profiles p LEFT JOIN users u ON u.id = p.confirmed_by_id
                WHERE p.school_id = ? AND p.school_year_id = ? AND p.campus_id IS NULL
                  AND p.status = 'CONFIRMED'""".formatted(TIME, EDITED_AFTER, TIME), school, year)
                .stream().findFirst().orElse(null);
    }

    /**
     * Năm học trường cần khai: năm đang xem là năm hiện hành mà trường chưa có lớp nào của năm đó. Năm liền trước (nếu
     * có) là nguồn chép lớp, phân công, điều chỉnh.
     */
    private InitYear initYear(Long school, Year year) {
        if (!year.current()) {
            return null;
        }
        Integer classes = jdbc.queryForObject("SELECT count(*)::int FROM school_classes WHERE school_id = ?"
                + " AND school_year_id = ?", Integer.class, school, year.id());
        if (classes != null && classes > 0) {
            return null;
        }
        String from = jdbc.queryForList("""
                SELECT p.name FROM school_years p, school_years y WHERE y.id = ? AND p.start_date < y.start_date
                ORDER BY p.start_date DESC LIMIT 1""", String.class, year.id()).stream().findFirst().orElse(null);
        return new InitYear(year.id(), year.name(), from);
    }

    /** Từng điểm trường: bốn phần dữ liệu và việc còn thiếu (phải trống mới xác nhận được). */
    List<CampusProfile> campusProfiles(Long school, Year year) {
        List<CampusRef> campuses = jdbc.query("SELECT id, name, is_primary FROM campuses WHERE school_id = ? AND active"
                + " ORDER BY is_primary DESC, sort_order NULLS LAST, name",
                (rs, i) -> new CampusRef(rs.getLong(1), rs.getString(2), rs.getBoolean(3)), school);
        if (campuses.isEmpty()) {
            campuses = List.of(new CampusRef(null, "Trường chính", true));
        }
        Map<Long, int[]> classes = countBy("""
                SELECT %s, count(*), COALESCE(sum(k.student_count), 0),
                       count(*) FILTER (WHERE COALESCE(k.student_count, 0) = 0), 0
                FROM school_classes k WHERE k.active AND k.school_id = ? AND k.school_year_id = ? GROUP BY 1""".formatted(
                FacilityCounting.campusOfRoomSql("k.room_id", "k.school_id")), school, year.id());
        String staffCampus = "(SELECT " + FacilityCounting.EFFECTIVE_CAMPUS + " FROM (SELECT 1) one"
                + FacilityCounting.campusJoins("st.campus_id", "st.school_id") + ")";
        String assignmentCampus = "(SELECT " + FacilityCounting.EFFECTIVE_CAMPUS + " FROM (SELECT 1) one"
                + FacilityCounting.campusJoins("a.campus_id", "a.school_id") + ")";
        // Giáo viên: năm hiện tại là giáo viên đang làm việc (theo điểm trường của hồ sơ); năm khác là người có phân công.
        Map<Long, int[]> teachers = year.current()
                ? countBy("""
                        SELECT %s, count(*),
                               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM staff_assignments a WHERE a.staff_id = st.id
                                   AND a.school_year_id = ? AND a.main_subject_id IS NOT NULL)), 0, 0
                        FROM staff st WHERE st.active AND st.staff_type = 'TEACHER' AND st.school_id = ?
                        GROUP BY 1""".formatted(staffCampus), year.id(), school)
                : countBy("""
                        SELECT %s, count(*), count(*) FILTER (WHERE a.main_subject_id IS NOT NULL), 0, 0
                        FROM staff_assignments a WHERE a.school_id = ? AND a.school_year_id = ?
                        GROUP BY 1""".formatted(assignmentCampus), school, year.id());
        Map<Long, int[]> rooms = countBy("""
                SELECT rc.campus_id, count(*), 0, 0, 0 FROM rooms r JOIN (%s) rc ON rc.room_id = r.id
                WHERE %s AND r.school_id = ? GROUP BY 1""".formatted(FacilityCounting.ROOM_CAMPUS,
                FacilityCounting.COUNTED_ROOM), school);
        Map<Long, int[]> equipment = countBy("""
                SELECT %s, count(*), count(*) FILTER (WHERE e.room_id IS NULL), 0, 0 FROM equipment e
                WHERE e.school_id = ? AND e.status <> 'LOST'
                GROUP BY 1""".formatted(FacilityCounting.campusOfRoomSql("e.room_id", "e.school_id")), school);
        Map<Long, int[]> pendingAdj = pendingAdjustments(school, year.id());
        List<CampusProfile> out = new ArrayList<>();
        for (CampusRef c : campuses) {
            long k = c.id() == null ? 0L : c.id();
            int[] cl = classes.getOrDefault(k, new int[4]);
            int[] te = teachers.getOrDefault(k, new int[4]);
            int[] ro = rooms.getOrDefault(k, new int[4]);
            int[] eq = equipment.getOrDefault(k, new int[4]);
            int pa = pendingAdj.getOrDefault(k, new int[4])[0];
            List<Todo> todos = new ArrayList<>();
            if (cl[0] == 0) {
                todos.add(new Todo("classes", "Chưa có lớp của năm học", 0));
            } else if (cl[2] > 0) {
                todos.add(new Todo("classes", cl[2] + " lớp chưa nhập sĩ số", cl[2]));
            }
            if (te[0] > te[1]) {
                todos.add(new Todo("teachers", (te[0] - te[1]) + " giáo viên chưa phân công", te[0] - te[1]));
            }
            if (ro[0] == 0) {
                todos.add(new Todo("rooms", "Chưa khai phòng", 0));
            }
            if (eq[1] > 0) {
                todos.add(new Todo("equipment", eq[1] + " thiết bị chưa xếp phòng", eq[1]));
            }
            if (pa > 0) {
                todos.add(new Todo("adjustments", pa + " điều chỉnh chờ xác nhận lại", pa));
            }
            out.add(new CampusProfile(c.id(), c.name(), c.primary(), cl[0], cl[1], te[0], te[1], ro[0], eq[0], eq[1],
                    pa, todos));
        }
        return out;
    }

    /** Điều chỉnh chép từ năm trước chưa xác nhận lại, theo điểm trường — bảng điều chỉnh của trường đếm (279). */
    Map<Long, int[]> pendingAdjustments(Long school, Long year) {
        return countBy("SELECT a.campus_id, count(*), 0, 0, 0 FROM school_norm_adjustments a WHERE a.school_id = ?"
                + " AND a.school_year_id = ? AND a.status = 'PENDING_RECONFIRM' GROUP BY 1", school, year);
    }

    /** Câu trả về (cơ sở, a, b, c, d) → bảng theo cơ sở (cơ sở trống = 0). */
    private Map<Long, int[]> countBy(String sql, Object... args) {
        Map<Long, int[]> out = new HashMap<>();
        jdbc.query(sql, rs -> {
            Object campus = rs.getObject(1);
            long k = campus == null ? 0L : ((Number) campus).longValue();
            int[] v = out.computeIfAbsent(k, x -> new int[4]);
            for (int i = 0; i < 4; i++) {
                v[i] += rs.getInt(i + 2);
            }
        }, args);
        return out;
    }

    /** Tài khoản của cơ quan quản lý (Sở) quản lý trường — người nhận báo "đã khai". */
    private List<Long> bodyUsers(Long school) {
        return jdbc.queryForList("""
                SELECT u.id FROM users u JOIN user_sos so ON so.id = u.id
                JOIN schools s ON s.department_of_education_id = so.managing_body_id
                WHERE s.id = ? AND u.status = 'ACTIVE'""", Long.class, school);
    }

    private void requireVisible(Long school) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(school)) {
            throw new ResourceNotFoundException("School", school);
        }
    }

    private Long ownSchool() {
        RowLevelPrincipal p = principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
        if (p.schoolId() == null) {
            throw new AccessDeniedException("Chỉ tài khoản của trường");
        }
        return p.schoolId();
    }
}
