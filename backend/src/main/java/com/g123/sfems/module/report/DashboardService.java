package com.g123.sfems.module.report;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearRepository;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.security.rowlevel.Action;
import java.util.Comparator;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private final SchoolYearRepository schoolYears;
    private final RowLevelSecurity rowLevel;
    private final RowLevelPrincipalResolver principals;
    private final VisibleSchools visibleSchools;
    private final JdbcTemplate jdbc;

    public DashboardService(
            SchoolYearRepository schoolYears,
            RowLevelSecurity rowLevel,
            RowLevelPrincipalResolver principals,
            VisibleSchools visibleSchools,
            JdbcTemplate jdbc) {
        this.schoolYears = schoolYears;
        this.rowLevel = rowLevel;
        this.principals = principals;
        this.visibleSchools = visibleSchools;
        this.jdbc = jdbc;
    }

    public DashboardResponse get(Long requestedSchoolYearId) {
        List<SchoolYear> activeYears = schoolYears.findAll(rowLevel.scope(SchoolYear.class, Action.READ)).stream()
                .filter(year -> Boolean.TRUE.equals(year.getActive()))
                .sorted(Comparator.comparing(SchoolYear::getSortOrder,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(SchoolYear::getName))
                .toList();
        Long currentYearId = activeYears.stream()
                .filter(year -> Boolean.TRUE.equals(year.getCurrent()))
                .map(SchoolYear::getId)
                .findFirst()
                .orElse(null);
        Long selectedYearId = requestedSchoolYearId == null ? currentYearId : requestedSchoolYearId;
        if (selectedYearId != null && activeYears.stream().noneMatch(year -> selectedYearId.equals(year.getId()))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Năm học không hợp lệ");
        }

        RowLevelPrincipal principal = principals.current().orElse(null);
        String scope = principal == null ? "NONE"
                : principal.schoolId() != null ? "SCHOOL"
                : principal.managingBodyId() != null && !visibleSchools.isCityBody(principal.managingBodyId())
                        ? "BODY"
                        : "CITY";
        String schoolName = principal == null || principal.schoolId() == null ? null
                : jdbc.query("SELECT name FROM schools WHERE id = ?", (rs, row) -> rs.getString("name"),
                        principal.schoolId()).stream().findFirst().orElse(null);

        // Các bảng thiết bị, mua sắm, định mức và kiểm kê chưa tồn tại ở bản đồ án.
        // Trả null để UI hiện trạng thái chưa có dữ liệu, không biến thiếu module thành số 0.
        return new DashboardResponse(
                scope,
                schoolName,
                activeYears.stream().map(year -> new DashboardResponse.SchoolYear(year.getId(), year.getName())).toList(),
                selectedYearId,
                null,
                null);
    }
}
