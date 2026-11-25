package com.g123.sfems.module.school.equipment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/**
 * Khai tay / nhập từ tệp (số dư đầu kỳ) khớp với các luồng có duyệt: chốt số dư thì thiết bị mới phải qua phiếu ghi
 * tăng; đang kiểm kê thì không thêm vào chỗ đang kiểm; mã cũ giữ làm mã hiện hành cho tới khi cấp mã chuẩn (TS-05);
 * hồ sơ có dòng lịch sử vào sổ (TS-04); hồ sơ khai nhầm chưa qua phiếu nào thì xoá được.
 */
@SpringBootTest
@Transactional
class OpeningBalanceTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ObjectMapper json;

    MockMvc mvc;
    Map<String, Object> sample;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
        Long school = jdbc.query("SELECT us.school_id FROM user_schools us JOIN users u ON u.id = us.id"
                + " WHERE u.username = 'thcs2.canbo'", rs -> rs.next() ? rs.getLong(1) : null);
        Assumptions.assumeTrue(school != null, "Thiếu tài khoản demo thcs2.canbo");
        sample = jdbc.queryForMap("SELECT catalog_id, unit_id, room_id FROM equipment WHERE school_id = ?"
                + " AND room_id IS NOT NULL ORDER BY id LIMIT 1", school);
        jdbc.update("DELETE FROM school_opening_balances WHERE school_id = ?", school);
        jdbc.update("UPDATE inventory_sessions SET status = 'CANCELLED' WHERE school_id = ? AND status IN ('DRAFT', 'PENDING')",
                school);
    }

    @Test
    void oldCodeStaysUntilStandardCodeIsAssigned() throws Exception {
        JsonNode item = body(create("thcs2.canbo", "SOCU-TEST-01"), 201);
        assertThat(item.path("code").asText()).isEqualTo("SOCU-TEST-01");
        assertThat(item.path("legacyCode").isNull() || item.path("legacyCode").isMissingNode()).isTrue();

        long id = item.path("id").asLong();
        JsonNode coded = body(call("thcs2.canbo", post("/api/school/equipment/" + id + "/standard-code")), 200);
        assertThat(coded.path("code").asText()).matches("^\\d{2}\\.[A-Z0-9]{2}\\.\\d{2}\\.(TB|PM|HL)\\.\\d{3}\\.\\d{2}$");
        assertThat(coded.path("legacyCode").asText()).isEqualTo("SOCU-TEST-01");

        JsonNode history = body(call("thcs2.canbo", get("/api/school/equipment/" + id + "/history")), 200);
        assertThat(history.toString()).contains("Vào sổ: số dư đầu kỳ").contains("Cấp mã chuẩn thay mã cũ SOCU-TEST-01");
    }

    @Test
    void mistakenRecordWithoutVoucherCanBeDeletedWhileOpeningBalanceIsOpen() throws Exception {
        long id = body(create("thcs2.canbo", null), 201).path("id").asLong();
        assertThat(call("thcs2.canbo", delete("/api/school/equipment/" + id)).getStatus()).isEqualTo(200);
    }

    @Test
    void closingOpeningBalanceBlocksManualEntry() throws Exception {
        assertThat(call("thcs2.canbo", post("/api/school/equipment/opening-balance/close")).getStatus())
                .as("cán bộ thiết bị không tự chốt").isEqualTo(403);
        JsonNode state = body(call("thcs2.hieutruong", post("/api/school/equipment/opening-balance/close")), 200);
        assertThat(state.path("closedAt").isNull()).isFalse();
        assertThat(state.path("equipmentCount").asInt()).isPositive();

        MockHttpServletResponse refused = create("thcs2.canbo", null);
        assertThat(refused.getStatus()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("đã chốt số dư đầu kỳ").contains("phiếu ghi tăng");
        assertThat(call("thcs2.hieutruong", post("/api/school/equipment/opening-balance/close")).getStatus())
                .as("chốt lần hai").isEqualTo(422);
    }

    @Test
    void countingInventoryBlocksManualEntry() throws Exception {
        String session = json.writeValueAsString(Map.of("title", "Kiểm kê thử khoá khai tay",
                "inventoryDate", LocalDate.now().toString(), "council", "Tổ kiểm kê thử"));
        MockHttpServletResponse opened = call("thcs2.canbo", post("/api/school/inventory_sessions")
                .contentType(MediaType.APPLICATION_JSON).content(session));
        assertThat(opened.getStatus()).as(opened.getContentAsString()).isEqualTo(201);
        MockHttpServletResponse refused = create("thcs2.canbo", null);
        assertThat(refused.getStatus()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("Đang kiểm kê").contains("Thêm thiết bị vào sổ sau khi");
    }

    private MockHttpServletResponse create(String username, String code) throws Exception {
        Map<String, Object> request = new java.util.HashMap<>(Map.of(
                "name", "Thiết bị thử số dư đầu kỳ",
                "catalog", Map.of("id", sample.get("catalog_id")),
                "room", Map.of("id", sample.get("room_id")),
                "quantity", 1,
                "originalValue", 1_000_000,
                "usageStartYear", 2020));
        if (sample.get("unit_id") != null) {
            request.put("unit", Map.of("id", sample.get("unit_id")));
        }
        // Form gửi sẵn mã gợi ý của hệ thống; người dùng gõ đè khi thiết bị mang tem cũ.
        request.put("code", code != null ? code : body(call(username, get("/api/school/equipment/next-code")
                .param("catalogId", String.valueOf(sample.get("catalog_id")))), 200).path("code").asText());
        return call(username, post("/api/school/equipment").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)));
    }

    private MockHttpServletResponse call(String username,
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        MockHttpServletResponse response = mvc.perform(
                request.header("Authorization", "Bearer " + jwt.issueAccessToken(user, Instant.now()))).andReturn().getResponse();
        response.setCharacterEncoding("UTF-8");
        return response;
    }

    private JsonNode body(MockHttpServletResponse response, int status) throws Exception {
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(status);
        return json.readTree(response.getContentAsString());
    }
}
