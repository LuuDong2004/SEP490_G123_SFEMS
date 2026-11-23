package com.g123.sfems.module.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.auth.service.AuthorityCache;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Nạp lại quyền của chính người đang đăng nhập (bộ nhớ đệm hết hạn giữa yêu cầu, ngoài giao dịch) không được tự khoá:
 * nạp quyền mở kết nối → RLS dò phạm vi → cần quyền của người đó → chờ lần nạp đang dở. Trước bản sửa
 * ({@code RowSecurityDataSource.unscoped}) luồng treo mãi và mọi yêu cầu sau của người đó cũng treo.
 */
@SpringBootTest
class AuthorityCacheRlsTest {

    @Autowired
    AuthorityCache cache;

    @Autowired
    UserRepository users;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @Test
    void reloadingOwnAuthoritiesWhileSignedInDoesNotDeadlock() {
        for (String username : new String[] {"thcs.canbo", "ubnd.chuyenvien", "so.chuyenvien"}) {
            User user = users.findByUsernameOrEmail(username).orElse(null);
            Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
            String token = jwt.issueAccessToken(user, Instant.now(), "test-session");
            assertTimeoutPreemptively(Duration.ofSeconds(10), () -> {
                SecurityContextHolder.getContext()
                        .setAuthentication(new JwtAuthenticationToken(decoder.decode(token)));
                try {
                    cache.evict(user.getId());
                    assertThat(cache.get(user.getId())).as(username).isPresent();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            }, username);
        }
    }
}
