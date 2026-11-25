package com.g123.sfems.shared.web;

import com.g123.sfems.shared.security.CurrentUser;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Chặn thao tác dồn dập ở mọi {@code /api/**}, theo từng người dùng (chưa đăng nhập thì theo IP), hai lớp:
 *
 * <ul>
 *   <li><b>Nhịp chung</b> — tối đa {@code perSecond} request mỗi giây (mặc định 20); vừa mở màn được dồn tới
 *       {@code burst} (mặc định 40) vì một màn bắn cả cụm request cùng lúc. Dùng bình thường đỉnh khoảng 11 request
 *       / giây; vượt thì 429 kèm {@code Retry-After}, giao diện tự đợi rồi gửi lại.</li>
 *   <li><b>Truy vấn nặng</b> ({@link HeavyQuery}, xuất tệp) — mỗi người chạy tối đa {@code heavyPerUser} cái cùng
 *       lúc. Phần dư XẾP HÀNG chờ tới {@code heavyWait} giây chứ không bị từ chối ngay: chuyển tab báo cáo liên tục
 *       chỉ chậm lại của chính người đó, không chiếm hết kết nối CSDL của người khác. Chờ quá hạn mới trả 429.</li>
 * </ul>
 *
 * <p>Mọi giới hạn tính riêng từng người — không có trần chung toàn hệ thống: người này bấm nhiều không làm người
 * khác bị chặn. Bộ đếm nằm trong bộ nhớ từng node, đủ cho mục đích chống nghẽn (giống {@code LoginRateLimitFilter}).
 */
@Component
public class RequestThrottle implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RequestThrottle.class);
    private static final String HELD = RequestThrottle.class.getName() + ".held";

    private final boolean enabled;
    private final double burst;
    private final double perSecond;
    private final int heavyPerUser;
    private final long heavyWaitMs;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Map<String, Semaphore> heavy = new ConcurrentHashMap<>();

    public RequestThrottle(
            @Value("${app.throttle.enabled:true}") boolean enabled,
            @Value("${app.throttle.burst:40}") int burst,
            @Value("${app.throttle.per-second:20}") int perSecond,
            @Value("${app.throttle.heavy-per-user:3}") int heavyPerUser,
            @Value("${app.throttle.heavy-wait-seconds:20}") int heavyWaitSeconds) {
        this.enabled = enabled;
        this.burst = burst;
        this.perSecond = perSecond;
        this.heavyPerUser = heavyPerUser;
        this.heavyWaitMs = heavyWaitSeconds * 1000L;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        // Lượt trả kết quả của request bất đồng bộ (xuất tệp dạng luồng) đã qua cửa ở lượt đầu.
        if (!enabled || request.getDispatcherType() == DispatcherType.ASYNC
                || "OPTIONS".equals(request.getMethod())) {
            return true;
        }
        String key = CurrentUser.id().map(id -> "u" + id).orElseGet(() -> "ip" + request.getRemoteAddr());
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(burst));
        double wait = bucket.take(burst, perSecond);
        if (wait > 0) {
            return reject(response, Math.max(1, (int) Math.ceil(wait)), key, "nhịp chung");
        }
        if (!isHeavy(request, handler)) {
            return true;
        }
        Semaphore mine = heavy.computeIfAbsent(key, k -> new Semaphore(heavyPerUser, true));
        try {
            if (!mine.tryAcquire(heavyWaitMs, TimeUnit.MILLISECONDS)) {
                return reject(response, 2, key, "truy vấn nặng");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return reject(response, 1, key, "bị ngắt khi chờ");
        }
        request.setAttribute(HELD, mine);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
            Exception ex) {
        if (request.getAttribute(HELD) instanceof Semaphore mine) {
            request.removeAttribute(HELD);
            mine.release();
        }
    }

    private static boolean isHeavy(HttpServletRequest request, Object handler) {
        String path = request.getRequestURI();
        if ("GET".equals(request.getMethod()) && (path.contains("/export") || path.endsWith(".xlsx"))) {
            return true;
        }
        return handler instanceof HandlerMethod method
                && (method.hasMethodAnnotation(HeavyQuery.class)
                        || method.getBeanType().isAnnotationPresent(HeavyQuery.class));
    }

    private static boolean reject(HttpServletResponse response, int retryAfter, String key, String reason)
            throws IOException {
        log.info("Tạm chặn {} ({}), hẹn {} giây", key, reason, retryAfter);
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\","
                + "\"message\":\"Thao tác quá nhanh, vui lòng chậm lại giây lát\"}");
        return false;
    }

    /** Dọn xô đã đầy lại và hàng chờ không ai giữ, để bảng không lớn mãi. */
    @Scheduled(fixedDelay = 600_000)
    void purge() {
        buckets.values().removeIf(b -> b.full(burst, perSecond));
        heavy.values().removeIf(s -> s.availablePermits() == heavyPerUser && !s.hasQueuedThreads());
    }

    /** Xô token: {@code take} trả 0 khi lấy được, hoặc số giây phải đợi tới token kế. */
    private static final class Bucket {
        private double tokens;
        private long last = System.nanoTime();

        Bucket(double burst) {
            this.tokens = burst;
        }

        synchronized double take(double burst, double perSecond) {
            refill(burst, perSecond);
            if (tokens >= 1) {
                tokens -= 1;
                return 0;
            }
            return (1 - tokens) / perSecond;
        }

        synchronized boolean full(double burst, double perSecond) {
            refill(burst, perSecond);
            return tokens >= burst;
        }

        private void refill(double burst, double perSecond) {
            long now = System.nanoTime();
            tokens = Math.min(burst, tokens + (now - last) / 1e9 * perSecond);
            last = now;
        }
    }
}
