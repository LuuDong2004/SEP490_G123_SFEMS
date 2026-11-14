package com.g123.sfems.shared.web.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Cổng API theo loại tài khoản (docs/kien-truc/11): bảng phân cổng phủ mọi controller, đúng loại thì qua, sai loại
 * bị 403 trước mọi kiểm quyền; phương thức không mở ở cổng thì không có đường.
 */
// Bắt buộc 2 lớp cho Admin tắt ở đây: admin demo chưa bật, test này chỉ kiểm chặn cổng theo loại (AdminPortalTest kiểm 2 lớp).
@SpringBootTest(properties = "app.portal.admin-mfa-required=false")
class PortalGateTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mapping;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
    }

    @Test
    void everyControllerIsClassified() {
        assertThat(mapping).isInstanceOf(PortalHandlerMapping.class);
        assertThat(((PortalHandlerMapping) mapping).unclassified())
                .as("Đường dẫn /api/<x> chưa khai trong PortalRoutes").isEmpty();
    }

    @Test
    void portalsAdmitOnlyTheirOwnUserType() throws Exception {
        String school = token("thcs.canbo");
        String so = token("so.chuyenvien");
        String admin = token("admin");

        assertThat(status(get("/api/school/rooms"), school)).isEqualTo(200);
        assertThat(status(get("/api/so/rooms"), school)).isEqualTo(403);
        assertThat(status(get("/api/so/rooms"), so)).isEqualTo(200);
        assertThat(status(get("/api/admin/users"), school)).isEqualTo(403);
        assertThat(status(get("/api/admin/users"), so)).isEqualTo(403);
        assertThat(status(get("/api/admin/users"), admin)).isEqualTo(200);
        assertThat(status(get("/api/school/rooms"), admin)).isEqualTo(403);
        // Quản trị dùng được toàn bộ chức năng — qua cổng của mình.
        assertThat(status(get("/api/admin/rooms"), admin)).isEqualTo(200);
        assertThat(status(get("/api/admin/equipment"), admin)).isEqualTo(200);
        assertThat(status(get("/api/admin/data_imports"), admin)).isIn(200, 404);
        // Ghi danh mục chỉ Sở: trường gõ thẳng đường của Sở vẫn bị chặn ở cổng.
        assertThat(status(post("/api/so/equipment_catalogs").contentType(MediaType.APPLICATION_JSON).content("{}"),
                school)).isEqualTo(403);
        // Phòng do trường ghi: cổng Sở không có đường ghi phòng.
        assertThat(status(post("/api/so/rooms").contentType(MediaType.APPLICATION_JSON).content("{}"), so))
                .isIn(404, 405);
        // Không token: 401.
        assertThat(mvc.perform(get("/api/school/rooms")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void legacyPathsAreForApiKeysOnly() throws Exception {
        // Người dùng đăng nhập (token có phiên `sid`) phải đi qua cổng; đường cũ không cổng chỉ còn cho khoá API.
        User user = users.findByUsernameOrEmail("thcs.canbo").orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo thcs.canbo");
        String signedIn = jwt.issueAccessToken(user, Instant.now(), "test-session");
        assertThat(status(get("/api/rooms"), signedIn)).isEqualTo(403);
        assertThat(status(get("/api/school/rooms"), signedIn)).isNotEqualTo(403);
        String apiKey = jwt.issueAccessToken(user, Instant.now());
        assertThat(status(get("/api/rooms"), apiKey)).isEqualTo(200);
    }

    private String token(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        return jwt.issueAccessToken(user, Instant.now());
    }

    private int status(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token)
            throws Exception {
        RequestBuilder withToken = request.header("Authorization", "Bearer " + token);
        return mvc.perform(withToken).andReturn().getResponse().getStatus();
    }
}
