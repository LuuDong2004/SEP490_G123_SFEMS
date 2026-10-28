package com.g123.sfems.module.system.activity;

import com.g123.sfems.shared.security.ActivityActor;
import com.g123.sfems.shared.security.ActorNames;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Ghi nhật ký hoạt động cho MỌI endpoint một lần, ở tầng web — thay vì nhớ gọi
 * ở từng service, và quên ở service thứ tám.
 *
 * <p>Ghi gì: mọi request làm đổi dữ liệu ({@code POST}, {@code PUT},
 * {@code PATCH}, {@code DELETE}) và mọi lần xuất dữ liệu — HSMT 3.9.6 đòi riêng
 * thao tác xuất, vì nó mang dữ liệu RA khỏi hệ thống. Không ghi đọc thường: một
 * dòng cho mỗi lần mở danh sách là nhật ký không ai đọc nổi.
 *
 * <p>Chạy ở {@code afterCompletion}, tức là sau khi response đã xong, nên biết
 * mã trạng thái thật (thao tác bị từ chối cũng được ghi — đó thường là dòng
 * đáng đọc nhất). Lỗi khi ghi nhật ký chỉ được log, không bao giờ ném ra: nhật
 * ký hỏng không được làm hỏng thao tác của người dùng.
 */
@Component
public class ActivityLogInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ActivityLogInterceptor.class);

    private static final Set<String> WRITES = Set.of("POST", "PUT", "PATCH", "DELETE");

    /** Làm mới phiên chạy mỗi 15 phút trên mọi tab: ồn, và không nói lên điều gì. */
    private static final Set<String> SKIPPED = Set.of("/api/auth/refresh");

    private final JdbcTemplate jdbc;
    private final ActorNames actors;

    public ActivityLogInterceptor(JdbcTemplate jdbc, ActorNames actors) {
        this.jdbc = jdbc;
        this.actors = actors;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
            Exception ex) {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        String path = request.getRequestURI();
        boolean export = path.contains("/export");
        if ((!WRITES.contains(method) && !export) || SKIPPED.contains(path)) {
            return;
        }
        try {
            String[] segments = path.replaceFirst("^/api/", "").split("/");
            String resource = segments.length > 0 && !segments[0].isBlank() ? segments[0] : null;
            Long recordId = segments.length > 1 ? parseLong(segments[1]) : null;
            String action = action(method, segments, recordId, export);
            // Đăng nhập / đăng xuất chưa có phiên: endpoint xác thực để lại người thao tác trên request.
            Long actorId = CurrentUser.id().orElse(request.getAttribute(ActivityActor.ID) instanceof Long id ? id : null);
            String actorName = actorId != null ? actors.of(actorId)
                    : request.getAttribute(ActivityActor.NAME) instanceof String name ? name : null;
            jdbc.update("INSERT INTO activity_logs (created_at, actor_id, actor_name, method, path, resource,"
                            + " record_id, action, status_code, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Timestamp.from(Instant.now()), actorId, actorName, method,
                    truncate(path, 500), truncate(resource, 60), recordId, truncate(action, 40),
                    response.getStatus(), truncate(clientIp(request), 64));
        } catch (RuntimeException e) {
            log.warn("Không ghi được nhật ký hoạt động cho {} {}", method, path, e);
        }
    }

    /** Tên thao tác đọc được thành chữ: create, update, delete, hoặc tên hành động (approve, submit...). */
    private static String action(String method, String[] segments, Long recordId, boolean export) {
        if (export) {
            return "export";
        }
        if (segments.length >= 2 && "auth".equals(segments[0])) {
            return segments[1];
        }
        if (recordId != null && segments.length > 2) {
            return segments[2];
        }
        if (recordId == null && segments.length > 1) {
            return segments[1];
        }
        return switch (method) {
            case "POST" -> "create";
            case "DELETE" -> "delete";
            default -> "update";
        };
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static Long parseLong(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
