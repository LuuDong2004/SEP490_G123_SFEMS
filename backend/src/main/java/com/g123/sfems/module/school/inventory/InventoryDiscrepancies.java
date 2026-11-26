package com.g123.sfems.module.school.inventory;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.inventory.InventoryCampaignService.ProgressRow;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tổng hợp chênh lệch kiểm kê: một biên bản theo phòng (kho là phòng loại kho, chưa xếp phòng cũng tính là kho) và
 * theo môn học của thiết bị; một đợt theo trường.
 *
 * <p>Đếm theo sổ (phòng ghi trên sổ lúc lập phiếu), cùng định nghĩa với {@code InventoryLine.discrepancies}: không
 * thấy → thiếu; thấy ở phòng khác → sai vị trí; thấy mà tình trạng khác sổ → sai tình trạng; khớp là thấy và không lệch
 * gì (kể cả số lượng lô).
 *
 * <p>Nối thiết bị bằng LEFT JOIN: hồ sơ đã Mất có thể bị xoá sau khi biên bản duyệt (296), dòng vẫn được đếm — chỉ mất
 * môn học, rơi vào nhóm "Dùng chung".
 */
@Service
@Transactional(readOnly = true)
public class InventoryDiscrepancies {

    /** Một nhóm: phòng, môn hoặc trường. {@code storeroom} chỉ có nghĩa khi nhóm theo phòng. */
    public record Row(Long id, String name, boolean storeroom, int total, int checked, int matched, int missing,
            int wrongRoom, int wrongCondition) {
    }

    public record SessionBreakdown(List<Row> rooms, List<Row> subjects) {
    }

    /** Một trường trong đợt: biên bản của trường (nếu người xem mở được) và số chênh lệch của nó. */
    public record SchoolRow(Long schoolId, String schoolCode, String schoolName, Long sessionId, String sessionCode,
            String status, Row counts, int surplus) {
    }

    private static final String LINES = """
            SELECT l.session_id, l.expected_room_id AS room_id, r.name AS room_name,
                   (r.id IS NULL OR rt.system_key = 'KHO') AS storeroom,
                   c.subject_id, sj.name AS subject_name, l.found,
                   COALESCE(l.found AND l.expected_room_id IS DISTINCT FROM l.found_room_id, FALSE) AS wrong_room,
                   COALESCE(l.found AND l.found_condition IS NOT NULL
                            AND l.found_condition IS DISTINCT FROM l.expected_condition, FALSE) AS wrong_condition,
                   COALESCE(l.found AND l.counted_quantity < l.expected_quantity, FALSE) AS shortage
            FROM inventory_lines l
            LEFT JOIN equipment e ON e.id = l.equipment_id
            LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id
            LEFT JOIN subjects sj ON sj.id = c.subject_id
            LEFT JOIN rooms r ON r.id = l.expected_room_id
            LEFT JOIN room_types rt ON rt.id = r.room_type_id
            """;

    private static final String COUNTS = """
            COUNT(*) AS total, COUNT(found) AS checked,
            COUNT(*) FILTER (WHERE found AND NOT wrong_room AND NOT wrong_condition AND NOT shortage) AS matched,
            COUNT(*) FILTER (WHERE found = FALSE) AS missing,
            COUNT(*) FILTER (WHERE wrong_room) AS wrong_room,
            COUNT(*) FILTER (WHERE wrong_condition) AS wrong_condition
            """;

    private final InventorySessionService sessions;
    private final InventoryCampaignService campaigns;
    private final VisibleSchools visible;
    private final JdbcTemplate jdbc;

    public InventoryDiscrepancies(InventorySessionService sessions, InventoryCampaignService campaigns,
            VisibleSchools visible, JdbcTemplate jdbc) {
        this.sessions = sessions;
        this.campaigns = campaigns;
        this.visible = visible;
        this.jdbc = jdbc;
    }

    /** Chênh lệch của một biên bản theo phòng và theo môn. Đọc biên bản qua phạm vi đọc trước. */
    public SessionBreakdown session(Long id) {
        sessions.get(id);
        List<Row> rooms = jdbc.query("SELECT room_id, room_name, storeroom, " + COUNTS
                        + " FROM (" + LINES + " WHERE l.session_id = ?) x"
                        + " GROUP BY room_id, room_name, storeroom ORDER BY storeroom DESC, room_name NULLS FIRST",
                (rs, n) -> row(rs, (Long) rs.getObject("room_id"),
                        rs.getString("room_name") == null ? "Kho (chưa xếp phòng)" : rs.getString("room_name"),
                        rs.getBoolean("storeroom")),
                id);
        List<Row> subjects = jdbc.query("SELECT subject_id, subject_name, " + COUNTS
                        + " FROM (" + LINES + " WHERE l.session_id = ?) x"
                        + " GROUP BY subject_id, subject_name ORDER BY subject_name NULLS FIRST",
                (rs, n) -> row(rs, (Long) rs.getObject("subject_id"),
                        rs.getString("subject_name") == null ? "Dùng chung" : rs.getString("subject_name"), false),
                id);
        return new SessionBreakdown(rooms, subjects);
    }

    /**
     * Chênh lệch theo trường của một đợt. Cùng danh sách trường với bảng tiến độ ({@code progress}); số chỉ có ở biên
     * bản người xem mở được — Sở / UBND không xem số của biên bản còn ở bàn hiệu trưởng.
     */
    public List<SchoolRow> campaign(Long id) {
        List<ProgressRow> schools = campaigns.progress(id).schools();
        List<Long> ids = schools.stream().filter(ProgressRow::canOpen).map(ProgressRow::sessionId)
                .filter(Objects::nonNull).toList();
        Map<Long, Row> counts = new HashMap<>();
        Map<Long, Integer> surplus = new HashMap<>();
        if (!ids.isEmpty()) {
            String in = String.join(",", Collections.nCopies(ids.size(), "?"));
            jdbc.query("SELECT x.session_id, " + COUNTS + " FROM (" + LINES
                            + " JOIN inventory_sessions s ON s.id = l.session_id WHERE l.session_id IN (" + in + ")"
                            + visible.sqlFilter("s.school_id") + ") x GROUP BY x.session_id",
                    (ResultSet rs) -> {
                        long sessionId = rs.getLong("session_id");
                        counts.put(sessionId, row(rs, sessionId, null, false));
                    },
                    ids.toArray());
            jdbc.query("SELECT u.session_id, COALESCE(SUM(u.quantity), 0) AS n FROM inventory_surplus u"
                            + " JOIN inventory_sessions s ON s.id = u.session_id WHERE u.session_id IN (" + in + ")"
                            + visible.sqlFilter("s.school_id") + " GROUP BY u.session_id",
                    (ResultSet rs) -> {
                        surplus.put(rs.getLong("session_id"), rs.getInt("n"));
                    },
                    ids.toArray());
        }
        return schools.stream()
                .map(s -> {
                    boolean open = s.canOpen() && s.sessionId() != null;
                    return new SchoolRow(s.schoolId(), s.schoolCode(), s.schoolName(),
                            open ? s.sessionId() : null, s.sessionCode(), s.status(),
                            open ? counts.get(s.sessionId()) : null,
                            open ? surplus.getOrDefault(s.sessionId(), 0) : 0);
                })
                .toList();
    }

    private static Row row(ResultSet rs, Long id, String name, boolean storeroom) throws SQLException {
        return new Row(id, name, storeroom, rs.getInt("total"), rs.getInt("checked"), rs.getInt("matched"),
                rs.getInt("missing"), rs.getInt("wrong_room"), rs.getInt("wrong_condition"));
    }
}
