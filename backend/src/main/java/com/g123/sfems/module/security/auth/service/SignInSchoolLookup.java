package com.g123.sfems.module.security.auth.service;

import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ô "Trường" của màn đăng nhập (HT-01): chọn trường theo tên, màn tự ghép tiền tố tài khoản,
 * người dùng chỉ gõ phần sau dấu chấm.
 *
 * <p>Tiền tố không suy ra được từ mã trường ({@code THPT_LE_QUY_DON} nhưng tài khoản là
 * {@code lqd.thietbi}), nên lấy từ chính tài khoản của trường: phần trước dấu chấm hay gặp nhất.
 * Trường chưa có tài khoản dạng {@code <tiền tố>.<tên>} thì không hiện, vì chọn vào cũng không
 * đăng nhập được. Chỉ trả tên trường, khu vực và tiền tố — thứ vốn công khai, không lộ tài khoản nào.
 */
@Service
public class SignInSchoolLookup {

    /** Một trường để chọn lúc đăng nhập. {@code area} phân biệt hai trường trùng tên. */
    public record Option(Long id, String name, String area, String prefix) {
    }

    /** Số dòng một lần tải; màn đăng nhập cuộn tới cuối thì tải tiếp. */
    public static final int PAGE = 30;

    private final JdbcTemplate jdbc;

    public SignInSchoolLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<Option> find(String q, int start) {
        String term = q == null ? "" : ListParams.fold(q.trim())
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return jdbc.query("""
                SELECT * FROM (
                    SELECT s.id, s.name, COALESCE(w.name, NULLIF(s.ward_text, ''), s.district) AS area,
                           (SELECT split_part(u.username, '.', 1)
                              FROM users u
                             WHERE u.school_id = s.id AND u.status = 'ACTIVE' AND position('.' IN u.username) > 1
                             GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1) AS prefix
                    FROM schools s LEFT JOIN wards w ON w.id = s.ward_id
                    WHERE s.status = 'ACTIVE'
                      AND translate(lower(s.name), ?, ?) LIKE ?
                ) t
                WHERE t.prefix IS NOT NULL
                ORDER BY t.name, t.id LIMIT ? OFFSET ?""",
                (rs, n) -> new Option(rs.getLong("id"), rs.getString("name"), rs.getString("area"),
                        rs.getString("prefix")),
                ListParams.VN_ACCENTED, ListParams.VN_PLAIN, "%" + term + "%", PAGE, Math.max(0, start));
    }
}
