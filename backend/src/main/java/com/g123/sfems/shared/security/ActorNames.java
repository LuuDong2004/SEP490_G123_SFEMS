package com.g123.sfems.shared.security;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tên hiển thị của người đang thao tác, để GHI kèm vào các vết (nhật ký duyệt,
 * lịch sử thiết bị, nhật ký hoạt động).
 *
 * <p>Ghi tên chứ không chỉ ghi id: vết phải đọc được cả khi tài khoản đã bị xoá
 * — khoá ngoại {@code actor_id} là {@code ON DELETE SET NULL}, và một vết chỉ
 * còn "người dùng không xác định" là vết không trả lời được câu "ai".
 */
@Component
public class ActorNames {

    private final JdbcTemplate jdbc;

    public ActorNames(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String current() {
        return CurrentUser.id().map(this::of).orElse(null);
    }

    public String of(Long userId) {
        if (userId == null) {
            return null;
        }
        List<String> names = jdbc.queryForList(
                "SELECT COALESCE(NULLIF(full_name, ''), username) FROM users WHERE id = ?", String.class, userId);
        return names.isEmpty() ? null : names.get(0);
    }
}
