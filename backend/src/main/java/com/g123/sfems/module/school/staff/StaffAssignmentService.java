package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phân công giáo viên theo năm học (docs/du-lieu-theo-nam-hoc.md §2.A, changelog 277): mỗi cán bộ một dòng mỗi năm học — điểm
 * trường, môn chính, các môn dạy. Hồ sơ cán bộ là một bản lâu dài; {@code staff.main_subject_id} / {@code staff_subjects}
 * / {@code staff.campus_id} là "phân công hiện tại": sửa phân công của NĂM HỌC HIỆN TẠI thì ghi cả hồ sơ, sửa hồ sơ
 * thì ghi phân công năm hiện tại ({@link #syncFromStaff}) — giai đoạn chuyển, các chỗ đang đọc hồ sơ không vỡ.
 *
 * <p>SQL thuần như đề nghị điều chỉnh (154): đọc trong phạm vi {@link VisibleSchools}, ghi chỉ trường của người gọi
 * (cơ sở của người gọi nếu tài khoản bị giới hạn một cơ sở). Năm học đã chốt thì không ghi được ({@link YearGuard}).
 */
@Service
@Transactional(readOnly = true)
public class StaffAssignmentService {

    public record Ref(Long id, String code, String name) {
    }

    public record Assignment(Long id, Long schoolId, Long schoolYearId, Long staffId, String staffCode,
            String staffName, boolean staffActive, Long campusId, String campusName, Ref mainSubject,
            List<Ref> subjects, List<String> homeroomClasses, String note) {
    }

    public record Candidate(Long id, String code, String name, Long campusId, Ref mainSubject, List<Ref> subjects) {
    }

    public record Input(IdRef schoolYear, IdRef staff, IdRef campus, IdRef mainSubject, List<IdRef> subjects,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note) {
    }

    public record CopyRequest(IdRef schoolYear) {
    }

    public record CopyResult(Long fromYearId, String fromYearName, int copied, int skipped) {
    }

    /**
     * Chặn ghi khi năm học đã chốt, và báo dữ liệu của một điểm trường vừa đổi (điểm đã xác nhận tự về "Đang khai").
     * Hồ sơ năm học (yearprofile) cài nó; không có bean nào thì không chặn gì.
     */
    public interface YearGuard {
        void requireOpen(Long schoolId, Long schoolYearId);

        void touched(Long schoolId, Long schoolYearId, Long campusId);
    }

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;
    private final RowLevelPrincipalResolver principals;
    private final CampusScope campuses;
    private final List<YearGuard> guards;

    public StaffAssignmentService(JdbcTemplate jdbc, VisibleSchools visibleSchools,
            RowLevelPrincipalResolver principals, CampusScope campuses, List<YearGuard> guards) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
        this.principals = principals;
        this.campuses = campuses;
        this.guards = guards;
    }

    // ------------------------------------------------------------------ đọc

    private static final String CAMPUS_OF = "(SELECT " + FacilityCounting.EFFECTIVE_CAMPUS + " FROM (SELECT 1) one"
            + FacilityCounting.campusJoins("a.campus_id", "a.school_id") + ")";

    /** Phân công của một năm học (mặc định năm hiện tại) của một trường (mặc định trường người gọi). */
    public List<Assignment> list(Long schoolId, Long yearId, Long campusId, Long subjectId, String q) {
        Long school = schoolId != null ? schoolId : principal().schoolId();
        if (school == null) {
            return List.of();
        }
        requireVisible(school);
        Long year = yearId != null ? yearId : currentYearId();
        StringBuilder where = new StringBuilder(" WHERE a.school_id = ? AND a.school_year_id = ?");
        List<Object> args = new ArrayList<>(List.of(school, year));
        Long campus = campuses.pinnedCampusIn(school) != null ? campuses.pinnedCampusIn(school) : campusId;
        if (campus != null) {
            where.append(" AND ").append(CAMPUS_OF).append(" = ?");
            args.add(campus);
        }
        if (subjectId != null) {
            where.append(" AND (a.main_subject_id = ? OR EXISTS (SELECT 1 FROM staff_assignment_subjects x"
                    + " WHERE x.assignment_id = a.id AND x.subject_id = ?))");
            args.add(subjectId);
            args.add(subjectId);
        }
        if (q != null && !q.isBlank()) {
            where.append(" AND (lower(st.name) LIKE ? OR lower(st.code) LIKE ?)");
            String like = "%" + q.trim().toLowerCase() + "%";
            args.add(like);
            args.add(like);
        }
        return query(where.toString(), args);
    }

    public Assignment get(Long id) {
        List<Assignment> found = query(" WHERE a.id = ?" + visibleSchools.sqlFilter("a.school_id"), List.of(id));
        if (found.isEmpty()) {
            throw new ResourceNotFoundException("StaffAssignment", id);
        }
        return found.get(0);
    }

    private List<Assignment> query(String where, List<Object> args) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.school_id, a.school_year_id, a.staff_id, st.code AS staff_code, st.name AS staff_name,
                       st.active AS staff_active, a.campus_id AS own_campus, %s AS campus_id, a.note,
                       ms.id AS ms_id, ms.code AS ms_code, ms.name AS ms_name
                FROM staff_assignments a
                JOIN staff st ON st.id = a.staff_id
                LEFT JOIN subjects ms ON ms.id = a.main_subject_id
                %s
                ORDER BY st.sort_order NULLS LAST, st.code""".formatted(CAMPUS_OF, where), args.toArray());
        if (rows.isEmpty()) {
            return List.of();
        }
        String ids = rows.stream().map(r -> String.valueOf(r.get("id"))).collect(Collectors.joining(","));
        Map<Long, List<Ref>> subjects = new LinkedHashMap<>();
        jdbc.query("""
                SELECT x.assignment_id, sj.id, sj.code, sj.name FROM staff_assignment_subjects x
                JOIN subjects sj ON sj.id = x.subject_id
                WHERE x.assignment_id IN (%s) ORDER BY sj.sort_order NULLS LAST, sj.name""".formatted(ids), rs -> {
            subjects.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                    .add(new Ref(rs.getLong(2), rs.getString(3), rs.getString(4)));
        });
        Map<String, List<String>> homeroom = new LinkedHashMap<>();
        jdbc.query("""
                SELECT a.id, k.code FROM staff_assignments a
                JOIN school_classes k ON k.homeroom_teacher_id = a.staff_id AND k.school_year_id = a.school_year_id
                WHERE a.id IN (%s) ORDER BY k.sort_order NULLS LAST, k.code""".formatted(ids), rs -> {
            homeroom.computeIfAbsent(String.valueOf(rs.getLong(1)), k -> new ArrayList<>()).add(rs.getString(2));
        });
        Map<Long, String> campusNames = new LinkedHashMap<>();
        jdbc.query("SELECT id, name FROM campuses WHERE school_id IN (SELECT school_id FROM staff_assignments"
                + " WHERE id IN (" + ids + "))", rs -> {
            campusNames.put(rs.getLong(1), rs.getString(2));
        });
        List<Assignment> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Long id = ((Number) r.get("id")).longValue();
            Long campus = r.get("campus_id") == null ? null : ((Number) r.get("campus_id")).longValue();
            Ref main = r.get("ms_id") == null ? null
                    : new Ref(((Number) r.get("ms_id")).longValue(), (String) r.get("ms_code"), (String) r.get("ms_name"));
            out.add(new Assignment(id, ((Number) r.get("school_id")).longValue(),
                    ((Number) r.get("school_year_id")).longValue(), ((Number) r.get("staff_id")).longValue(),
                    (String) r.get("staff_code"), (String) r.get("staff_name"), Boolean.TRUE.equals(r.get("staff_active")),
                    campus, campus == null ? null : campusNames.get(campus), main,
                    subjects.getOrDefault(id, List.of()), homeroom.getOrDefault(String.valueOf(id), List.of()),
                    (String) r.get("note")));
        }
        return out;
    }

    /** Giáo viên đang làm việc của trường chưa có phân công trong năm học — lựa chọn của hộp "Phân công". */
    public List<Candidate> candidates(Long yearId) {
        Long school = ownSchool();
        Long year = yearId != null ? yearId : currentYearId();
        Long pinned = campuses.pinnedCampusIn(school);
        List<Object> args = new ArrayList<>(List.of(school, year));
        String campusFilter = "";
        if (pinned != null) {
            campusFilter = " AND (SELECT " + FacilityCounting.EFFECTIVE_CAMPUS + " FROM (SELECT 1) one"
                    + FacilityCounting.campusJoins("st.campus_id", "st.school_id") + ") = ?";
            args.add(pinned);
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT st.id, st.code, st.name, st.campus_id, ms.id AS ms_id, ms.code AS ms_code, ms.name AS ms_name
                FROM staff st LEFT JOIN subjects ms ON ms.id = st.main_subject_id
                WHERE st.school_id = ? AND st.active AND st.staff_type = 'TEACHER'
                  AND NOT EXISTS (SELECT 1 FROM staff_assignments a WHERE a.staff_id = st.id AND a.school_year_id = ?)%s
                ORDER BY st.sort_order NULLS LAST, st.code""".formatted(campusFilter), args.toArray());
        Map<Long, List<Ref>> subjects = new LinkedHashMap<>();
        if (!rows.isEmpty()) {
            String ids = rows.stream().map(r -> String.valueOf(r.get("id"))).collect(Collectors.joining(","));
            jdbc.query("SELECT ss.staff_id, sj.id, sj.code, sj.name FROM staff_subjects ss JOIN subjects sj"
                    + " ON sj.id = ss.subject_id WHERE ss.staff_id IN (" + ids + ") ORDER BY sj.sort_order NULLS LAST",
                    rs -> {
                        subjects.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>())
                                .add(new Ref(rs.getLong(2), rs.getString(3), rs.getString(4)));
                    });
        }
        return rows.stream().map(r -> {
            Long id = ((Number) r.get("id")).longValue();
            return new Candidate(id, (String) r.get("code"), (String) r.get("name"),
                    r.get("campus_id") == null ? null : ((Number) r.get("campus_id")).longValue(),
                    r.get("ms_id") == null ? null : new Ref(((Number) r.get("ms_id")).longValue(),
                            (String) r.get("ms_code"), (String) r.get("ms_name")),
                    subjects.getOrDefault(id, List.of()));
        }).toList();
    }

    // ------------------------------------------------------------------ ghi

    @Transactional
    public Assignment create(Input in) {
        Long school = ownSchool();
        Long year = in == null || in.schoolYear() == null || in.schoolYear().id() == null ? currentYearId()
                : yearOf(in.schoolYear().id());
        if (in == null || in.staff() == null || in.staff().id() == null) {
            throw new FieldValidationException("staff", "Chọn cán bộ");
        }
        Map<String, Object> staff = staffOf(school, in.staff().id());
        if (!"TEACHER".equals(staff.get("staff_type"))) {
            throw new FieldValidationException("staff", "Chỉ phân công giáo viên");
        }
        Long campus = campusOf(school, in.campus(), staff.get("campus_id") == null ? null
                : ((Number) staff.get("campus_id")).longValue());
        guard(school, year, campus);
        Integer taken = jdbc.queryForObject(
                "SELECT count(*)::int FROM staff_assignments WHERE staff_id = ? AND school_year_id = ?",
                Integer.class, in.staff().id(), year);
        if (taken != null && taken > 0) {
            throw new ConflictException(staff.get("name") + " đã được phân công trong năm học này");
        }
        Long main = mainOf(in.mainSubject());
        Long id = jdbc.queryForObject("""
                INSERT INTO staff_assignments (school_id, school_year_id, staff_id, campus_id, main_subject_id, note,
                    created_at, created_by_id)
                VALUES (?, ?, ?, ?, ?, ?, now(), ?) RETURNING id""", Long.class, school, year, in.staff().id(), campus,
                main, blankToNull(in.note()), CurrentUser.id().orElse(null));
        writeSubjects(id, main, in.subjects());
        mirrorToStaff(id);
        return get(id);
    }

    @Transactional
    public Assignment update(Long id, Input in) {
        Assignment current = writable(id);
        Long campus = in.campus() == null ? current.campusId() : campusOf(current.schoolId(), in.campus(), null);
        guard(current.schoolId(), current.schoolYearId(), current.campusId());
        guard(current.schoolId(), current.schoolYearId(), campus);
        Long main = in.mainSubject() == null ? (current.mainSubject() == null ? null : current.mainSubject().id())
                : mainOf(in.mainSubject());
        jdbc.update("""
                UPDATE staff_assignments SET campus_id = ?, main_subject_id = ?, note = ?, updated_at = now(),
                    updated_by_id = ? WHERE id = ?""", campus, main,
                in.note() == null ? current.note() : blankToNull(in.note()), CurrentUser.id().orElse(null), id);
        if (in.subjects() != null || in.mainSubject() != null) {
            List<IdRef> subjects = in.subjects() != null ? in.subjects()
                    : current.subjects().stream().map(s -> new IdRef(s.id())).toList();
            jdbc.update("DELETE FROM staff_assignment_subjects WHERE assignment_id = ?", id);
            writeSubjects(id, main, subjects);
        }
        mirrorToStaff(id);
        return get(id);
    }

    @Transactional
    public Map<String, Object> delete(Long id) {
        Assignment current = writable(id);
        guard(current.schoolId(), current.schoolYearId(), current.campusId());
        jdbc.update("DELETE FROM staff_assignments WHERE id = ?", id);
        return Map.of("id", id);
    }

    /**
     * Chép phân công của năm học liền trước sang năm {@code schoolYear}: bỏ cán bộ đã nghỉ / không còn là giáo viên và
     * người đã có phân công năm này.
     */
    @Transactional
    public CopyResult copyFromPrevious(CopyRequest request) {
        Long school = ownSchool();
        Long year = request == null || request.schoolYear() == null || request.schoolYear().id() == null
                ? currentYearId() : yearOf(request.schoolYear().id());
        return copy(school, year, campuses.pinnedCampusIn(school));
    }

    /** Chép cho một trường — khởi tạo năm học mới dùng chung. {@code onlyCampus}: chỉ phân công của cơ sở đó. */
    @Transactional
    public CopyResult copy(Long school, Long year, Long onlyCampus) {
        guard(school, year, null);
        Map<String, Object> previous = jdbc.queryForList("""
                SELECT p.id, p.name FROM school_years p, school_years y
                WHERE y.id = ? AND p.start_date < y.start_date ORDER BY p.start_date DESC LIMIT 1""", year)
                .stream().findFirst()
                .orElseThrow(() -> new FieldValidationException("schoolYear", "Không có năm học trước để chép"));
        Long from = ((Number) previous.get("id")).longValue();
        List<Object> args = new ArrayList<>(List.of(school, from));
        String campusFilter = "";
        if (onlyCampus != null) {
            campusFilter = " AND " + CAMPUS_OF + " = ?";
            args.add(onlyCampus);
        }
        List<Map<String, Object>> source = jdbc.queryForList("""
                SELECT a.id, a.staff_id, a.campus_id, a.main_subject_id, a.note, st.active, st.staff_type,
                       EXISTS (SELECT 1 FROM staff_assignments b WHERE b.staff_id = a.staff_id
                               AND b.school_year_id = %d) AS taken
                FROM staff_assignments a JOIN staff st ON st.id = a.staff_id
                WHERE a.school_id = ? AND a.school_year_id = ?%s""".formatted(year, campusFilter), args.toArray());
        int copied = 0;
        int skipped = 0;
        Long user = CurrentUser.id().orElse(null);
        for (Map<String, Object> a : source) {
            if (!Boolean.TRUE.equals(a.get("active")) || !"TEACHER".equals(a.get("staff_type"))
                    || Boolean.TRUE.equals(a.get("taken"))) {
                skipped++;
                continue;
            }
            Long id = jdbc.queryForObject("""
                    INSERT INTO staff_assignments (school_id, school_year_id, staff_id, campus_id, main_subject_id, note,
                        created_at, created_by_id)
                    VALUES (?, ?, ?, ?, ?, ?, now(), ?) RETURNING id""", Long.class, school, year, a.get("staff_id"),
                    a.get("campus_id"), a.get("main_subject_id"), a.get("note"), user);
            jdbc.update("INSERT INTO staff_assignment_subjects (assignment_id, subject_id) SELECT ?, subject_id"
                    + " FROM staff_assignment_subjects WHERE assignment_id = ?", id, a.get("id"));
            mirrorToStaff(id);
            copied++;
        }
        return new CopyResult(from, (String) previous.get("name"), copied, skipped);
    }

    /**
     * Hồ sơ cán bộ vừa lưu (thêm / sửa / nhập): phân công của năm học hiện tại theo hồ sơ. Giáo viên đang làm việc thì
     * có phân công; không còn là giáo viên thì bỏ. Năm hiện tại đã chốt mà hồ sơ đổi môn / điểm trường thì từ chối.
     */
    @Transactional
    public void syncFromStaff(Staff staff) {
        Long year = currentYearIdOrNull();
        if (year == null || staff.getId() == null || staff.getSchool() == null) {
            return;
        }
        Long school = staff.getSchool().getId();
        Long main = staff.getMainSubject() == null ? null : staff.getMainSubject().getId();
        Long campus = staff.getCampus() == null ? null : staff.getCampus().getId();
        Set<Long> subjects = new LinkedHashSet<>();
        if (main != null) {
            subjects.add(main);
        }
        for (Subject s : staff.getSubjects()) {
            subjects.add(s.getId());
        }
        Map<String, Object> existing = jdbc.queryForList(
                "SELECT id, campus_id, main_subject_id FROM staff_assignments WHERE staff_id = ? AND school_year_id = ?",
                staff.getId(), year).stream().findFirst().orElse(null);
        boolean teaching = staff.getStaffType() == StaffType.TEACHER && Boolean.TRUE.equals(staff.getActive());
        if (existing == null) {
            if (teaching) {
                guard(school, year, campus);
                Long id = jdbc.queryForObject("""
                        INSERT INTO staff_assignments (school_id, school_year_id, staff_id, campus_id, main_subject_id,
                            created_at, created_by_id)
                        VALUES (?, ?, ?, ?, ?, now(), ?) RETURNING id""", Long.class, school, year, staff.getId(), campus,
                        main, CurrentUser.id().orElse(null));
                for (Long s : subjects) {
                    jdbc.update("INSERT INTO staff_assignment_subjects (assignment_id, subject_id) VALUES (?, ?)", id, s);
                }
            }
            return;
        }
        Long id = ((Number) existing.get("id")).longValue();
        Long oldCampus = existing.get("campus_id") == null ? null : ((Number) existing.get("campus_id")).longValue();
        Long oldMain = existing.get("main_subject_id") == null ? null
                : ((Number) existing.get("main_subject_id")).longValue();
        Set<Long> oldSubjects = new LinkedHashSet<>(jdbc.queryForList(
                "SELECT subject_id FROM staff_assignment_subjects WHERE assignment_id = ?", Long.class, id));
        if (staff.getStaffType() != StaffType.TEACHER) {
            guard(school, year, oldCampus);
            jdbc.update("DELETE FROM staff_assignments WHERE id = ?", id);
            return;
        }
        if (Objects.equals(oldCampus, campus) && Objects.equals(oldMain, main) && oldSubjects.equals(subjects)) {
            return;
        }
        guard(school, year, oldCampus);
        guard(school, year, campus);
        jdbc.update("UPDATE staff_assignments SET campus_id = ?, main_subject_id = ?, updated_at = now(),"
                + " updated_by_id = ? WHERE id = ?", campus, main, CurrentUser.id().orElse(null), id);
        jdbc.update("DELETE FROM staff_assignment_subjects WHERE assignment_id = ?", id);
        for (Long s : subjects) {
            jdbc.update("INSERT INTO staff_assignment_subjects (assignment_id, subject_id) VALUES (?, ?)", id, s);
        }
    }

    // ------------------------------------------------------------------ nội bộ

    /** Phân công của năm học hiện tại là "phân công hiện tại" trên hồ sơ cán bộ: ghi lại môn chính, môn dạy, điểm trường. */
    private void mirrorToStaff(Long assignmentId) {
        Map<String, Object> a = jdbc.queryForMap("""
                SELECT a.staff_id, a.campus_id, a.main_subject_id, y.is_current FROM staff_assignments a
                JOIN school_years y ON y.id = a.school_year_id WHERE a.id = ?""", assignmentId);
        if (!Boolean.TRUE.equals(a.get("is_current"))) {
            return;
        }
        Object staff = a.get("staff_id");
        jdbc.update("UPDATE staff SET main_subject_id = ?, campus_id = ?, updated_at = now() WHERE id = ?",
                a.get("main_subject_id"), a.get("campus_id"), staff);
        jdbc.update("DELETE FROM staff_subjects WHERE staff_id = ?", staff);
        jdbc.update("INSERT INTO staff_subjects (staff_id, subject_id) SELECT ?, subject_id FROM staff_assignment_subjects"
                + " WHERE assignment_id = ?", staff, assignmentId);
    }

    private void writeSubjects(Long id, Long main, List<IdRef> refs) {
        Set<Long> ids = new LinkedHashSet<>();
        if (main != null) {
            ids.add(main);
        }
        if (refs != null) {
            for (IdRef r : refs) {
                if (r != null && r.id() != null) {
                    ids.add(r.id());
                }
            }
        }
        if (!ids.isEmpty()) {
            Integer known = jdbc.queryForObject("SELECT count(*)::int FROM subjects WHERE id IN ("
                    + ids.stream().map(String::valueOf).collect(Collectors.joining(",")) + ")", Integer.class);
            if (known == null || known != ids.size()) {
                throw new FieldValidationException("subjects", "Môn dạy không có trong danh mục");
            }
        }
        for (Long s : ids) {
            jdbc.update("INSERT INTO staff_assignment_subjects (assignment_id, subject_id) VALUES (?, ?)", id, s);
        }
    }

    private Long mainOf(IdRef ref) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("mainSubject", "Chọn môn chính");
        }
        Integer n = jdbc.queryForObject("SELECT count(*)::int FROM subjects WHERE id = ?", Integer.class, ref.id());
        if (n == null || n == 0) {
            throw new FieldValidationException("mainSubject", "Môn không có trong danh mục");
        }
        return ref.id();
    }

    /** Điểm trường của phân công: chọn thì phải thuộc trường, còn dùng; tài khoản một cơ sở chỉ cơ sở của mình. */
    private Long campusOf(Long school, IdRef ref, Long fallback) {
        Long pinned = campuses.pinnedCampusIn(school);
        Long campus = ref != null && ref.id() != null ? ref.id() : fallback;
        if (campus != null) {
            Integer ok = jdbc.queryForObject("SELECT count(*)::int FROM campuses WHERE id = ? AND school_id = ? AND active",
                    Integer.class, campus, school);
            if (ok == null || ok == 0) {
                throw new FieldValidationException("campus", "Điểm trường không thuộc trường hoặc đã ngừng dùng");
            }
        }
        if (pinned != null && !pinned.equals(campus == null ? mainCampus(school) : campus)) {
            throw new FieldValidationException("campus", "Không thuộc cơ sở của tài khoản");
        }
        return campus;
    }

    private Long mainCampus(Long school) {
        return jdbc.queryForList("SELECT id FROM campuses WHERE school_id = ? AND is_primary AND active", Long.class,
                school).stream().findFirst().orElse(null);
    }

    private Assignment writable(Long id) {
        Long school = ownSchool();
        Assignment a = get(id);
        if (!a.schoolId().equals(school)) {
            throw new ResourceNotFoundException("StaffAssignment", id);
        }
        Long pinned = campuses.pinnedCampusIn(school);
        if (pinned != null && !pinned.equals(a.campusId())) {
            throw new FieldValidationException("campus", "Không thuộc cơ sở của tài khoản");
        }
        return a;
    }

    private Map<String, Object> staffOf(Long school, Long staffId) {
        return jdbc.queryForList("SELECT id, name, staff_type, campus_id, active FROM staff WHERE id = ? AND school_id = ?",
                staffId, school).stream().findFirst()
                .orElseThrow(() -> new FieldValidationException("staff", "Cán bộ không thuộc trường"));
    }

    private void guard(Long school, Long year, Long campus) {
        for (YearGuard g : guards) {
            g.requireOpen(school, year);
            g.touched(school, year, campus);
        }
    }

    private Long yearOf(Long id) {
        Integer n = jdbc.queryForObject("SELECT count(*)::int FROM school_years WHERE id = ?", Integer.class, id);
        if (n == null || n == 0) {
            throw new FieldValidationException("schoolYear", "Năm học không có trong danh mục");
        }
        return id;
    }

    private Long currentYearId() {
        Long id = currentYearIdOrNull();
        if (id == null) {
            throw new FieldValidationException("schoolYear", "Chưa đặt năm học hiện tại");
        }
        return id;
    }

    private Long currentYearIdOrNull() {
        return jdbc.queryForList("SELECT id FROM school_years WHERE is_current", Long.class).stream().findFirst()
                .orElse(null);
    }

    private void requireVisible(Long school) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(school)) {
            throw new ResourceNotFoundException("School", school);
        }
    }

    private RowLevelPrincipal principal() {
        return principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
    }

    private Long ownSchool() {
        Long school = principal().schoolId();
        if (school == null) {
            throw new AccessDeniedException("Chỉ tài khoản của trường phân công giáo viên");
        }
        return school;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
