package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Khoá số liệu khi kiểm kê (KK-05).
 *
 * <p>Phiếu kiểm kê chụp sổ lúc lập; từ đó tới lúc biên bản được duyệt (nháp — kể cả bị trả về — và chờ duyệt), mọi
 * phiếu làm đổi tài sản trong phạm vi của nó bị từ chối ở bước trình và bước duyệt. Không khoá thì tổ kiểm kê đếm
 * theo một bản sổ đã cũ: một tài sản vừa ghi tăng không có trên phiếu, sổ và thực tế lệch nhau.
 *
 * <p>Phạm vi: phiếu kiểm kê cả trường khoá mọi tài sản của trường; phiếu một phòng khoá mọi phiếu đưa tài sản VÀO
 * phòng đó. Kiểm tra gọi từ {@link VoucherWorkflow}, nên mọi loại phiếu đi qua vòng duyệt chung dùng cùng một luật.
 */
@Component
public class InventoryFreeze {

    /** Trạng thái của phiếu kiểm kê đang kiểm: đã lập, chưa duyệt xong. */
    public static final List<VoucherStatus> COUNTING = List.of(VoucherStatus.DRAFT, VoucherStatus.PENDING);

    /**
     * Loại phiếu → câu SQL trả về các cặp (trường, phòng) mà phiếu {@code id} động tới; nhận đúng một tham số là id
     * phiếu. Loại phiếu không có ở đây (đề xuất mua sắm, chính phiếu kiểm kê) không làm đổi tài sản nên không khoá.
     */
    private static final Map<String, String> TOUCHES = Map.of(
            "equipment_intakes", """
                    SELECT v.school_id, l.room_id FROM equipment_intake_lines l
                    JOIN equipment_intakes v ON v.id = l.intake_id WHERE v.id = ?""");

    private final JdbcTemplate jdbc;

    public InventoryFreeze(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Từ chối (422) nếu phiếu {@code (resource, id)} động tới tài sản / phòng đang nằm trong một phiếu kiểm kê đang
     * kiểm. Câu từ chối nêu số phiếu kiểm kê (phiếu nháp chưa có số thì nêu tên).
     */
    public void requireNotFrozen(String resource, Long id) {
        String touched = TOUCHES.get(resource);
        if (touched == null || id == null) {
            return;
        }
        List<Map<String, Object>> found = jdbc.queryForList("""
                SELECT s.code, s.title, r.name AS room FROM inventory_sessions s
                LEFT JOIN rooms r ON r.id = s.room_id
                WHERE s.status IN ('DRAFT', 'PENDING')
                  AND EXISTS (SELECT 1 FROM (%s) t(school_id, room_id)
                              WHERE t.school_id = s.school_id AND (s.room_id IS NULL OR s.room_id = t.room_id))
                ORDER BY s.id LIMIT 1""".formatted(touched), id);
        if (!found.isEmpty()) {
            throw new FieldValidationException("lines", message(found.get(0)));
        }
    }

    private static String message(Map<String, Object> session) {
        Object code = session.get("code");
        String which = code != null ? "phiếu kiểm kê " + code : "phiếu kiểm kê nháp \"" + session.get("title") + "\"";
        Object room = session.get("room");
        String scope = room == null ? "cả trường" : "phòng " + room;
        return "Đang kiểm kê %s theo %s — số liệu đang khoá. Hãy hoàn tất hoặc hủy phiếu kiểm kê trước khi trình hay duyệt phiếu này; nếu không mở được phiếu nháp, liên hệ cán bộ thiết bị đang lập phiếu"
                .formatted(scope, which);
    }
}
