package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.staff.StaffAssignmentService;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Khoá dữ liệu loại A (lớp, phân công giáo viên, điều chỉnh của trường) của năm học đã chốt — máy chủ chặn ghi
 * (docs/du-lieu-theo-nam-hoc.md §3). Và: sửa dữ liệu A của một điểm trường đã xác nhận thì điểm đó tự về "Đang khai".
 */
@Component
public class SchoolYearLock implements StaffAssignmentService.YearGuard {

    private final JdbcTemplate jdbc;

    public SchoolYearLock(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Năm học đã chốt (có bản chốt đang hiệu lực). */
    public boolean isClosed(Long schoolId, Long schoolYearId) {
        if (schoolId == null || schoolYearId == null) {
            return false;
        }
        Integer n = jdbc.queryForObject("SELECT count(*)::int FROM school_year_closings WHERE school_id = ?"
                + " AND school_year_id = ? AND status = 'CLOSED'", Integer.class, schoolId, schoolYearId);
        return n != null && n > 0;
    }

    @Override
    public void requireOpen(Long schoolId, Long schoolYearId) {
        if (isClosed(schoolId, schoolYearId)) {
            String name = jdbc.queryForList("SELECT name FROM school_years WHERE id = ?", String.class, schoolYearId)
                    .stream().findFirst().orElse("Năm học");
            throw new FieldValidationException("schoolYear", name + " đã chốt — không sửa được. Cần cơ quan quản lý mở lại.");
        }
    }

    /** {@code campusId} trống = cơ sở chính (hoặc trường chưa khai cơ sở). */
    @Override
    public void touched(Long schoolId, Long schoolYearId, Long campusId) {
        if (schoolId == null || schoolYearId == null) {
            return;
        }
        Long campus = campusId != null ? campusId : mainCampus(schoolId);
        jdbc.update("""
                UPDATE school_year_profiles SET status = 'DRAFT', confirmed_at = NULL, confirmed_by_id = NULL,
                    updated_at = now()
                WHERE school_id = ? AND school_year_id = ? AND COALESCE(campus_id, 0) = COALESCE(?::bigint, 0)
                  AND status = 'CONFIRMED'""", schoolId, schoolYearId, campus);
    }

    /** Cơ sở thực của một phòng (lớp học theo phòng học); phòng trống = cơ sở chính. */
    public Long campusOfRoom(Long roomId, Long schoolId) {
        if (roomId == null) {
            return mainCampus(schoolId);
        }
        return jdbc.queryForObject("SELECT " + FacilityCounting.campusOfRoomSql("?", "?"), Long.class, roomId,
                schoolId, schoolId);
    }

    Long mainCampus(Long schoolId) {
        return jdbc.queryForList("SELECT id FROM campuses WHERE school_id = ? AND is_primary AND active", Long.class,
                schoolId).stream().findFirst().orElse(null);
    }
}
