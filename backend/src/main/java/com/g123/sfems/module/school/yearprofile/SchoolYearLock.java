package com.g123.sfems.module.school.yearprofile;

import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.staff.StaffAssignmentService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Dữ liệu năm học của trường (lớp, phân công giáo viên, điều chỉnh) KHÔNG khoá: trường đã xác nhận khai vẫn sửa được
 * (trưởng nhóm 25/11/2026). Sửa sau khi xác nhận thì hồ sơ năm học giữ "Đã xác nhận" và ghi lần sửa cuối để Sở thấy.
 * Thiết bị không qua đây — sau khi khoá khai thiết bị ban đầu chỉ vào sổ qua phiếu.
 */
@Component
public class SchoolYearLock implements StaffAssignmentService.YearGuard {

    private final JdbcTemplate jdbc;

    public SchoolYearLock(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Ghi lần sửa cuối vào hồ sơ đã xác nhận của cả trường ({@code campusId} không dùng — xác nhận là của cả trường). */
    @Override
    public void touched(Long schoolId, Long schoolYearId, Long campusId) {
        if (schoolId == null || schoolYearId == null) {
            return;
        }
        jdbc.update("""
                UPDATE school_year_profiles SET updated_at = now()
                WHERE school_id = ? AND school_year_id = ? AND campus_id IS NULL AND status = 'CONFIRMED'""",
                schoolId, schoolYearId);
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
