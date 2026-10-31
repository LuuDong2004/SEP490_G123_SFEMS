package com.g123.sfems.module.security.auth.api;

import com.g123.sfems.shared.security.MfaRequiredException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Giới hạn lần thử SAI theo IP ở các cửa không cần đăng nhập: đăng nhập, đổi khoá API lấy token, quên / đặt lại
 * mật khẩu.
 *
 * <p>Khoá 15 phút sau 5 lần sai ({@code LoginGuard}) đếm theo TÀI KHOẢN, và tên tài khoản đoán được
 * ({@code <mã trường>.<mã cán bộ>}): một script không cần đăng nhập khoá được mọi cán bộ của thành phố, hoặc dò
 * mật khẩu yếu với 4 lần mỗi tài khoản mà không bị khoá. Đếm theo IP chặn cả hai. Chỉ đếm lần BỊ TỪ CHỐI (4xx):
 * cả trường đăng nhập buổi sáng sau cùng một IP NAT không chạm ngưỡng; bước "cần mã hai lớp" cũng là 401 nhưng
 * không phải lần sai, nên không đếm. "Quên mật khẩu" luôn trả 200 nên đếm mọi lần. Làm mới token cũng đếm: token cũ
 * bị trình lại là thứ máy chủ phải khoá dòng và đóng phiên để trả lời.
 *
 * <p>Bộ đếm nằm trong bộ nhớ từng node — đủ cho mục đích này: kẻ dò bị chặn ở node nó đang gọi, và nhiều node chỉ
 * nhân ngưỡng lên vài lần chứ không bỏ nó.
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimitFilter.class);

    static final int MAX_FAILURES = 30;
    static final Duration WINDOW = Duration.ofMinutes(10);

    private static final Set<String> PATHS = Set.of(
            "/api/auth/login", "/api/auth/refresh", "/api/auth/token", "/api/auth/forgot-password",
            "/api/auth/reset-password");
    private static final String FORGOT = "/api/auth/forgot-password";

    private record Window(Instant start, AtomicInteger failures) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        Instant now = Instant.now();
        Window window = windows.compute(ip, (k, w) ->
                w == null || w.start().plus(WINDOW).isBefore(now) ? new Window(now, new AtomicInteger()) : w);
        if (window.failures().get() >= MAX_FAILURES) {
            reject(response);
            return;
        }
        chain.doFilter(request, response);
        int status = response.getStatus();
        boolean prompted = request.getAttribute(MfaRequiredException.PROMPTED) != null;
        if (FORGOT.equals(request.getRequestURI()) || (status >= 400 && status < 500 && !prompted)) {
            if (window.failures().incrementAndGet() == MAX_FAILURES) {
                log.warn("IP {} bị tạm chặn ở {} sau {} lần thử bị từ chối trong {} phút", ip,
                        request.getRequestURI(), MAX_FAILURES, WINDOW.toMinutes());
            }
        }
    }

    private static void reject(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\","
                + "\"message\":\"Thử quá nhiều lần từ máy này — thử lại sau ít phút\"}");
    }

    /** Dọn cửa sổ đã hết hạn để bảng không lớn mãi. */
    @Scheduled(fixedDelay = 600_000)
    void purge() {
        Instant cutoff = Instant.now().minus(WINDOW);
        windows.values().removeIf(w -> w.start().isBefore(cutoff));
    }
}
