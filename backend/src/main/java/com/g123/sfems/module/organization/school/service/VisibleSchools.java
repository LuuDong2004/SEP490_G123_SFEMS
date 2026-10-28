package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Các trường người đang đăng nhập được nhìn thấy trong một bảng TỔNG HỢP:
 * quản trị viên và Sở thấy mọi trường, UBND thấy các trường mình quản lý, tài
 * khoản trường thấy đúng trường của mình.
 *
 * <p>Báo cáo và bảng điều khiển là các truy vấn gộp (SQL thuần) chứ không đi qua
 * một repository có phạm vi dòng, nên cần một câu trả lời tường minh cho "gộp
 * trên những trường nào". Cùng quy tắc với phạm vi dòng seed sẵn cho các vai
 * trò — đổi một bên mà quên bên kia thì báo cáo nói khác màn danh sách.
 */
@Component
public class VisibleSchools {

    private final RowLevelPrincipalResolver principals;
    private final ManagedSchoolsCache managedSchools;
    private final JdbcTemplate jdbc;

    public VisibleSchools(RowLevelPrincipalResolver principals, ManagedSchoolsCache managedSchools,
            JdbcTemplate jdbc) {
        this.principals = principals;
        this.managedSchools = managedSchools;
        this.jdbc = jdbc;
    }

    /** Tập id trường; {@code null} nghĩa là mọi trường. */
    public Set<Long> current() {
        RowLevelPrincipal principal = principals.current().orElse(null);
        if (principal == null) {
            return Set.of();
        }
        if (principal.roleCodes().contains("ADMIN") || isCityBody(principal.managingBodyId())) {
            return null;
        }
        if (principal.managingBodyId() != null) {
            return managedSchools.schoolsOf(principal.managingBodyId());
        }
        return principal.schoolId() == null ? Set.of() : Set.of(principal.schoolId());
    }

    /** Cấp của người xem: {@code CITY}, {@code BODY}, {@code SCHOOL} hoặc {@code NONE}. */
    public String level() {
        RowLevelPrincipal principal = principals.current().orElse(null);
        if (principal == null) {
            return "NONE";
        }
        if (principal.roleCodes().contains("ADMIN") || isCityBody(principal.managingBodyId())) {
            return "CITY";
        }
        if (principal.managingBodyId() != null) {
            return "BODY";
        }
        return principal.schoolId() == null ? "NONE" : "SCHOOL";
    }

    /**
     * Mệnh đề SQL lọc theo tập trường, trên cột cho trước — rỗng khi thấy mọi
     * trường, {@code FALSE} khi không thấy trường nào. Chỉ ghép id số, không
     * ghép chuỗi người dùng gõ. Luôn có khoảng trắng hai đầu: nối với một text
     * block đã bị cắt thụt lề thì "TRUE" và "GROUP BY" không dính vào nhau.
     */
    public String sqlFilter(String column) {
        Set<Long> ids = current();
        if (ids == null) {
            return " ";
        }
        if (ids.isEmpty()) {
            return " AND FALSE ";
        }
        return " AND " + column + " IN (" + ids.stream().map(String::valueOf).collect(Collectors.joining(","))
                + ") ";
    }

    public boolean isCityBody(Long bodyId) {
        if (bodyId == null) {
            return false;
        }
        String type = jdbc.queryForObject("SELECT type FROM departments_of_education WHERE id = ?", String.class,
                bodyId);
        return "SO".equals(type);
    }
}
