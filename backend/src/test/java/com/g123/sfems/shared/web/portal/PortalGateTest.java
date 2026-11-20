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
        // Quản trị viên đi được toàn bộ luồng (281): nhập dữ liệu đầu vào, lập phiếu nghiệp vụ qua cổng Admin.
        assertThat(status(get("/api/admin/data_imports"), admin)).isEqualTo(200);
        assertThat(status(get("/api/admin/purchase_proposals"), admin)).isEqualTo(200);
        assertThat(status(post("/api/admin/equipment_intakes").contentType(MediaType.APPLICATION_JSON).content("{}"),
                admin)).as("qua cổng, tới luật kiểm của phiếu").isIn(400, 422);
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
        // Đăng nhập thật để token mang phiên còn sống — phiên bịa ra giờ bị từ chối (401) như phiên đã đăng xuất.
        var login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"thcs.canbo\",\"password\":\"Demo@123\"}")).andReturn().getResponse();
        Assumptions.assumeTrue(login.getStatus() == 200, "Không đăng nhập được tài khoản demo thcs.canbo");
        String signedIn = com.jayway.jsonpath.JsonPath.read(login.getContentAsString(), "$.accessToken");
        assertThat(status(get("/api/school/rooms"), jwt.issueAccessToken(user, Instant.now(), "phien-khong-co-that")))
                .isEqualTo(401);
        assertThat(status(get("/api/rooms"), signedIn)).isEqualTo(403);
        assertThat(status(get("/api/school/rooms"), signedIn)).isNotEqualTo(403);
        String apiKey = jwt.issueAccessToken(user, Instant.now());
        assertThat(status(get("/api/rooms"), apiKey)).isEqualTo(200);
    }

    /**
     * Trường thêm thiết bị ngoài danh mục qua cổng của mình: danh mục chỉ Sở ghi, nhưng {@code school-items} mở cho
     * cổng trường ({@code PortalRoutes.EXTRA_WRITE}). Trước đó POST ở cổng trường là 405 — "Lưu và chọn" không chạy.
     * Kiểm tên (so theo từ) chạy thật câu truy vấn trên CSDL: "Bột Al" trùng "Al (Bột)".
     */
    @Test
    void schoolWritesOwnOutOfCatalogItemsThroughItsPortal() throws Exception {
        String school = token("thcs.canbo");
        // Thân rỗng: tới được controller (422 kiểm dữ liệu), không phải 404 / 405 của cổng.
        assertThat(status(post("/api/school/equipment_catalogs/school-items").contentType(MediaType.APPLICATION_JSON).content("{}"), school))
                .isIn(400, 422);
        // Phần còn lại của danh mục vẫn chỉ Sở ghi.
        assertThat(status(post("/api/school/equipment_catalogs").contentType(MediaType.APPLICATION_JSON).content("{}"), school))
                .isIn(404, 405);
        var res = mvc.perform(get("/api/school/equipment_catalogs/school-items/name-check").param("name", "Bột Al")
                .header("Authorization", "Bearer " + school)).andReturn().getResponse();
        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(res.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).contains("Al (Bột)");
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
