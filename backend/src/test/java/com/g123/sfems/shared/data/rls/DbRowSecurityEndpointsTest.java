package com.g123.sfems.shared.data.rls;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import com.g123.sfems.shared.web.portal.Portal;
import com.g123.sfems.shared.web.portal.PortalRoutes;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * RLS của PostgreSQL không làm vỡ màn nào: mọi tài nguyên đọc được ở cổng trường / UBND trả không lỗi 5xx khi kết
 * nối đã hạ vai và lọc theo trường; phiếu điều chuyển đã hoàn tất (tài sản đã sang trường kia) vẫn mở được.
 */
@SpringBootTest
class DbRowSecurityEndpointsTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    @Autowired
    JdbcTemplate jdbc;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
    }

    @Test
    void schoolAndSoListsStillLoad() throws Exception {
        List<String> broken = new ArrayList<>();
        for (String username : List.of("thcs.canbo", "thcs.hieutruong")) {
            broken.addAll(sweep(username, Portal.SCHOOL, "school"));
        }
        broken.addAll(sweep("so.chuyenvien", Portal.SO, "so"));
        assertThat(broken).isEmpty();
    }

    /** Trường NHẬN mở được phiếu chuyển đến và tài sản đã nhận về sổ của mình — qua chính sách RLS của CSDL. */
    private List<String> sweep(String username, Portal portal, String prefix) throws Exception {
        String token = token(username);
        List<String> broken = new ArrayList<>();
        int ok = 0;
        for (Map.Entry<String, PortalRoutes.Rule> route : PortalRoutes.all().entrySet()) {
            if (!route.getValue().read().contains(portal)) {
                continue;
            }
            String path = "/api/" + prefix + "/" + route.getKey();
            int status = mvc.perform(get(path).header("Authorization", "Bearer " + token)).andReturn().getResponse()
                    .getStatus();
            if (status >= 500) {
                broken.add(username + " " + path + " → " + status);
            } else if (status == 200) {
                ok++;
            }
        }
        // Quét thật chứ không phải toàn 403 / 404.
        assertThat(ok).as("số danh sách mở được của %s", username).isGreaterThan(10);
        return broken;
    }

    private String token(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        return jwt.issueAccessToken(user, Instant.now());
    }
}
