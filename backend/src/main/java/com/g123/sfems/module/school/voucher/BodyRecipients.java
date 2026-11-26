package com.g123.sfems.module.school.voucher;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Người nhận thông báo ở cấp cơ quan quản lý (Sở / UBND): tài khoản đang hoạt động của MỘT cơ quan, mang một mã quyền
 * — "lãnh đạo Sở duyệt kế hoạch" là người có {@code procurement_plans:approve} của Sở lập kế hoạch, "chuyên viên lập kế
 * hoạch" là người có {@code procurement_plans:write}. Theo quyền chứ không theo tên vai trò, như {@link VoucherApprovers}.
 */
@Component
public class BodyRecipients {

    private final JdbcTemplate jdbc;

    public BodyRecipients(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Tài khoản của cơ quan {@code bodyId} đang mang quyền {@code permission}. Rỗng khi {@code bodyId} trống. */
    public List<Long> holding(String permission, Long bodyId) {
        if (bodyId == null) {
            return List.of();
        }
        return jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u
                JOIN user_sos us ON us.id = u.id
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE p.code = ? AND u.status = 'ACTIVE' AND us.managing_body_id = ?
                """, Long.class, permission, bodyId);
    }

    /** Cơ quan quản lý trực tiếp của trường; {@code null} khi trường chưa gán. */
    public Long bodyOfSchool(Long schoolId) {
        if (schoolId == null) {
            return null;
        }
        return jdbc.queryForList("SELECT department_of_education_id FROM schools WHERE id = ?", Long.class, schoolId)
                .stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }
}
