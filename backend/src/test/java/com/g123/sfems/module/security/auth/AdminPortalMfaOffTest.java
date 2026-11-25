package com.g123.sfems.module.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

/**
 * Cổng Admin khi TẮT bắt buộc xác thực qua email ({@code app.portal.admin-mfa-required=false}, máy dev) và không giới hạn IP:
 * tài khoản quản trị chưa bật xác thực qua email vẫn dùng được cổng Admin. Cùng thuộc tính với {@code PortalGateTest} để dùng
 * chung một context.
 */
@SpringBootTest(properties = "app.portal.admin-mfa-required=false")
class AdminPortalMfaOffTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    @Autowired
    ObjectMapper json;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
    }

    @Test
    void adminWithoutSecondFactorIsAdmittedWhenNotRequired() throws Exception {
        User admin = users.findByUsernameOrEmail("admin").orElse(null);
        Assumptions.assumeTrue(admin != null, "Thiếu tài khoản admin");
        String token = jwt.issueAccessToken(admin, Instant.now());

        // Mọi IP đều được khi danh sách trống — kể cả máy lạ.
        MockHttpServletResponse users = mvc.perform(get("/api/admin/users")
                .header("Authorization", "Bearer " + token)
                .with(r -> {
                    r.setRemoteAddr("203.0.113.9");
                    return r;
                })).andReturn().getResponse();
        assertThat(users.getStatus()).isEqualTo(200);

        MockHttpServletResponse me = mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andReturn().getResponse();
        assertThat(json.readTree(me.getContentAsString(StandardCharsets.UTF_8)).path("mfaSetupRequired").asBoolean())
                .isFalse();
    }
}
