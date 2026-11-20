package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/** Tải lên tệp mẫu chưa điền (chỉ có dòng tiêu đề) bị từ chối, không lập lô rỗng — trước đây lô rỗng mở ra màn trắng. */
@SpringBootTest
@Transactional
class EmptyUploadTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    @Autowired
    JdbcTemplate jdbc;

    MockMvc mvc;
    String token;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
        User user = users.findByUsernameOrEmail("thcs.canbo").orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo thcs.canbo");
        token = "Bearer " + jwt.issueAccessToken(user, Instant.now());
    }

    @Test
    void blankTemplateIsRefusedWithoutCreatingABatch() throws Exception {
        MockHttpServletResponse template = mvc.perform(get("/api/school/data_imports/template")
                .header("Authorization", token)).andReturn().getResponse();
        assertThat(template.getStatus()).isEqualTo(200);
        Integer before = jdbc.queryForObject("SELECT count(*) FROM data_import_batches", Integer.class);

        MockHttpServletResponse refused = mvc.perform(multipart("/api/school/data_imports")
                .file(new MockMultipartFile("file", "Mẫu dữ liệu đầu vào.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", template.getContentAsByteArray()))
                .header("Authorization", token)).andReturn().getResponse();
        refused.setCharacterEncoding("UTF-8");

        assertThat(refused.getStatus()).as(refused.getContentAsString()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("chưa có dòng dữ liệu nào");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM data_import_batches", Integer.class)).isEqualTo(before);
    }
}
