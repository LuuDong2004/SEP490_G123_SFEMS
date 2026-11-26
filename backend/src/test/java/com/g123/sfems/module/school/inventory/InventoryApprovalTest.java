package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.shared.security.JwtService;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Duyệt biên bản kiểm kê ghi kết quả vào hồ sơ thiết bị (KK-06): tình trạng thấy khác sổ thì ghi tình trạng mới; thấy ở
 * kho thì chuyển phòng và thành "Trong kho"; không thấy thì "Mất", và hồ sơ Mất xoá được mà biên bản vẫn giữ dòng (296).
 * Đợt đã đóng thì không trình biên bản; tài khoản một cơ sở không lập phiếu theo đợt.
 *
 * <p>Đi trọn đường HTTP như người dùng: cán bộ thiết bị lập, kiểm đếm, trình; hiệu trưởng duyệt. Giữa hai lần gọi xoá
 * bộ nhớ đệm của Hibernate để mỗi lần gọi đọc lại CSDL như một yêu cầu riêng.
 */
@SpringBootTest
@Transactional
class InventoryApprovalTest {

    /** Cán bộ lập và lãnh đạo duyệt biên bản của cùng một trường, cả hai quản lý cả trường (chọn theo quyền). */
    String maker;
    String approver;
    private static final String API = "/api/school/inventory_sessions";

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

    @Autowired
    EntityManager em;

    @Autowired
    InventorySessionService sessions;

    MockMvc mvc;
    long school;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
        List<Map<String, Object>> pair = jdbc.queryForList("SELECT u.username AS maker, a.username AS approver, us.school_id"
                + " FROM users u JOIN user_schools us ON us.id = u.id"
                + " JOIN user_schools as2 ON as2.school_id = us.school_id AND as2.campus_id IS NULL JOIN users a ON a.id = as2.id"
                + " WHERE us.campus_id IS NULL AND a.id <> u.id AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id AND p.code = 'inventory_sessions:write') AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = a.id AND p.code = 'inventory_sessions:approve')"
                + " ORDER BY (u.username = 'thcs2.canbo') DESC, u.id, a.id LIMIT 1");
        Assumptions.assumeTrue(!pair.isEmpty(), "Thiếu cặp tài khoản lập và duyệt biên bản kiểm kê của một trường");
        maker = (String) pair.get(0).get("maker");
        approver = (String) pair.get(0).get("approver");
        school = ((Number) pair.get(0).get("school_id")).longValue();
        // Phiếu đang dở của trường chặn phiếu mới trùng phạm vi — bỏ hết (giao dịch thử cuộn lại sau mỗi ca).
        jdbc.update("UPDATE inventory_sessions SET status = 'CANCELLED' WHERE school_id = ?"
                + " AND status IN ('DRAFT', 'PENDING', 'APPROVED')", school);
    }

    @Test
    void approvalWritesFoundConditionAndMovesToStoreroomAsInStock() throws Exception {
        long room = roomWithInUseItems(2);
        Long storeroom = jdbc.query("SELECT r.id FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id"
                + " WHERE r.school_id = ? AND rt.code = 'KHO' ORDER BY r.id LIMIT 1", rs -> rs.next() ? rs.getLong(1) : null, school);
        Assumptions.assumeTrue(storeroom != null, "Trường thử chưa có phòng loại kho");

        JsonNode session = open(room, null);
        long id = session.path("id").asLong();
        List<JsonNode> inUse = inUseLines(session);
        JsonNode worse = inUse.get(0);
        JsonNode moved = inUse.get(1);
        String from = worse.path("expectedCondition").isNull() ? null : worse.path("expectedCondition").asText();
        String to = "KEM".equals(from) ? "TOT" : "KEM";

        JsonNode counted = count(id, session, line -> {
            if (line.path("id").asLong() == worse.path("id").asLong()) {
                return Map.of("foundCondition", to);
            }
            if (line.path("id").asLong() == moved.path("id").asLong()) {
                return Map.of("foundRoom", Map.of("id", storeroom));
            }
            return Map.of();
        });
        JsonNode worseCounted = lineOf(counted, worse.path("id").asLong());
        assertThat(worseCounted.path("discrepancies").toString()).contains("CONDITION");
        assertThat(lineOf(counted, moved.path("id").asLong()).path("discrepancies").toString()).contains("WRONG_ROOM");
        assertThat(counted.path("summary").path("wrongCondition").asInt()).isEqualTo(1);
        assertThat(counted.path("summary").path("wrongRoom").asInt()).isEqualTo(1);
        assertThat(counted.path("summary").path("matched").asInt()).isEqualTo(counted.path("lines").size() - 2);
        // Số tóm tắt của danh sách (đếm bằng SQL) phải khớp phép đếm trên từng dòng.
        InventorySessionApi.Summary listed = sessions.summaries(List.of(id)).get(id);
        assertThat(listed.wrongCondition()).isEqualTo(1);
        assertThat(listed.wrongRoom()).isEqualTo(1);
        assertThat(listed.matched()).isEqualTo(counted.path("summary").path("matched").asInt());

        submitAndApprove(id);

        long worseItem = worse.path("equipment").path("id").asLong();
        assertThat(jdbc.queryForObject("SELECT condition FROM equipment WHERE id = ?", String.class, worseItem))
                .as("tình trạng thấy được ghi vào hồ sơ").isEqualTo(to);
        assertThat(history(worseItem, id, "condition")).as("một dòng lịch sử đổi tình trạng theo biên bản")
                .singleElement().satisfies(h -> {
                    assertThat(h.get("to_value")).isEqualTo("TOT".equals(to) ? "Tốt" : "Kém");
                    assertThat((String) h.get("note")).startsWith("Kiểm kê: tình trạng").endsWith("TOT".equals(to) ? "Tốt" : "Kém");
                });

        long movedItem = moved.path("equipment").path("id").asLong();
        Map<String, Object> after = jdbc.queryForMap("SELECT room_id, status FROM equipment WHERE id = ?", movedItem);
        assertThat(((Number) after.get("room_id")).longValue()).isEqualTo(storeroom);
        assertThat(after.get("status")).as("thấy ở kho thì thành Trong kho").isEqualTo("IN_STOCK");
        assertThat(history(movedItem, id, "status")).singleElement()
                .satisfies(h -> assertThat(h.get("to_value")).isEqualTo("Trong kho"));
        assertThat(history(movedItem, id, "room")).hasSize(1);
    }

    @Test
    void lostItemCanBeDeletedAndTheReportKeepsItsLine() throws Exception {
        long room = roomWithInUseItems(1);
        JsonNode session = open(room, null);
        long id = session.path("id").asLong();
        JsonNode missing = inUseLines(session).get(0);
        long lineId = missing.path("id").asLong();
        long item = missing.path("equipment").path("id").asLong();
        String code = missing.path("equipment").path("code").asText();
        assertThat(missing.path("equipmentCode").asText()).isEqualTo(code);

        count(id, session, line -> line.path("id").asLong() == lineId ? Map.of("found", false) : Map.of());
        submitAndApprove(id);
        assertThat(jdbc.queryForObject("SELECT status FROM equipment WHERE id = ?", String.class, item)).isEqualTo("LOST");

        MockHttpServletResponse deleted = call(maker, delete("/api/school/equipment/" + item));
        assertThat(deleted.getStatus()).as(deleted.getContentAsString()).isEqualTo(200);
        reset();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM equipment WHERE id = ?", Integer.class, item)).isZero();

        Map<String, Object> kept = jdbc.queryForMap("SELECT equipment_id, equipment_code FROM inventory_lines WHERE id = ?", lineId);
        assertThat(kept.get("equipment_id")).as("khoá ngoại SET NULL").isNull();
        assertThat(kept.get("equipment_code")).as("mã chụp lúc lập phiếu").isEqualTo(code);

        JsonNode report = body(call(maker, get(API + "/" + id)), 200);
        assertThat(report.path("lines").size()).as("biên bản vẫn đủ dòng").isEqualTo(session.path("lines").size());
        JsonNode line = lineOf(report, lineId);
        assertThat(line.path("equipment").isNull() || line.path("equipment").isMissingNode()).isTrue();
        assertThat(line.path("equipmentCode").asText()).isEqualTo(code);
        assertThat(line.path("discrepancies").toString()).contains("MISSING");
        assertThat(body(call(maker, get(API + "/" + id + "/breakdown")), 200).toString()).contains("\"missing\":1");
    }

    @Test
    void itemOnAnUnfinishedInventoryCannotBeDeleted() throws Exception {
        long room = roomWithInUseItems(1);
        JsonNode session = open(room, null);
        long item = inUseLines(session).get(0).path("equipment").path("id").asLong();
        MockHttpServletResponse refused = call(maker, delete("/api/school/equipment/" + item));
        assertThat(refused.getStatus()).as(refused.getContentAsString()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("phiếu kiểm kê").contains("chưa hoàn tất");
    }

    @Test
    void closedCampaignBlocksSubmit() throws Exception {
        long campaign = campaign();
        JsonNode session = open(null, campaign);
        reset();
        jdbc.update("UPDATE inventory_campaigns SET closed = TRUE WHERE id = ?", campaign);
        MockHttpServletResponse refused = call(maker, post(API + "/" + session.path("id").asLong() + "/submit"));
        assertThat(refused.getStatus()).as(refused.getContentAsString()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("đã đóng").contains("không trình");
    }

    @Test
    void campusPinnedAccountCannotOpenCampaignSession() throws Exception {
        List<String> pinned = jdbc.queryForList("SELECT u.username FROM users u JOIN user_schools us ON us.id = u.id"
                + " WHERE us.campus_id IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id AND p.code = 'inventory_sessions:write') ORDER BY (u.username = 'thcs.canbo2') DESC, u.id LIMIT 1",
                String.class);
        Assumptions.assumeTrue(!pinned.isEmpty(), "Thiếu tài khoản chỉ quản lý một cơ sở");
        long campaign = campaign();
        MockHttpServletResponse refused = call(pinned.get(0), post(API).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("title", "Kiểm kê theo đợt thử", "inventoryDate",
                        LocalDate.now().toString(), "council", "Tổ kiểm kê thử", "campaign", Map.of("id", campaign)))));
        Assumptions.assumeTrue(refused.getStatus() != 403, "Tài khoản một cơ sở không có quyền lập phiếu kiểm kê");
        assertThat(refused.getStatus()).as(refused.getContentAsString()).isEqualTo(422);
        assertThat(refused.getContentAsString()).contains("quản lý cả trường");
    }

    // ------------------------------------------------------------------ dựng dữ liệu

    /** Phòng không phải kho của trường thử, có ít nhất {@code min} thiết bị đang sử dụng — phòng ít thiết bị nhất. */
    private long roomWithInUseItems(int min) {
        Long room = jdbc.query("""
                SELECT r.id FROM rooms r
                LEFT JOIN room_types rt ON rt.id = r.room_type_id
                WHERE r.school_id = ? AND rt.code IS DISTINCT FROM 'KHO'
                  AND (SELECT COUNT(*) FROM equipment e WHERE e.room_id = r.id AND e.status = 'IN_USE') >= ?
                ORDER BY (SELECT COUNT(*) FROM equipment e WHERE e.room_id = r.id), r.id
                LIMIT 1""", rs -> rs.next() ? rs.getLong(1) : null, school, min);
        Assumptions.assumeTrue(room != null, "Trường thử không có phòng đủ " + min + " thiết bị đang sử dụng");
        return room;
    }

    /** Đợt kiểm kê đã duyệt, đang mở của Sở — trường nào cũng thấy. */
    private long campaign() {
        Long id = jdbc.query("""
                INSERT INTO inventory_campaigns (managing_body_id, title, cutoff_date, deadline, closed, status, created_at)
                SELECT id, 'Đợt kiểm kê thử', DATE '2099-12-01', DATE '2099-12-31', FALSE, 'APPROVED', now()
                FROM departments_of_education WHERE type = 'SO' ORDER BY id LIMIT 1
                RETURNING id""", rs -> rs.next() ? rs.getLong(1) : null);
        Assumptions.assumeTrue(id != null, "Thiếu Sở GD&ĐT trong dữ liệu nền");
        return id;
    }

    /** Lập phiếu (một phòng, hoặc cả trường theo đợt) bằng tài khoản cán bộ thiết bị. */
    private JsonNode open(Long room, Long campaign) throws Exception {
        Map<String, Object> request = new HashMap<>(Map.of("title", "Kiểm kê thử duyệt biên bản",
                "inventoryDate", LocalDate.now().toString(), "council", "Tổ kiểm kê thử"));
        if (room != null) {
            request.put("room", Map.of("id", room));
        }
        if (campaign != null) {
            request.put("campaign", Map.of("id", campaign));
        }
        JsonNode session = body(call(maker, post(API).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request))), 201);
        reset();
        return session;
    }

    private static List<JsonNode> inUseLines(JsonNode session) {
        List<JsonNode> out = new ArrayList<>();
        for (JsonNode line : session.path("lines")) {
            if ("IN_USE".equals(line.path("equipment").path("status").asText())) {
                out.add(line);
            }
        }
        return out;
    }

    /** Ghi kết quả cho MỌI dòng: mặc định "có, như sổ"; {@code change} trả phần khác sổ của từng dòng. */
    private JsonNode count(long id, JsonNode session, java.util.function.Function<JsonNode, Map<String, Object>> change)
            throws Exception {
        List<Map<String, Object>> lines = new ArrayList<>();
        for (JsonNode line : session.path("lines")) {
            Map<String, Object> input = new HashMap<>();
            input.put("lineId", line.path("id").asLong());
            input.put("found", true);
            input.putAll(change.apply(line));
            lines.add(input);
        }
        JsonNode counted = body(call(maker, post(API + "/" + id + "/count").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lines", lines)))), 200);
        reset();
        return counted;
    }

    /** Cán bộ trình, hiệu trưởng duyệt hết các bước của luồng duyệt trường. */
    private void submitAndApprove(long id) throws Exception {
        JsonNode state = body(call(maker, post(API + "/" + id + "/submit")), 200);
        reset();
        for (int step = 0; step < 3 && "PENDING".equals(state.path("status").asText()); step++) {
            MockHttpServletResponse approved = call(approver, post(API + "/" + id + "/approve")
                    .contentType(MediaType.APPLICATION_JSON).content("{}"));
            Assumptions.assumeTrue(approved.getStatus() == 200,
                    "Luồng duyệt kiểm kê có bước ngoài hiệu trưởng: " + approved.getContentAsString());
            state = json.readTree(approved.getContentAsString());
            reset();
        }
        assertThat(state.path("status").asText()).as("biên bản đã ghi vào sổ").isEqualTo("COMPLETED");
    }

    private List<Map<String, Object>> history(long item, long session, String field) {
        return jdbc.queryForList("SELECT to_value, note FROM equipment_history WHERE equipment_id = ? AND field = ?"
                + " AND action = 'KIEM_KE' AND voucher_resource = 'inventory_sessions' AND voucher_id = ?", item, field, session);
    }

    private static JsonNode lineOf(JsonNode session, long lineId) {
        for (JsonNode line : session.path("lines")) {
            if (line.path("id").asLong() == lineId) {
                return line;
            }
        }
        throw new AssertionError("Không thấy dòng " + lineId);
    }

    /** Đẩy thay đổi xuống CSDL và bỏ bộ nhớ đệm — lần gọi sau đọc lại như một yêu cầu mới. */
    private void reset() {
        em.flush();
        em.clear();
    }

    private MockHttpServletResponse call(String username, MockHttpServletRequestBuilder request) throws Exception {
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
