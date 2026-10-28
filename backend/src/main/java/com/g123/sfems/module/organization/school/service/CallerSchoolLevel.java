package com.g123.sfems.module.organization.school.service;

import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Cấp học của trường mà người gọi thuộc về — cho các danh mục chia theo cấp (thiết bị, bộ tiêu chuẩn):
 * tài khoản của một trường THCS không có việc gì với danh mục của tiểu học hay THPT.
 *
 * <p>Chỉ trả giá trị cho tài khoản của ĐÚNG một trường. Sở, UBND, quản trị làm việc với nhiều cấp nên
 * nhận {@code null} — "không thu hẹp". Trường chưa khai cấp học cũng {@code null}: thà không lọc còn
 * hơn lọc ra một danh mục rỗng mà không ai hiểu vì sao.
 *
 * <p>Đọc thẳng một cột bằng JDBC thay vì qua {@code SchoolService}: nơi dùng nó là các service danh mục
 * mà chính {@code SchoolService} phụ thuộc vào, và một bean nữa trong vòng đó là một vòng phụ thuộc.
 */
@Component
public class CallerSchoolLevel {

    private final VisibleSchools visibleSchools;
    private final JdbcTemplate jdbc;

    public CallerSchoolLevel(VisibleSchools visibleSchools, JdbcTemplate jdbc) {
        this.visibleSchools = visibleSchools;
        this.jdbc = jdbc;
    }

    public Long educationLevelId() {
        if (!"SCHOOL".equals(visibleSchools.level())) {
            return null;
        }
        Set<Long> visible = visibleSchools.current();
        if (visible == null || visible.size() != 1) {
            return null;
        }
        return jdbc.query("SELECT education_level_id FROM schools WHERE id = ?",
                rs -> rs.next() ? (Long) rs.getObject(1, Long.class) : null, visible.iterator().next());
    }
}
