package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.school.facility.BuildingService;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kiểm kê hạng mục CSVC: phiếu kiểm kê kiểm thêm khối nhà và phòng / hạng mục trong phạm vi của nó.
 *
 * <p>Lập danh sách = chụp kết cấu và hiện trạng đang ghi trên hồ sơ (cả trường: mọi khối nhà và phòng / hạng mục còn
 * dùng; phiếu một phòng: chỉ phòng đó). Tổ kiểm kê ghi cái thấy thực tế khi phiếu còn nháp — cùng lúc với kiểm đếm tài
 * sản. Phiếu được duyệt (hoàn tất) thì "Áp dụng" ghi phần thấy khác sổ vào hồ sơ CSVC qua {@code RoomService} /
 * {@code BuildingService}, chính thức luôn (không chờ xác nhận — 202 đã bỏ ở 240). Mỗi dòng áp một lần ({@code applied_at}).
 *
 * <p>Bảng {@code inventory_facility_lines} không có entity: chỉ phục vụ màn này, đọc / ghi bằng SQL như các số tóm tắt
 * của biên bản.
 */
@Service
public class InventoryFacilityService {

    private final InventorySessionService sessions;
    private final RoomService rooms;
    private final BuildingService buildings;
    private final JdbcTemplate jdbc;

    public InventoryFacilityService(InventorySessionService sessions, RoomService rooms, BuildingService buildings,
            JdbcTemplate jdbc) {
        this.sessions = sessions;
        this.rooms = rooms;
        this.buildings = buildings;
        this.jdbc = jdbc;
    }

    private static final String SELECT = """
            SELECT l.id, l.room_id, l.building_id,
                   COALESCE(r.code, b.code) AS code, COALESCE(r.name, b.name) AS name,
                   CASE WHEN l.building_id IS NOT NULL THEN 'Khối nhà' ELSE COALESCE(t.name, 'Phòng') END AS type_name,
                   t.kind AS type_kind, rb.name AS building_name,
                   l.structure_before, l.condition_before, l.structure_found, l.condition_found,
                   l.checked, l.note, l.applied_at
            FROM inventory_facility_lines l
            LEFT JOIN rooms r ON r.id = l.room_id
            LEFT JOIN room_types t ON t.id = r.room_type_id
            LEFT JOIN buildings rb ON rb.id = r.building_id
            LEFT JOIN buildings b ON b.id = l.building_id
            """;

    /** Danh sách hạng mục của phiếu, khối nhà trước, rồi phòng / hạng mục theo khối nhà, mã. */
    @Transactional(readOnly = true)
    public InventoryFacilityApi.Lines list(Long sessionId) {
        InventorySession session = sessions.readable(sessionId);
        List<InventoryFacilityApi.Line> lines = jdbc.query(SELECT + """
                WHERE l.session_id = ?
                ORDER BY (l.building_id IS NULL), rb.name NULLS FIRST, COALESCE(r.code, b.code), l.id""",
                InventoryFacilityService::line, sessionId);
        int checked = (int) lines.stream().filter(InventoryFacilityApi.Line::checked).count();
        int changed = (int) lines.stream().filter(InventoryFacilityApi.Line::changed).count();
        int applied = (int) lines.stream().filter(l -> l.appliedAt() != null).count();
        int pending = (int) lines.stream().filter(l -> l.changed() && l.appliedAt() == null).count();
        return new InventoryFacilityApi.Lines(lines, lines.size(), checked, changed, applied,
                session.getStatus() == VoucherStatus.DRAFT,
                session.getStatus() == VoucherStatus.COMPLETED && pending > 0);
    }

    /**
     * Lập (hoặc bổ sung) danh sách hạng mục theo phạm vi phiếu. Chạy lại chỉ thêm hạng mục mới khai sau đó, không đụng
     * dòng đã kiểm.
     */
    @Transactional
    public InventoryFacilityApi.Lines generate(Long sessionId) {
        InventorySession session = draft(sessionId);
        Long schoolId = session.getSchool().getId();
        if (session.getRoom() != null) {
            jdbc.update("""
                    INSERT INTO inventory_facility_lines (session_id, room_id, structure_before, condition_before)
                    SELECT ?, r.id, r.structure, r.condition FROM rooms r WHERE r.id = ? AND r.school_id = ?
                    ON CONFLICT DO NOTHING""", sessionId, session.getRoom().getId(), schoolId);
        } else {
            jdbc.update("""
                    INSERT INTO inventory_facility_lines (session_id, building_id, structure_before, condition_before)
                    SELECT ?, b.id, b.structure, b.condition FROM buildings b WHERE b.school_id = ? AND b.active
                    ON CONFLICT DO NOTHING""", sessionId, schoolId);
            jdbc.update("""
                    INSERT INTO inventory_facility_lines (session_id, room_id, structure_before, condition_before)
                    SELECT ?, r.id, r.structure, r.condition FROM rooms r WHERE r.school_id = ? AND r.active
                    ON CONFLICT DO NOTHING""", sessionId, schoolId);
        }
        return list(sessionId);
    }

    /** Ghi kết quả kiểm một hạng mục. Trống = như sổ. Chỉ khi phiếu còn nháp, như kiểm đếm tài sản. */
    @Transactional
    public InventoryFacilityApi.Lines update(Long sessionId, Long lineId, InventoryFacilityApi.LineUpdate request) {
        draft(sessionId);
        int n = jdbc.update("""
                UPDATE inventory_facility_lines
                SET structure_found = ?, condition_found = ?, checked = ?, note = ?, updated_at = ?
                WHERE id = ? AND session_id = ?""",
                request.structureFound() == null ? null : request.structureFound().name(),
                request.conditionFound() == null ? null : request.conditionFound().name(),
                request.checked() == null || request.checked(),
                request.note() == null || request.note().isBlank() ? null : request.note().trim(),
                Timestamp.from(Instant.now()), lineId, sessionId);
        if (n == 0) {
            throw new FieldValidationException("lineId", "Dòng không thuộc phiếu này");
        }
        return list(sessionId);
    }

    /**
     * Áp kết quả vào hồ sơ CSVC: phiếu đã duyệt, các dòng đã kiểm mà thấy khác sổ và chưa áp. Cần quyền sửa phòng /
     * khối nhà như sửa tay.
     */
    @Transactional
    public InventoryFacilityApi.Applied apply(Long sessionId) {
        InventorySession session = sessions.readable(sessionId);
        if (!CurrentUser.has("inventory_sessions:write") && !CurrentUser.has("inventory_sessions:approve")) {
            throw new AccessDeniedException("inventory_sessions:write");
        }
        if (session.getStatus() != VoucherStatus.COMPLETED) {
            throw new FieldValidationException("status", "Biên bản chưa được duyệt — chưa áp dụng vào hồ sơ CSVC được");
        }
        List<InventoryFacilityApi.Line> todo = jdbc.query(SELECT + """
                WHERE l.session_id = ? AND l.checked AND l.applied_at IS NULL
                  AND (l.structure_found IS NOT NULL OR l.condition_found IS NOT NULL)""",
                InventoryFacilityService::line, sessionId).stream().filter(InventoryFacilityApi.Line::changed).toList();
        if (todo.isEmpty()) {
            throw new FieldValidationException("lines", "Không còn hạng mục nào lệch với hệ thống chưa áp dụng");
        }
        Map<Boolean, List<InventoryFacilityApi.Line>> byKind = todo.stream()
                .collect(Collectors.partitioningBy(l -> l.buildingId() != null));
        if (!byKind.get(true).isEmpty() && !CurrentUser.has("buildings:write")) {
            throw new AccessDeniedException("buildings:write");
        }
        if (!byKind.get(false).isEmpty() && !CurrentUser.has("rooms:write")) {
            throw new AccessDeniedException("rooms:write");
        }
        Timestamp now = Timestamp.from(Instant.now());
        for (InventoryFacilityApi.Line l : todo) {
            FacilityStructure structure = parse(FacilityStructure.class, l.structureFound());
            FacilityCondition condition = parse(FacilityCondition.class, l.conditionFound());
            if (l.buildingId() != null) {
                buildings.applyInventory(l.buildingId(), structure, condition);
            } else {
                rooms.applyInventory(l.roomId(), structure, condition);
            }
            jdbc.update("UPDATE inventory_facility_lines SET applied_at = ? WHERE id = ?", now, l.id());
        }
        return new InventoryFacilityApi.Applied(todo.size());
    }

    private InventorySession draft(Long sessionId) {
        InventorySession session = sessions.writable(sessionId);
        if (session.getStatus() != VoucherStatus.DRAFT) {
            throw new FieldValidationException("status",
                    "Biên bản đã trình — kết quả kiểm đã chốt, phải được trả lại mới sửa");
        }
        return session;
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value) {
        return value == null ? null : Enum.valueOf(type, value);
    }

    private static InventoryFacilityApi.Line line(ResultSet rs, int i) throws SQLException {
        Timestamp applied = rs.getTimestamp("applied_at");
        return new InventoryFacilityApi.Line(rs.getLong("id"), rs.getObject("room_id", Long.class),
                rs.getObject("building_id", Long.class), rs.getString("code"), rs.getString("name"),
                rs.getString("type_name"), rs.getString("type_kind"), rs.getString("building_name"),
                rs.getString("structure_before"), rs.getString("condition_before"), rs.getString("structure_found"),
                rs.getString("condition_found"), rs.getBoolean("checked"), rs.getString("note"),
                applied == null ? null : applied.toInstant());
    }
}
