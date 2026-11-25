package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Khoá số liệu khi kiểm kê.
 *
 * <p>Phiếu kiểm kê chụp sổ lúc lập; từ đó tới lúc biên bản được duyệt (nháp — kể cả bị trả về — và chờ duyệt), mọi
 * phiếu làm đổi tài sản trong phạm vi của nó bị từ chối ở bước trình và bước duyệt. Không khoá thì tổ kiểm kê đếm
 * theo một bản sổ đã cũ: thiết bị vừa ghi tăng vào phòng đang kiểm không có trong danh sách đã chụp.
 *
 * <p>Phạm vi: phiếu kiểm kê cả trường khoá mọi tài sản của trường; phiếu một phòng khoá tài sản đang ở phòng đó và mọi
 * phiếu đưa tài sản VÀO phòng đó (phiếu ghi tăng). Kiểm tra gọi từ {@link VoucherWorkflow}, nên mọi loại phiếu đi qua
 * vòng duyệt chung dùng cùng một luật. Phiếu kiểm kê, đề xuất mua sắm không nằm trong danh sách: chúng không làm đổi
 * tài sản.
 */
@Component
public class InventoryFreeze {

    /** Trạng thái của phiếu kiểm kê đang kiểm: đã lập, chưa duyệt xong. */
    public static final List<String> COUNTING = List.of("DRAFT", "PENDING");

    /**
     * Loại phiếu → các câu SQL trả về (trường, phòng) mà phiếu {@code id} động tới. Mỗi câu nhận đúng một tham số là id
     * phiếu. Phòng trống chỉ khớp phiếu kiểm kê cả trường.
     */
    private static final Map<String, List<String>> TOUCHES = Map.of(
            "equipment_intakes", List.of(
                    "SELECT v.school_id, l.room_id FROM equipment_intake_lines l"
                            + " JOIN equipment_intakes v ON v.id = l.intake_id WHERE v.id = ?"));

    private final JdbcTemplate jdbc;

    public InventoryFreeze(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Loại phiếu này có bị khoá khi kiểm kê không. */
    public static boolean covers(String resource) {
        return TOUCHES.containsKey(resource);
    }

    /**
     * Từ chối (422) nếu phiếu {@code (resource, id)} động tới tài sản / phòng đang nằm trong một phiếu kiểm kê đang
     * kiểm. Câu từ chối nêu số phiếu kiểm kê (phiếu nháp chưa có số thì nêu tên).
     */
    public void requireNotFrozen(String resource, Long id) {
        List<String> touches = TOUCHES.get(resource);
        if (touches == null || id == null) {
            return;
        }
        Object[] ids = Collections.nCopies(touches.size(), (Object) id).toArray();
        Map<String, Object> session = countingSession(String.join(" UNION ", touches), ids);
        if (session != null) {
            throw new FieldValidationException("lines", message(session));
        }
    }

    /**
     * Từ chối (422) nếu đưa một tài sản MỚI vào {@code (trường, phòng)} đang kiểm kê — khai tay, nhập từ tệp. Tài sản
     * thêm giữa chừng không có trong danh sách đã chụp của phiếu kiểm kê, nên biên bản sẽ lệch với sổ.
     */
    public void requirePlaceNotFrozen(Long schoolId, Long roomId, String field) {
        if (schoolId == null) {
            return;
        }
        Map<String, Object> session = countingSession("SELECT CAST(? AS BIGINT), CAST(? AS BIGINT)",
                new Object[] {schoolId, roomId});
        if (session != null) {
            throw new FieldValidationException(field, placeMessage(session));
        }
    }

    /** Phiếu kiểm kê đang kiểm động tới một trong các cặp (trường, phòng) mà câu {@code touched} trả về. */
    private Map<String, Object> countingSession(String touched, Object[] touchedArgs) {
        // Kiểm kê toàn cơ sở (271) chỉ khoá phòng / tài sản của cơ sở đó (tài sản chưa có phòng → cơ sở chính).
        String sql = "SELECT s.code, s.title, r.name AS room, c.name AS campus FROM inventory_sessions s"
                + " LEFT JOIN rooms r ON r.id = s.room_id LEFT JOIN campuses c ON c.id = s.campus_id"
                + " WHERE s.status IN (" + String.join(",", Collections.nCopies(COUNTING.size(), "?")) + ")"
                + " AND EXISTS (SELECT 1 FROM (" + touched + ") t(school_id, room_id)"
                + " WHERE t.school_id = s.school_id AND ((s.room_id IS NULL AND (s.campus_id IS NULL OR "
                + FacilityCounting.campusOfRoomSql("t.room_id", "t.school_id") + " = s.campus_id))"
                + " OR s.room_id = t.room_id))"
                + " ORDER BY s.id LIMIT 1";
        Object[] args = new Object[COUNTING.size() + touchedArgs.length];
        for (int i = 0; i < COUNTING.size(); i++) {
            args[i] = COUNTING.get(i);
        }
        System.arraycopy(touchedArgs, 0, args, COUNTING.size(), touchedArgs.length);
        List<Map<String, Object>> found = jdbc.queryForList(sql, args);
        return found.isEmpty() ? null : found.get(0);
    }

    static String placeMessage(Map<String, Object> session) {
        return "Đang kiểm kê %s theo %s — số liệu đang khoá. Thêm thiết bị vào sổ sau khi phiếu kiểm kê hoàn tất"
                .formatted(scope(session), which(session));
    }

    private static String which(Map<String, Object> session) {
        Object code = session.get("code");
        return code != null ? "phiếu kiểm kê " + code : "phiếu kiểm kê nháp \"" + session.get("title") + "\"";
    }

    private static String scope(Map<String, Object> session) {
        Object room = session.get("room");
        Object campus = session.get("campus");
        return room != null ? "phòng " + room : campus != null ? "cơ sở " + campus : "cả trường";
    }

    static String message(Map<String, Object> session) {
        return "Đang kiểm kê %s theo %s — số liệu đang khoá. Hãy hoàn tất hoặc hủy phiếu kiểm kê trước khi trình hay duyệt phiếu này; nếu không mở được phiếu nháp, liên hệ cán bộ thiết bị đang lập phiếu"
                .formatted(scope(session), which(session));
    }
}
