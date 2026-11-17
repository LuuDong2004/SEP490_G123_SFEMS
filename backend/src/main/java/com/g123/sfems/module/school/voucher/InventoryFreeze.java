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
 * theo một bản sổ đã cũ: một tài sản vừa cấp phát sang phòng khác hiện thành "sai vị trí", một tài sản vừa thanh lý
 * hiện thành "thiếu".
 *
 * <p>Phạm vi: phiếu kiểm kê cả trường khoá mọi tài sản của trường; phiếu một phòng khoá tài sản đang ở phòng đó và mọi
 * phiếu đưa tài sản VÀO phòng đó (cấp phát, ghi tăng, nhận điều chuyển). Kiểm tra gọi từ {@link VoucherWorkflow},
 * nên mọi loại phiếu đi qua vòng duyệt chung dùng cùng một luật. Bản thân phiếu kiểm kê, mượn phòng, hao mòn không
 * nằm trong danh sách: chúng không làm đổi tài sản.
 */
@Component
public class InventoryFreeze {

    /** Trạng thái của phiếu kiểm kê đang kiểm: đã lập, chưa duyệt xong. */
    public static final List<String> COUNTING = List.of("DRAFT", "PENDING");

    private static String byLines(String lineTable, String fk) {
        return "SELECT e.school_id, e.room_id FROM %s l JOIN equipment e ON e.id = l.equipment_id WHERE l.%s = ?"
                .formatted(lineTable, fk);
    }

    /**
     * Loại phiếu → các câu SQL trả về (trường, phòng) mà phiếu {@code id} động tới. Mỗi câu nhận đúng một tham số là id
     * phiếu. Phòng trống chỉ khớp phiếu kiểm kê cả trường.
     */
    private static final Map<String, List<String>> TOUCHES = Map.ofEntries(
            Map.entry("equipment_allocations", List.of(
                    byLines("equipment_allocation_lines", "allocation_id"),
                    "SELECT v.school_id, v.room_id FROM equipment_allocations v WHERE v.id = ? AND v.room_id IS NOT NULL")),
            Map.entry("equipment_transfers", List.of(
                    byLines("equipment_transfer_lines", "transfer_id"),
                    "SELECT v.target_school_id, v.received_room_id FROM equipment_transfers v WHERE v.id = ?")),
            Map.entry("equipment_loans", List.of(byLines("equipment_loan_lines", "loan_id"))),
            Map.entry("damage_reports", List.of(byLines("damage_report_lines", "report_id"))),
            Map.entry("repair_orders", List.of(byLines("repair_order_lines", "order_id"))),
            Map.entry("warranty_claims", List.of(byLines("warranty_claim_lines", "claim_id"))),
            Map.entry("maintenance_orders", List.of(byLines("maintenance_order_lines", "order_id"))),
            Map.entry("disposals", List.of(byLines("disposal_lines", "disposal_id"))),
            Map.entry("storage_orders", List.of(
                    byLines("storage_order_lines", "order_id"),
                    "SELECT v.school_id, v.storage_room_id FROM storage_orders v WHERE v.id = ? AND v.storage_room_id IS NOT NULL")),
            Map.entry("equipment_intakes", List.of(
                    "SELECT v.school_id, l.room_id FROM equipment_intake_lines l"
                            + " JOIN equipment_intakes v ON v.id = l.intake_id WHERE v.id = ?")),
            Map.entry("stock_issues", List.of(
                    "SELECT v.school_id, l.room_id FROM stock_issue_lines l"
                            + " JOIN stock_issues v ON v.id = l.issue_id WHERE v.id = ?")),
            Map.entry("consumption_records", List.of(
                    "SELECT v.school_id, v.room_id FROM consumption_records v WHERE v.id = ?")));

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
        String touched = String.join(" UNION ", touches);
        // Kiểm kê toàn cơ sở (271) chỉ khoá phòng / tài sản của cơ sở đó (tài sản chưa có phòng → cơ sở chính).
        String sql = "SELECT s.code, s.title, r.name AS room, c.name AS campus FROM inventory_sessions s"
                + " LEFT JOIN rooms r ON r.id = s.room_id LEFT JOIN campuses c ON c.id = s.campus_id"
                + " WHERE s.status IN (" + String.join(",", Collections.nCopies(COUNTING.size(), "?")) + ")"
                + " AND EXISTS (SELECT 1 FROM (" + touched + ") t(school_id, room_id)"
                + " WHERE t.school_id = s.school_id AND ((s.room_id IS NULL AND (s.campus_id IS NULL OR "
                + FacilityCounting.campusOfRoomSql("t.room_id", "t.school_id") + " = s.campus_id))"
                + " OR s.room_id = t.room_id))"
                + " ORDER BY s.id LIMIT 1";
        Object[] args = new Object[COUNTING.size() + touches.size()];
        for (int i = 0; i < COUNTING.size(); i++) {
            args[i] = COUNTING.get(i);
        }
        for (int i = 0; i < touches.size(); i++) {
            args[COUNTING.size() + i] = id;
        }
        List<Map<String, Object>> found = jdbc.queryForList(sql, args);
        if (found.isEmpty()) {
            return;
        }
        throw new FieldValidationException("lines", message(found.get(0)));
    }

    static String message(Map<String, Object> session) {
        Object code = session.get("code");
        String which = code != null ? "phiếu kiểm kê " + code : "phiếu kiểm kê nháp \"" + session.get("title") + "\"";
        Object room = session.get("room");
        Object campus = session.get("campus");
        String scope = room != null ? "phòng " + room : campus != null ? "cơ sở " + campus : "cả trường";
        return "Đang kiểm kê %s theo %s — số liệu đang khoá. Hãy hoàn tất hoặc hủy phiếu kiểm kê trước khi trình hay duyệt phiếu này; nếu không mở được phiếu nháp, liên hệ cán bộ thiết bị đang lập phiếu"
                .formatted(scope, which);
    }
}
