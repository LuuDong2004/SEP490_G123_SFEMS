package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/**
 * Tải lên tệp mẫu chưa điền (chỉ có dòng tiêu đề): lập lô có đủ các trang, trống dòng, để điền thẳng trên lưới. Lô chưa
 * có dòng nào thì không ghi được (lô danh mục rỗng có bật "ngừng mục" sẽ ngừng cả danh mục).
 */
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
    ObjectMapper json;

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
    void blankTemplateOpensAnEmptyGridAndCannotBeCommittedEmpty() throws Exception {
        MockHttpServletResponse template = mvc.perform(get("/api/school/data_imports/template")
                .header("Authorization", token)).andReturn().getResponse();
        assertThat(template.getStatus()).isEqualTo(200);

        MockHttpServletResponse uploaded = mvc.perform(multipart("/api/school/data_imports")
                .file(new MockMultipartFile("file", "Mẫu dữ liệu đầu vào.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", template.getContentAsByteArray()))
                .header("Authorization", token)).andReturn().getResponse();
        uploaded.setCharacterEncoding("UTF-8");
        assertThat(uploaded.getStatus()).as(uploaded.getContentAsString()).isEqualTo(200);
        JsonNode batch = json.readTree(uploaded.getContentAsString());
        long id = batch.path("id").asLong();
        assertThat(batch.path("sheets").size()).as("đủ các trang của mẫu").isGreaterThan(1);
        batch.path("sheets").forEach(sheet -> assertThat(sheet.path("total").asInt()).isZero());

        MockHttpServletResponse refused = mvc.perform(post("/api/school/data_imports/" + id + "/commit")
                .header("Authorization", token)).andReturn().getResponse();
        refused.setCharacterEncoding("UTF-8");
        assertThat(refused.getStatus()).as(refused.getContentAsString()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("chưa có dòng dữ liệu nào");

        String first = batch.path("sheets").get(0).path("sheet").asText();
        MockHttpServletResponse added = mvc.perform(post("/api/school/data_imports/" + id + "/rows")
                .contentType(MediaType.APPLICATION_JSON).content("{\"sheet\":\"" + first + "\",\"data\":{}}")
                .header("Authorization", token)).andReturn().getResponse();
        assertThat(added.getStatus()).isEqualTo(200);
        assertThat(json.readTree(added.getContentAsString()).path("sheets").get(0).path("total").asInt()).isEqualTo(1);
    }
}
