package com.g123.sfems.module.organization.school.api;

import com.g123.sfems.shared.web.ListParams;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ô "Trường" của MÀN ĐĂNG NHẬP — mở, không cần phiên (trước khi đăng nhập thì chưa có).
 *
 * <p>Tên tài khoản của người trong trường là {@code <mã trường>.<mã cán bộ>} ({@code StaffAccountService}),
 * mà mã trường dài và không ai nhớ ({@code thcsbinhanq2}). Màn đăng nhập cho chọn trường theo TÊN rồi tự ghép
 * tiền tố, người dùng chỉ gõ phần sau. Endpoint chỉ trả thứ vốn công khai — tên trường và tiền tố tài khoản
 * của nó — 30 dòng một lần tải, không lộ gì thêm về trường.
 */
@RestController
public class SchoolSignInLookupController {

    /**
     * Một trường để chọn lúc đăng nhập: tên, phường / xã ({@code area} — hai trường trùng tên, như hai
     * "THCS Bình An", phải phân biệt được) và tiền tố tên tài khoản.
     */
    public record Option(Long id, String name, String area, String prefix) {
    }

    /** Một lần tải: cuộn tới cuối danh sách thì tải tiếp. */
    private static final int PAGE = 30;

    private final JdbcTemplate jdbc;

    public SchoolSignInLookupController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/auth/schools")
    public List<Option> schools(@RequestParam(required = false) String q,
            @RequestParam(name = "_start", defaultValue = "0") int start) {
        String term = q == null ? "" : ListParams.fold(q.trim());
        return jdbc.query("""
                SELECT s.id, s.name, s.code, COALESCE(w.name, NULLIF(s.ward_text, ''), s.district) AS area
                FROM schools s LEFT JOIN wards w ON w.id = s.ward_id
                WHERE s.status = 'ACTIVE'
                  AND translate(lower(s.name), ?, ?) LIKE ?
                ORDER BY s.name, s.id LIMIT ? OFFSET ?""",
                (rs, n) -> new Option(rs.getLong("id"), rs.getString("name"), rs.getString("area"),
                        slug(rs.getString("code"))),
                ListParams.VN_ACCENTED, ListParams.VN_PLAIN, "%" + term + "%", PAGE, Math.max(0, start));
    }

    /** Cùng phép với tiền tố tài khoản do {@code StaffAccountService} cấp. */
    private static String slug(String raw) {
        String plain = Normalizer.normalize(raw == null ? "" : raw, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        return plain.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
    }
}
