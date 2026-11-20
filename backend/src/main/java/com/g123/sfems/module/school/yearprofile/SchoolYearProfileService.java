package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.procurement.YearAdequacyService;
import com.g123.sfems.module.school.procurement.YearAdequacyService.CampusRef;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Row;
import com.g123.sfems.module.school.procurement.YearAdequacyService.SchoolYearResult;
import com.g123.sfems.module.school.procurement.YearAdequacyService.Year;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.system.notification.service.NotificationService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
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
 * Hồ sơ năm học (docs/du-lieu-theo-nam-hoc.md §3, màn A / E / F): mỗi trường × năm học × điểm trường có trạng thái Đang khai → Đã
 * xác nhận; cả trường Đã chốt khi lãnh đạo trường chốt (mọi điểm đã xác nhận, mọi điều chỉnh chép sang đã xác nhận lại)
 * — lưu bản chốt {@code school_year_closings} + dòng {@code school_year_closing_lines}; khoá dữ liệu A của năm đó
 * ({@link SchoolYearLock}). Mở lại: cơ quan quản lý CỦA trường (Sở), bắt buộc lý do; bản chốt cũ giữ làm lịch
 * sử, trường sửa rồi chốt lại.
 */
@Service
@Transactional(readOnly = true)
public class SchoolYearProfileService {

    public record Todo(String part, String text, int count) {
    }

    public record CampusProfile(Long campusId, String campusName, boolean primary, String status, String confirmedAt,
            String confirmedBy, int classes, int students, int teachers, int assignedTeachers, int rooms,
            int equipment, int equipmentNoRoom, int pendingAdjustments, List<Todo> todos) {
    }

    public record ClosingInfo(Long id, String status, String closedAt, String closedBy, String reopenedAt,
            String reopenedBy, String reopenReason) {
    }

    public record NextYear(Long id, String name) {
    }

    public record YearProfile(Long schoolId, String schoolName, Long schoolYearId, String schoolYearName,
            boolean current, String status, ClosingInfo closing, List<ClosingInfo> history,
            List<CampusProfile> campuses, boolean canConfirm, boolean canClose, boolean canReopen, boolean canWrite,
            NextYear nextYear) {
    }

    public record ProgressRow(Long schoolId, String schoolCode, String schoolName, String levelName, String wardName,
            int campuses, int confirmed, String status, String closedAt, boolean reopened, boolean canReopen) {
    }

    public record CampusRequest(Long schoolYearId, Long campusId) {
    }

    public record YearRequest(Long schoolYearId) {
    }

    public record ReopenRequest(Long schoolId, Long schoolYearId,
            @Text(value = FieldRule.LONG_TEXT, label = "Lý do", max = 1000) String reason) {
    }

    private static final String TIME = "'DD/MM/YYYY HH24:MI'";

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
        Map<String, Object> s = jdbc.queryForMap("SELECT name, department_of_education_id FROM schools WHERE id = ?",
                school);
        List<ClosingInfo> closings = closings(school, year.id());
        ClosingInfo active = closings.stream().filter(c -> "CLOSED".equals(c.status())).findFirst().orElse(null);
        List<CampusProfile> campuses = campusProfiles(school, year);
        boolean allConfirmed = !campuses.isEmpty() && campuses.stream().allMatch(c -> "CONFIRMED".equals(c.status()));
        String status = active != null ? "CLOSED"
                : !closings.isEmpty() ? "REOPENED"
                : allConfirmed ? "CONFIRMED" : "DRAFT";
        RowLevelPrincipal p = principals.current().orElse(null);
        boolean own = p != null && Objects.equals(p.schoolId(), school) && p.campusId() == null;
        boolean canConfirm = own && active == null && CurrentUser.has("school_year_profiles:confirm");
        Long body = s.get("department_of_education_id") == null ? null
                : ((Number) s.get("department_of_education_id")).longValue();
        boolean canReopen = active != null && mayReopen(p, body);
        NextYear next = jdbc.query("""
                SELECT n.id, n.name FROM school_years n, school_years y
                WHERE y.id = ? AND n.start_date > y.start_date
                  AND NOT EXISTS (SELECT 1 FROM school_classes k WHERE k.school_id = ? AND k.school_year_id = n.id)
                ORDER BY n.start_date LIMIT 1""", (rs, i) -> new NextYear(rs.getLong(1), rs.getString(2)), year.id(),
                school).stream().findFirst().orElse(null);
        return new YearProfile(school, (String) s.get("name"), year.id(), year.name(), year.current(), status, active,
                closings, campuses, canConfirm, canConfirm && allConfirmed
                && campuses.stream().allMatch(c -> c.pendingAdjustments() == 0), canReopen,
                own && CurrentUser.has("school_year_profiles:write"), next);
    }

    /** Năm học đã chốt của trường — lớp, phân công, điều chỉnh chỉ xem. */
    public boolean closed(Long schoolId, Long yearId) {
        Long school = schoolId != null ? schoolId : principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (school == null) {
            return false;
        }
        requireVisible(school);
        return isClosed(school, adequacy.year(yearId).id());
    }

    boolean isClosed(Long school, Long year) {
        Integer n = jdbc.queryForObject("SELECT count(*)::int FROM school_year_closings WHERE school_id = ?"
                + " AND school_year_id = ? AND status = 'CLOSED'", Integer.class, school, year);
        return n != null && n > 0;
    }

    /** Tiến độ hồ sơ năm học các trường trong phạm vi người xem (màn E). */
    public List<ProgressRow> progress(Long yearId) {
        Year year = adequacy.year(yearId);
        RowLevelPrincipal p = principals.current().orElse(null);
        boolean reopenPermission = CurrentUser.has("school_year_profiles:reopen");
        return jdbc.query("""
                SELECT s.id, s.code, s.name, lv.name AS level_name, COALESCE(w.name, NULLIF(s.ward_text, '')) AS ward,
                       s.department_of_education_id AS body,
                       GREATEST((SELECT count(*) FROM campuses c WHERE c.school_id = s.id AND c.active), 1)::int AS campuses,
                       (SELECT count(*) FROM school_year_profiles pr JOIN campuses c ON c.id = pr.campus_id AND c.active
                         WHERE pr.school_id = s.id AND pr.school_year_id = ? AND pr.status = 'CONFIRMED')::int
                       + (SELECT count(*) FROM school_year_profiles pr WHERE pr.school_id = s.id AND pr.school_year_id = ?
                          AND pr.campus_id IS NULL AND pr.status = 'CONFIRMED'
                          AND NOT EXISTS (SELECT 1 FROM campuses c WHERE c.school_id = s.id AND c.active))::int AS confirmed,
                       cl.closed_at, EXISTS (SELECT 1 FROM school_year_closings r WHERE r.school_id = s.id
                         AND r.school_year_id = ? AND r.status = 'REOPENED') AS reopened
                FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                LEFT JOIN wards w ON w.id = s.ward_id
                LEFT JOIN LATERAL (SELECT to_char(x.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS closed_at
                                   FROM school_year_closings x WHERE x.school_id = s.id AND x.school_year_id = ?
                                     AND x.status = 'CLOSED' LIMIT 1) cl ON TRUE
                WHERE s.status = 'ACTIVE'""" + visibleSchools.sqlFilter("s.id") + " ORDER BY s.name", (rs, i) -> {
            int campuses = rs.getInt("campuses");
            int confirmed = rs.getInt("confirmed");
            boolean closed = rs.getString("closed_at") != null;
            boolean reopened = rs.getBoolean("reopened");
            String status = closed ? "CLOSED" : reopened ? "REOPENED" : confirmed >= campuses ? "CONFIRMED" : "DRAFT";
            Long body = (Long) rs.getObject("body");
            return new ProgressRow(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                    rs.getString("level_name"), rs.getString("ward"), campuses, Math.min(confirmed, campuses), status,
                    rs.getString("closed_at"), reopened, closed && reopenPermission && bodyMatches(p, body));
        }, year.id(), year.id(), year.id(), year.id());
    }

    // ------------------------------------------------------------------ ghi

    /** Lãnh đạo trường xác nhận dữ liệu một điểm trường — danh sách việc còn thiếu phải trống. */
    @Transactional
    public YearProfile confirm(CampusRequest request) {
        Long school = ownSchool();
        requireConfirmer();
        Year year = adequacy.year(request == null ? null : request.schoolYearId());
        requireOpen(school, year.id());
        CampusProfile campus = campusProfiles(school, year).stream()
                .filter(c -> Objects.equals(c.campusId(), request == null ? null : request.campusId()))
                .findFirst().orElseThrow(() -> new FieldValidationException("campusId", "Điểm trường không thuộc trường"));
        if (!campus.todos().isEmpty()) {
            throw new FieldValidationException("campusId", campus.campusName() + " còn việc chưa xong: "
                    + campus.todos().get(0).text());
        }
        jdbc.update("""
                INSERT INTO school_year_profiles (school_id, school_year_id, campus_id, status, confirmed_at,
                    confirmed_by_id, updated_at)
                VALUES (?, ?, ?, 'CONFIRMED', now(), ?, now())
                ON CONFLICT (school_id, school_year_id, COALESCE(campus_id, 0)) DO UPDATE SET status = 'CONFIRMED',
                    confirmed_at = now(), confirmed_by_id = EXCLUDED.confirmed_by_id, updated_at = now()""",
                school, year.id(), campus.campusId(), CurrentUser.id().orElse(null));
        return profile(school, year.id());
    }

    @Transactional
    public YearProfile unconfirm(CampusRequest request) {
        Long school = ownSchool();
        requireConfirmer();
        Year year = adequacy.year(request == null ? null : request.schoolYearId());
        requireOpen(school, year.id());
        jdbc.update("""
                UPDATE school_year_profiles SET status = 'DRAFT', confirmed_at = NULL, confirmed_by_id = NULL,
                    updated_at = now()
                WHERE school_id = ? AND school_year_id = ? AND COALESCE(campus_id, 0) = COALESCE(?::bigint, 0)""",
                school, year.id(), request == null ? null : request.campusId());
        return profile(school, year.id());
    }

    /** Chốt năm học: mọi điểm trường đã xác nhận → lưu bản chốt (dòng chuẩn tối thiểu + số đầu vào), khoá dữ liệu A. */
    @Transactional
    public YearProfile close(YearRequest request) {
        Long school = ownSchool();
        requireConfirmer();
        Year year = adequacy.year(request == null ? null : request.schoolYearId());
        requireOpen(school, year.id());
        List<CampusProfile> campuses = campusProfiles(school, year);
        CampusProfile draft = campuses.stream().filter(c -> !"CONFIRMED".equals(c.status())).findFirst().orElse(null);
        if (draft != null) {
            throw new FieldValidationException("schoolYearId", draft.campusName() + " chưa xác nhận");
        }
        CampusProfile pending = campuses.stream().filter(c -> c.pendingAdjustments() > 0).findFirst().orElse(null);
        if (pending != null) {
            throw new FieldValidationException("schoolYearId", pending.campusName() + " còn "
                    + pending.pendingAdjustments() + " điều chỉnh chép từ năm trước chưa xác nhận lại");
        }
        SchoolYearResult result = adequacy.compute(Set.of(school), year).get(school);
        Long closing = jdbc.queryForObject("""
                INSERT INTO school_year_closings (school_id, school_year_id, status, closed_at, closed_by_id)
                VALUES (?, ?, 'CLOSED', now(), ?) RETURNING id""", Long.class, school, year.id(),
                CurrentUser.id().orElse(null));
        List<Object[]> lines = new ArrayList<>();
        for (Row r : result.campusRows()) {
            lines.add(new Object[] {closing, r.campusId(), r.campusName(), r.normId(), r.normCode(), r.catalogId(),
                r.catalogCode(), r.name(), r.subjectName(), r.unitName(), r.allowedKind(), r.basisText(),
                r.requiredTt(), r.requiredAdjusted(), r.current(), r.broken(), r.lost(), r.pendingDisposal(),
                r.shortageTt(), r.shortageAdjusted(), r.surplus(), r.outsideNeed(), r.proposed(),
                r.adjustment() == null ? null : r.adjustment().kind(),
                r.adjustment() == null ? null : r.adjustment().status(),
                r.adjustment() == null ? null : r.adjustment().reason(), clip(r.warning(), 255)});
        }
        jdbc.batchUpdate("""
                INSERT INTO school_year_closing_lines (closing_id, campus_id, campus_name, norm_id, norm_code, catalog_id,
                    catalog_code, name, subject_name, unit_name, allowed_kind, basis_text, required_tt, required_adjusted,
                    current_qty, broken, lost, pending_disposal, shortage_tt, shortage_adjusted, surplus, outside_need,
                    proposed, adjust_kind, adjust_status, adjust_reason, warning)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", lines);
        snapshotInputs(closing, school, year);
        return profile(school, year.id());
    }

    /** Mở lại năm đã chốt — chỉ cơ quan quản lý của trường, bắt buộc lý do; trường được báo. */
    @Transactional
    public YearProfile reopen(ReopenRequest request) {
        if (request == null || request.schoolId() == null) {
            throw new FieldValidationException("schoolId", "Chọn trường");
        }
        Long school = request.schoolId();
        requireVisible(school);
        Year year = adequacy.year(request.schoolYearId());
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty()) {
            throw new FieldValidationException("reason", "Vui lòng nhập lý do mở lại");
        }
        Long body = jdbc.queryForObject("SELECT department_of_education_id FROM schools WHERE id = ?", Long.class, school);
        if (!mayReopen(principals.current().orElse(null), body)) {
            throw new AccessDeniedException("Chỉ cơ quan quản lý của trường mở lại được năm học đã chốt");
        }
        int n = jdbc.update("""
                UPDATE school_year_closings SET status = 'REOPENED', reopened_at = now(), reopened_by_id = ?,
                    reopen_reason = ? WHERE school_id = ? AND school_year_id = ? AND status = 'CLOSED'""",
                CurrentUser.id().orElse(null), reason, school, year.id());
        if (n == 0) {
            throw new FieldValidationException("schoolYearId", year.name() + " của trường chưa chốt");
        }
        // Mở lại thì trường khai lại: mọi điểm về "Đang khai".
        jdbc.update("UPDATE school_year_profiles SET status = 'DRAFT', confirmed_at = NULL, confirmed_by_id = NULL,"
                + " updated_at = now() WHERE school_id = ? AND school_year_id = ?", school, year.id());
        for (Long user : schoolUsers(school)) {
            notifications.notify(user, NotificationLevel.WARNING,
                    year.name() + " đã được mở lại", "Lý do: " + reason + ". Sửa dữ liệu rồi chốt lại.",
                    "/school-year-profile?year=" + year.id());
        }
        return profile(school, year.id());
    }

    // ------------------------------------------------------------------ nội bộ

    private List<ClosingInfo> closings(Long school, Long year) {
        return jdbc.query("""
                SELECT c.id, c.status, to_char(c.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s) AS closed_at,
                       cu.full_name AS closed_by, to_char(c.reopened_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s) AS reopened_at,
                       ru.full_name AS reopened_by, c.reopen_reason
                FROM school_year_closings c LEFT JOIN users cu ON cu.id = c.closed_by_id
                LEFT JOIN users ru ON ru.id = c.reopened_by_id
                WHERE c.school_id = ? AND c.school_year_id = ?
                ORDER BY c.closed_at DESC""".formatted(TIME, TIME),
                (rs, i) -> new ClosingInfo(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6), rs.getString(7)), school, year);
    }

    /** Từng điểm trường: bốn phần dữ liệu, trạng thái, và việc còn thiếu (phải trống mới xác nhận được). */
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
                WHERE e.school_id = ? AND e.status NOT IN ('LIQUIDATED', 'DESTROYED', 'LOST', 'NOT_DELIVERED', 'USED_UP')
                GROUP BY 1""".formatted(FacilityCounting.campusOfRoomSql("e.room_id", "e.school_id")), school);
        Map<Long, int[]> pendingAdj = pendingAdjustments(school, year.id());
        Map<Long, Object[]> status = new HashMap<>();
        jdbc.query("""
                SELECT COALESCE(p.campus_id, 0), p.status,
                       to_char(p.confirmed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', %s), u.full_name
                FROM school_year_profiles p LEFT JOIN users u ON u.id = p.confirmed_by_id
                WHERE p.school_id = ? AND p.school_year_id = ?""".formatted(TIME), rs -> {
            status.put(rs.getLong(1), new Object[] {rs.getString(2), rs.getString(3), rs.getString(4)});
        }, school, year.id());
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
            Object[] st = status.get(k);
            out.add(new CampusProfile(c.id(), c.name(), c.primary(), st == null ? "DRAFT" : (String) st[0],
                    st == null ? null : (String) st[1], st == null ? null : (String) st[2], cl[0], cl[1], te[0], te[1],
                    ro[0], eq[0], eq[1], pa, todos));
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

    private void snapshotInputs(Long closing, Long school, Year year) {
        jdbc.update("""
                INSERT INTO school_year_closing_inputs (closing_id, campus_id, kind, ref_id, ref_name, classes, students)
                SELECT ?, %s, 'GRADE', g.id, g.name, count(*), COALESCE(sum(k.student_count), 0)
                FROM school_classes k JOIN grades g ON g.id = k.grade_id
                WHERE k.active AND k.school_id = ? AND k.school_year_id = ? GROUP BY 2, g.id, g.name""".formatted(
                FacilityCounting.campusOfRoomSql("k.room_id", "k.school_id")), closing, school, year.id());
        String assignmentCampus = "(SELECT " + FacilityCounting.EFFECTIVE_CAMPUS + " FROM (SELECT 1) one"
                + FacilityCounting.campusJoins("a.campus_id", "a.school_id") + ")";
        jdbc.update("""
                INSERT INTO school_year_closing_inputs (closing_id, campus_id, kind, ref_id, ref_name, teachers)
                SELECT ?, %s, 'SUBJECT', sj.id, sj.name, count(DISTINCT a.staff_id)
                FROM staff_assignments a JOIN staff_assignment_subjects x ON x.assignment_id = a.id
                JOIN subjects sj ON sj.id = x.subject_id
                WHERE a.school_id = ? AND a.school_year_id = ? GROUP BY 2, sj.id, sj.name""".formatted(assignmentCampus),
                closing, school, year.id());
        jdbc.update("""
                INSERT INTO school_year_closing_inputs (closing_id, campus_id, kind, ref_id, ref_name, rooms)
                SELECT ?, rc.campus_id, 'SUBJECT', sj.id, sj.name, count(*) FROM rooms r JOIN (%s) rc ON rc.room_id = r.id
                JOIN subjects sj ON sj.id = r.subject_id
                WHERE %s AND r.school_id = ? GROUP BY 2, sj.id, sj.name""".formatted(FacilityCounting.ROOM_CAMPUS,
                FacilityCounting.COUNTED_ROOM), closing, school);
    }

    private boolean mayReopen(RowLevelPrincipal p, Long body) {
        return CurrentUser.has("school_year_profiles:reopen") && bodyMatches(p, body);
    }

    /** Cơ quan quản lý CỦA trường (Sở), hoặc quản trị. */
    private static boolean bodyMatches(RowLevelPrincipal p, Long body) {
        return p != null && (p.roleCodes().contains("ADMIN")
                || (p.managingBodyId() != null && p.managingBodyId().equals(body)));
    }

    private List<Long> schoolUsers(Long school) {
        return jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u JOIN user_schools us ON us.id = u.id
                JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                WHERE us.school_id = ? AND u.status = 'ACTIVE' AND r.code IN ('SCHOOL_LEADER', 'SCHOOL_STAFF')""",
                Long.class, school);
    }

    private void requireOpen(Long school, Long year) {
        if (isClosed(school, year)) {
            throw new FieldValidationException("schoolYearId", "Năm học đã chốt");
        }
    }

    private void requireConfirmer() {
        if (!CurrentUser.has("school_year_profiles:confirm")) {
            throw new AccessDeniedException("Chỉ lãnh đạo trường xác nhận, chốt năm học");
        }
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

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
