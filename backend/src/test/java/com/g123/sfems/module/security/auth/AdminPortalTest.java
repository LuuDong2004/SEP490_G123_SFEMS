package com.g123.sfems.module.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.AdminAccessDeniedException;
import com.g123.sfems.shared.security.AuthoritiesChanged;
import com.g123.sfems.shared.security.JwtService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Cổng Admin cách ly (docs/kien-truc/11, quyết định 4) khi BẬT bắt buộc xác thực qua email và có danh sách IP: khu đăng nhập
 * riêng, 403 cho tài khoản quản trị chưa bật xác thực qua email, IP được phép, phiên ngắn.
 */
@SpringBootTest(properties = {
        "app.portal.admin-mfa-required=true",
        "app.portal.admin-allowed-ips=127.0.0.1, 10.1.0.0/16",
        "app.portal.admin-session-ttl=8h",
        "app.portal.admin-access-token-ttl=5m"})
class AdminPortalTest {

    static final String INVALID = "Sai tên đăng nhập hoặc mật khẩu";
    static final String ALLOWED_IP = "10.1.2.3";
    static final String BLOCKED_IP = "192.168.5.5";

    @Autowired
    WebApplicationContext context;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    ObjectMapper json;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
    }

    // ------------------------------------------------------------------ khu đăng nhập

    @Test
    void systemAccountSignsInAtBusinessLoginButStillIpGated() throws Exception {
        // Một màn /login cho mọi loại: quản trị không phải nhớ /admin/login.
        String password = passwordOf("admin");
        MockHttpServletResponse business = login("admin", password, null, "127.0.0.1");
        assertThat(business.getStatus()).isNotEqualTo(401);
        assertThat(message(business)).isNotEqualTo(INVALID);

        // Danh sách IP của khu quản trị vẫn áp — kể cả khi vào từ màn chung.
        MockHttpServletResponse blocked = login("admin", password, "business", BLOCKED_IP);
        assertThat(blocked.getStatus()).isEqualTo(403);
        // Sai mật khẩu từ IP bị chặn: vẫn câu chung, không lộ đây là tài khoản quản trị.
        assertThat(message(login("admin", "sai-mat-khau", null, BLOCKED_IP))).isEqualTo(INVALID);
    }

    @Test
    void schoolAccountIsRejectedAtAdminLogin() throws Exception {
        String password = passwordOf("thcs.canbo");
        MockHttpServletResponse admin = login("thcs.canbo", password, "admin", "127.0.0.1");
        assertThat(admin.getStatus()).isEqualTo(401);
        // Cùng câu với sai mật khẩu: không lộ tài khoản có tồn tại ở khu kia.
        assertThat(message(admin)).isEqualTo(INVALID);
        assertThat(message(login("thcs.canbo", "sai-mat-khau", "admin", "127.0.0.1"))).isEqualTo(INVALID);

        // Ở khu nghiệp vụ vẫn vào bình thường, và danh sách IP của khu quản trị không chạm tới.
        MockHttpServletResponse business = login("thcs.canbo", password, null, BLOCKED_IP);
        assertThat(business.getStatus()).isEqualTo(200);
        assertThat(read(business).path("expiresIn").asLong()).isEqualTo(Duration.ofMinutes(15).toSeconds());
    }

    @Test
    void invalidAreaIsAValidationError() throws Exception {
        assertThat(login("admin", "x", "khac", "127.0.0.1").getStatus()).isEqualTo(422);
    }

    @Test
    void adminSignsInAtAdminAreaWithShortSession() throws Exception {
        MockHttpServletResponse response = login("admin", passwordOf("admin"), "admin", ALLOWED_IP);
        Assumptions.assumeTrue(response.getStatus() == 200, "admin bật xác thực qua email ở CSDL này — bỏ qua");
        JsonNode body = read(response);
        assertThat(body.path("expiresIn").asLong()).isEqualTo(Duration.ofMinutes(5).toSeconds());
        assertThat(body.path("user").path("userType").asString()).isEqualTo("SYSTEM");
        assertThat(body.path("user").path("mfaSetupRequired").asBoolean()).isTrue();

        // Refresh token của phiên quản trị hết hạn không quá 8 giờ (hạn chung là 7 ngày).
        String refresh = body.path("refreshToken").asString();
        assertThat(expiresAt(refresh)).isBefore(Instant.now().plus(Duration.ofHours(8)).plusSeconds(60));

        // Làm mới vẫn chạy từ máy được phép; máy ngoài danh sách bị chặn và token không bị đốt.
        MockHttpServletResponse blocked = refresh(refresh, BLOCKED_IP);
        assertThat(blocked.getStatus()).isEqualTo(403);
        assertThat(read(blocked).path("adminBlock").asString()).isEqualTo("ip");
        MockHttpServletResponse renewed = refresh(refresh, ALLOWED_IP);
        assertThat(renewed.getStatus()).isEqualTo(200);
        assertThat(read(renewed).path("expiresIn").asLong()).isEqualTo(Duration.ofMinutes(5).toSeconds());
        // Làm mới không kéo phiên quá mốc 8 giờ tính từ lúc đăng nhập.
        assertThat(expiresAt(read(renewed).path("refreshToken").asString()))
                .isBefore(Instant.now().plus(Duration.ofHours(8)).plusSeconds(60));
    }

    private Instant expiresAt(String refreshToken) throws Exception {
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(refreshToken.getBytes(StandardCharsets.UTF_8)));
        return jdbc.queryForObject("select expires_at from refresh_tokens where token_hash = ?", Timestamp.class, hash)
                .toInstant();
    }

    @Test
    void adminLoginFromDisallowedIpIsBlocked() throws Exception {
        MockHttpServletResponse response = login("admin", passwordOf("admin"), "admin", BLOCKED_IP);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(message(response)).isEqualTo(AdminAccessDeniedException.IP_MESSAGE);
        assertThat(read(response).path("adminBlock").asString()).isEqualTo("ip");
    }

    // ------------------------------------------------------------------ bắt buộc xác thực qua email

    @Test
    void adminWithoutSecondFactorReachesOnlyAuthEndpoints() throws Exception {
        User admin = user("admin");
        Assumptions.assumeFalse(admin.isMfaEmail(), "admin đã bật xác thực qua email ở CSDL này");
        String token = jwt.issueAccessToken(admin, Instant.now());

        MockHttpServletResponse users = call(get("/api/admin/users"), token, "127.0.0.1");
        assertThat(users.getStatus()).isEqualTo(403);
        assertThat(message(users)).isEqualTo(AdminAccessDeniedException.MFA_MESSAGE);
        assertThat(read(users).path("adminBlock").asString()).isEqualTo("mfa");
        // Đường cũ không cổng cũng không phải lối vòng.
        assertThat(call(get("/api/users"), token, "127.0.0.1").getStatus()).isEqualTo(403);

        assertThat(call(get("/api/auth/mfa"), token, "127.0.0.1").getStatus()).isEqualTo(200);
        assertThat(call(get("/api/auth/permissions"), token, "127.0.0.1").getStatus()).isEqualTo(200);
        MockHttpServletResponse me = call(get("/api/auth/me"), token, "127.0.0.1");
        assertThat(me.getStatus()).isEqualTo(200);
        assertThat(read(me).path("mfaSetupRequired").asBoolean()).isTrue();
    }

    @Test
    void adminWithSecondFactorIsAdmitted() throws Exception {
        User admin = user("admin");
        Assumptions.assumeFalse(admin.isMfaEmail(), "admin đã bật xác thực qua email ở CSDL này");
        String token = jwt.issueAccessToken(admin, Instant.now());
        setMfaEmail(admin.getId(), true);
        try {
            assertThat(call(get("/api/admin/users"), token, "127.0.0.1").getStatus()).isEqualTo(200);
            assertThat(call(get("/api/admin/users"), token, ALLOWED_IP).getStatus()).isEqualTo(200);
            MockHttpServletResponse me = call(get("/api/auth/me"), token, "127.0.0.1");
            assertThat(read(me).path("mfaSetupRequired").asBoolean()).isFalse();
        } finally {
            setMfaEmail(admin.getId(), false);
        }
        // Tắt lại thì bị chặn ngay ở yêu cầu kế tiếp (bộ nhớ đệm quyền đã bị xoá).
        assertThat(call(get("/api/admin/users"), token, "127.0.0.1").getStatus()).isEqualTo(403);
    }

    // ------------------------------------------------------------------ IP được phép

    @Test
    void ipAllowlistGuardsAdminPortalAndSystemTokens() throws Exception {
        String admin = jwt.issueAccessToken(user("admin"), Instant.now());
        String school = jwt.issueAccessToken(user("thcs.canbo"), Instant.now());

        MockHttpServletResponse blocked = call(get("/api/admin/users"), admin, BLOCKED_IP);
        assertThat(blocked.getStatus()).isEqualTo(403);
        assertThat(read(blocked).path("adminBlock").asString()).isEqualTo("ip");
        // Token SYSTEM bị chặn ở mọi đường từ máy ngoài danh sách — kể cả /api/auth/**.
        assertThat(call(get("/api/auth/me"), admin, BLOCKED_IP).getStatus()).isEqualTo(403);
        // Trong dải CIDR: qua bước IP (tới bước xác thực qua email).
        assertThat(call(get("/api/auth/me"), admin, ALLOWED_IP).getStatus()).isEqualTo(200);
        // Tài khoản nghiệp vụ không bị danh sách IP của Admin chạm tới.
        assertThat(call(get("/api/school/rooms"), school, BLOCKED_IP).getStatus()).isEqualTo(200);
        // Sai loại vào cổng Admin vẫn là 403 của bước chặn cổng.
        assertThat(call(get("/api/admin/users"), school, "127.0.0.1").getStatus()).isEqualTo(403);
    }

    // ------------------------------------------------------------------ helpers

    private void setMfaEmail(Long id, boolean on) {
        jdbc.update("update users set mfa_email = ? where id = ?", on, id);
        events.publishEvent(new AuthoritiesChanged.ForUser(id));
    }

    private User user(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        return user;
    }

    /** Mật khẩu demo của tài khoản (seed dùng {@code Demo@123} hoặc {@code Admin@123}). */
    private String passwordOf(String username) {
        String hash = user(username).getPasswordHash();
        String found = List.of("Demo@123", "Admin@123").stream()
                .filter(candidate -> encoder.matches(candidate, hash)).findFirst().orElse(null);
        Assumptions.assumeTrue(found != null, "Không biết mật khẩu demo của " + username);
        return found;
    }

    private MockHttpServletResponse login(String username, String password, String area, String ip) throws Exception {
        Map<String, Object> body = area == null
                ? Map.of("username", username, "password", password)
                : Map.of("username", username, "password", password, "area", area);
        return mvc.perform(withIp(post("/api/auth/login"), ip).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andReturn().getResponse();
    }

    private MockHttpServletResponse refresh(String refreshToken, String ip) throws Exception {
        return mvc.perform(withIp(post("/api/auth/refresh"), ip).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("refreshToken", refreshToken)))).andReturn().getResponse();
    }

    private MockHttpServletResponse call(MockHttpServletRequestBuilder request, String token, String ip)
            throws Exception {
        return mvc.perform(withIp(request, ip).header("Authorization", "Bearer " + token)).andReturn().getResponse();
    }

    private static MockHttpServletRequestBuilder withIp(MockHttpServletRequestBuilder request, String ip) {
        return request.with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private JsonNode read(MockHttpServletResponse response) throws Exception {
        return json.readTree(response.getContentAsString(StandardCharsets.UTF_8));
    }

    private String message(MockHttpServletResponse response) throws Exception {
        return read(response).path("message").asString();
    }
}
