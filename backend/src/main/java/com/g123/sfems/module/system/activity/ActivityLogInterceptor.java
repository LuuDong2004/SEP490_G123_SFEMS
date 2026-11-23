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
 * <p>Xuất là: đường dẫn có {@code /export}, hoặc {@code GET} một tệp {@code .xlsx} (bảng định mức, tổng hợp
 * đề xuất mua sắm...) — kèm định dạng (theo {@code Content-Type} của response) và chuỗi truy vấn làm phạm vi /
 * bộ lọc. In PDF và xuất CSV chạy trên trình duyệt nên màn hình báo lên qua {@link ExportLogController}: nó đặt
 * một {@link ExportEvent} lên request và dòng nhật ký của chính request đó mang nội dung lần xuất.
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

    /** Thuộc tính request mang lần xuất do màn hình báo lên ({@link ExportEvent}). */
    static final String EXPORT = "activity.export";

    /**
     * Một lần xuất trên trình duyệt: tài nguyên, định dạng, số dòng, phạm vi / bộ lọc, màn hình đã xuất. Người xuất
     * KHÔNG nằm ở đây — lấy từ phiên của request như mọi dòng nhật ký khác.
     */
    record ExportEvent(String resource, String format, Integer rows, String detail, String path) {
    }

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
        ExportEvent reported = request.getAttribute(EXPORT) instanceof ExportEvent e ? e : null;
        boolean file = "GET".equals(method) && path.endsWith(".xlsx");
        boolean export = reported != null || file || path.contains("/export");
        if ((!WRITES.contains(method) && !export) || SKIPPED.contains(path)) {
            return;
        }
        try {
            String[] segments = path.replaceFirst("^/api/", "").split("/");
            String resource = segments.length > 0 && !segments[0].isBlank() ? segments[0] : null;
            Long recordId = segments.length > 1 ? parseLong(segments[1]) : null;
            String action = action(method, segments, recordId, export);
            String format = null;
            Integer rows = null;
            String detail = null;
            String logged = path;
            if (reported != null) {
                resource = reported.resource();
                recordId = null;
                format = reported.format();
                rows = reported.rows();
                detail = reported.detail();
                logged = reported.path() == null || reported.path().isBlank() ? path : reported.path();
            } else if (export) {
                format = formatOf(response.getContentType());
                detail = request.getQueryString();
            }
            // Đăng nhập / đăng xuất chưa có phiên: endpoint xác thực để lại người thao tác trên request.
            Long actorId = CurrentUser.id().orElse(request.getAttribute(ActivityActor.ID) instanceof Long id ? id : null);
            String actorName = actorId != null ? actors.of(actorId)
                    : request.getAttribute(ActivityActor.NAME) instanceof String name ? name : null;
            jdbc.update("INSERT INTO activity_logs (created_at, actor_id, actor_name, method, path, resource,"
                            + " record_id, action, status_code, ip, export_format, row_count, detail)"
                            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Timestamp.from(Instant.now()), actorId, actorName, method,
                    truncate(logged, 500), truncate(resource, 60), recordId, truncate(action, 40),
                    response.getStatus(), truncate(clientIp(request), 64), truncate(format, 10), rows,
                    truncate(detail, 1000));
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

    /** Định dạng tệp đã xuất, theo {@code Content-Type} của response. */
    private static String formatOf(String contentType) {
        if (contentType == null) {
            return null;
        }
        String type = contentType.toLowerCase(Locale.ROOT);
        if (type.contains("spreadsheetml")) {
            return "XLSX";
        }
        if (type.contains("zip")) {
            return "ZIP";
        }
        if (type.contains("csv")) {
            return "CSV";
        }
        if (type.contains("pdf")) {
            return "PDF";
        }
        return null;
    }

    /** IP thật sau proxy (server.forward-headers-strategy) — không đọc X-Forwarded-For client tự khai. */
    private static String clientIp(HttpServletRequest request) {
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
