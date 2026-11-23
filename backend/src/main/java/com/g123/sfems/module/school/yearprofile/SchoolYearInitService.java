package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.staff.StaffAssignmentService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khởi tạo năm học mới (docs/du-lieu-theo-nam-hoc.md §4, màn C) từ năm học liền trước: lớp (lên lớp tự động / chép nguyên / để
 * trống), phân công giáo viên (bỏ người đã nghỉ), điều chỉnh chuẩn của trường (chờ xác nhận lại, bỏ dòng danh mục đã đổi /
 * ngừng). CSVC, thiết bị liên tục nên không chép. Lãnh đạo trường chạy cho trường mình; Sở chạy được cho nhiều trường.
 */
@Service
public class SchoolYearInitService {

    public enum Classes { PROMOTE, COPY, EMPTY }

    public record InitRequest(Long schoolYearId, @Size(max = 2000, message = "Tối đa 2.000 trường một lần") List<Long> schoolIds,
            Classes classes, Boolean copyAssignments, Boolean copyAdjustments) {
    }

    public record InitResult(int schools, int classes, int assignments, int adjustments, int skippedAdjustments) {
    }

    /** Chép điều chỉnh của trường sang năm mới — bảng điều chỉnh của trường cài (279). */
    public interface AdjustmentCopier {
        /** @return {chép được, bỏ qua} */
        int[] copy(Long schoolId, Long fromYearId, Long toYearId);
    }

    private static final Pattern LEADING = Pattern.compile("^(\\d{1,2})(.*)$");

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;
    private final RowLevelPrincipalResolver principals;
    private final StaffAssignmentService assignments;
    private final SchoolYearLock lock;
    private final List<AdjustmentCopier> copiers;

    public SchoolYearInitService(JdbcTemplate jdbc, VisibleSchools visibleSchools, RowLevelPrincipalResolver principals,
            StaffAssignmentService assignments, SchoolYearLock lock, List<AdjustmentCopier> copiers) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
        this.principals = principals;
        this.assignments = assignments;
        this.lock = lock;
        this.copiers = copiers;
    }

    @Transactional
    public InitResult init(InitRequest request) {
        if (request == null || request.schoolYearId() == null) {
            throw new FieldValidationException("schoolYearId", "Chọn năm học");
        }
        Long year = request.schoolYearId();
        Long from = jdbc.queryForList("""
                SELECT p.id FROM school_years p, school_years y WHERE y.id = ? AND p.start_date < y.start_date
                ORDER BY p.start_date DESC LIMIT 1""", Long.class, year).stream().findFirst()
                .orElseThrow(() -> new FieldValidationException("schoolYearId", "Không có năm học trước để chép"));
        List<Long> schools = schoolsOf(request);
        Classes mode = request.classes() == null ? Classes.PROMOTE : request.classes();
        int classes = 0;
        int staff = 0;
        int adjusted = 0;
        int skipped = 0;
        for (Long school : schools) {
            lock.requireOpen(school, year);
            if (mode != Classes.EMPTY) {
                classes += copyClasses(school, from, year, mode);
            }
            if (!Boolean.FALSE.equals(request.copyAssignments())) {
                staff += assignments.copy(school, year, null).copied();
            }
            if (!Boolean.FALSE.equals(request.copyAdjustments())) {
                for (AdjustmentCopier c : copiers) {
                    int[] r = c.copy(school, from, year);
                    adjusted += r[0];
                    skipped += r[1];
                }
            }
        }
        return new InitResult(schools.size(), classes, staff, adjusted, skipped);
    }

    /**
     * Lớp của năm trước sang năm mới, chỉ khi năm mới chưa có lớp nào (chạy lại không nhân đôi). Lên lớp: khối + 1, mã
     * "6A1" → "7A1", khối cuối cấp ra trường; chủ nhiệm để trống. Chép: nguyên khối, mã, chủ nhiệm. Sĩ số, phòng học giữ
     * để trường sửa.
     */
    int copyClasses(Long school, Long from, Long year, Classes mode) {
        Integer existing = jdbc.queryForObject(
                "SELECT count(*)::int FROM school_classes WHERE school_id = ? AND school_year_id = ?", Integer.class,
                school, year);
        if (existing != null && existing > 0) {
            return 0;
        }
        List<Map<String, Object>> source = jdbc.queryForList("""
                SELECT k.code, k.grade_id, g.code AS grade_code, g.sort_order AS grade_sort, g.education_level_id,
                       k.homeroom_teacher_id, k.room_id, k.student_count, k.sort_order, k.note
                FROM school_classes k JOIN grades g ON g.id = k.grade_id
                WHERE k.school_id = ? AND k.school_year_id = ? AND k.active""", school, from);
        int n = 0;
        Long user = CurrentUser.id().orElse(null);
        for (Map<String, Object> c : source) {
            Long grade = ((Number) c.get("grade_id")).longValue();
            String code = (String) c.get("code");
            Object homeroom = c.get("homeroom_teacher_id");
            Integer sort = (Integer) c.get("sort_order");
            if (mode == Classes.PROMOTE) {
                Map<String, Object> next = jdbc.queryForList("""
                        SELECT id, sort_order FROM grades WHERE education_level_id = ? AND sort_order > ?
                        ORDER BY sort_order LIMIT 1""", c.get("education_level_id"), c.get("grade_sort")).stream()
                        .findFirst().orElse(null);
                if (next == null) {
                    continue;
                }
                grade = ((Number) next.get("id")).longValue();
                code = promote(code);
                homeroom = null;
                sort = sort == null ? null : sort + 100;
            }
            n += jdbc.update("""
                    INSERT INTO school_classes (school_id, code, name, sort_order, active, note, grade_id, school_year_id,
                        homeroom_teacher_id, room_id, student_count, created_at, created_by_id)
                    VALUES (?, ?, ?, ?, TRUE, ?, ?, ?, ?, ?, ?, now(), ?)
                    ON CONFLICT (school_id, school_year_id, code) DO NOTHING""", school, code, "Lớp " + code, sort,
                    c.get("note"), grade, year, homeroom, c.get("room_id"), c.get("student_count"), user);
        }
        return n;
    }

    /** "6A1" → "7A1", "10C2" → "11C2"; mã không bắt đầu bằng số khối thì giữ nguyên. */
    static String promote(String code) {
        Matcher m = LEADING.matcher(code == null ? "" : code);
        return m.matches() ? (Integer.parseInt(m.group(1)) + 1) + m.group(2) : code;
    }

    private List<Long> schoolsOf(InitRequest request) {
        RowLevelPrincipal p = principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
        if (p.schoolId() != null) {
            if (p.campusId() != null) {
                throw new AccessDeniedException("Tài khoản một điểm trường không khởi tạo được năm học");
            }
            return List.of(p.schoolId());
        }
        if (request.schoolIds() == null || request.schoolIds().isEmpty()) {
            throw new FieldValidationException("schoolIds", "Chọn trường");
        }
        Set<Long> visible = visibleSchools.current();
        List<Long> out = new ArrayList<>();
        for (Long id : request.schoolIds()) {
            if (visible == null || visible.contains(id)) {
                out.add(id);
            }
        }
        if (out.isEmpty()) {
            throw new FieldValidationException("schoolIds", "Không có trường nào trong phạm vi");
        }
        return out;
    }
}
