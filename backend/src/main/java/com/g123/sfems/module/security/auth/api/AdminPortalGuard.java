package com.g123.sfems.module.security.auth.api;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.module.security.auth.service.AuthorityCache;
import com.g123.sfems.module.security.auth.service.AuthorizationService;
import com.g123.sfems.shared.security.AdminAccessDeniedException;
import com.g123.sfems.shared.security.AdminPortalPolicy;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.portal.Portal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Khoá cổng Admin (docs/kien-truc/11, quyết định 4) — chạy trong chuỗi bảo mật, SAU bước xác thực token và chặn cổng
 * theo loại tài khoản, nên mọi yêu cầu tới đây đã biết là ai.
 *
 * <ul>
 *   <li><b>IP được phép</b> ({@code app.portal.admin-allowed-ips}): áp cho {@code /api/admin/**} và cho MỌI yêu cầu
 *       mang token SYSTEM — kể cả đường cũ {@code /api/**} còn chạy song song ({@code app.portal.legacy-api}), không
 *       thì đường cũ là lối vòng qua khoá.</li>
 *   <li><b>Bắt buộc lớp thứ hai</b> ({@code app.portal.admin-mfa-required}): tài khoản SYSTEM chưa bật chỉ được
 *       {@code /api/auth/**} (bật xác thực qua email, hồ sơ của mình, quyền, đổi mật khẩu, đăng xuất); còn lại 403 có câu rõ.</li>
 * </ul>
 *
 * <p>Không phải bean: tạo trong {@code SecurityConfig} để Spring Boot không đăng ký nó thêm một lần làm bộ lọc
 * servlet.
 */
public class AdminPortalGuard extends OncePerRequestFilter {

    private static final String ADMIN_PREFIX = "/api/" + Portal.ADMIN.prefix() + "/";
    private static final String AUTH_PREFIX = "/api/auth/";
    private static final String LOGOUT = "/api/auth/logout";

    private final AdminPortalPolicy policy;
    private final AuthorizationService authorization;

    public AdminPortalGuard(AdminPortalPolicy policy, AuthorizationService authorization) {
        this.policy = policy;
        this.authorization = authorization;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/") || LOGOUT.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean system = CurrentUser.userType().filter(type -> type == UserType.SYSTEM).isPresent();
        boolean adminPath = path.startsWith(ADMIN_PREFIX);

        if ((system || adminPath) && !policy.ipAllowed(request.getRemoteAddr())) {
            throw AdminAccessDeniedException.ip();
        }
        if (system && policy.mfaRequired() && !path.startsWith(AUTH_PREFIX) && !hasSecondFactor()) {
            throw AdminAccessDeniedException.mfa();
        }
        chain.doFilter(request, response);
    }

    /** Đọc từ bộ nhớ đệm quyền (không tốn câu SQL khi đã nạp); không có tài khoản thì coi như chưa có. */
    private boolean hasSecondFactor() {
        return CurrentUser.id().flatMap(authorization::entryOf).map(AuthorityCache.Entry::secondFactor).orElse(false);
    }
}
