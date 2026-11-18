package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Một tài sản chỉ nằm trên MỘT phiếu đang chạy.
 *
 * <p>Phiếu đã trình mà chưa xong — chờ duyệt, hoặc đã duyệt nhưng chưa ghi kết quả / chưa bàn giao / chưa trả — "giữ"
 * tài sản của nó: phiếu khác không trình được với tài sản đó. Không có luật này thì tài sản "hỏng, chờ xử lý" đang
 * chờ duyệt thuê sửa vẫn lập được phiếu bảo hành, một phiếu sửa khác hay đề nghị thanh lý, và phiếu duyệt sau ghi đè
 * trạng thái phiếu duyệt trước. Kiểm trạng thái từng phiếu ({@code VoucherLines.requireStatus}) không bắt được, vì
 * lúc chờ duyệt tài sản vẫn đúng trạng thái mọi phiếu kia nhận.
 *
 * <p>Phiếu nháp không giữ gì — lập nháp thoải mái, chỉ bị chặn lúc TRÌNH. Chỉ những loại phiếu làm đổi trạng thái tài
 * sản mới giữ và bị giữ ({@link #HOLDING}); kiểm kê, hao mòn, mượn phòng đi qua mọi tài sản của trường nên không
 * nằm trong danh sách, nếu không một phiếu kiểm kê đang chờ duyệt khoá cả trường.
 */
@Component
public class VoucherHolds {

    /**
     * {@code held}: cột tài sản BỊ GIỮ của dòng khi phiếu đang chạy. Mặc định chính tài sản của dòng; điều chuyển một
     * phần lô thì là lô TÁCH RA lúc duyệt (phần đang chuyển đi) — phần còn lại của lô gốc vẫn dùng được.
     */
    private record Lines(String voucherTable, String lineTable, String fk, String label, String extra, String held) {
        Lines(String voucherTable, String lineTable, String fk, String label, String extra) {
            this(voucherTable, lineTable, fk, label, extra, "l.equipment_id");
        }
    }

    /** Loại phiếu → bảng dòng của nó. {@code extra}: dòng nào thôi giữ trước khi cả phiếu xong. */
    private static final Map<String, Lines> HOLDING = new LinkedHashMap<>();

    static {
        HOLDING.put("equipment_allocations", new Lines("equipment_allocations", "equipment_allocation_lines",
                "allocation_id", "phiếu cấp phát", ""));
        HOLDING.put("equipment_transfers", new Lines("equipment_transfers", "equipment_transfer_lines",
                "transfer_id", "phiếu điều chuyển", "", "COALESCE(l.transferred_equipment_id, l.equipment_id)"));
        // Dòng đã trả thì tài sản về như trước — phiếu mượn còn chạy vì dòng khác chưa trả không giữ nó nữa.
        HOLDING.put("equipment_loans", new Lines("equipment_loans", "equipment_loan_lines", "loan_id",
                "phiếu mượn", " AND l.returned_date IS NULL"));
        HOLDING.put("damage_reports", new Lines("damage_reports", "damage_report_lines", "report_id",
                "phiếu báo hỏng", ""));
        HOLDING.put("repair_orders", new Lines("repair_orders", "repair_order_lines", "order_id",
                "phiếu sửa chữa, bảo trì", ""));
        HOLDING.put("warranty_claims", new Lines("warranty_claims", "warranty_claim_lines", "claim_id",
                "phiếu bảo hành", ""));
        HOLDING.put("maintenance_orders", new Lines("maintenance_orders", "maintenance_order_lines", "order_id",
                "phiếu bảo dưỡng", ""));
        HOLDING.put("disposals", new Lines("disposals", "disposal_lines", "disposal_id", "đề nghị ghi giảm", ""));
    }

    private static final String RUNNING = "('PENDING', 'APPROVED')";

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public VoucherHolds(JdbcTemplate jdbc, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.visible = visible;
    }

    /** Một phiếu NHÁP cùng loại đã có tài sản này — để form nhắc người lập là đang lập trùng. */
    public record Draft(Long equipmentId, Long voucherId, LocalDate createdDate) {
    }

    /**
     * Các phiếu nháp loại {@code resource} (trừ phiếu {@code exceptId} đang sửa) đã chứa tài sản trong
     * {@code equipmentIds}. Phiếu nháp không giữ tài sản ({@link #requireFree}) nên lập trùng không bị chặn — đây chỉ
     * để form nhắc "đã có phiếu nháp về thiết bị này", vd. báo hỏng một tivi hai lần vì quên phiếu nháp trước.
     */
    public List<Draft> draftsWith(String resource, Long exceptId, List<Long> equipmentIds) {
        Lines own = HOLDING.get(resource);
        if (own == null || equipmentIds.isEmpty()) {
            return List.of();
        }
        String sql = "SELECT l.equipment_id, v.id AS vid, CAST(v.created_at AS DATE) AS created"
                + " FROM %s l JOIN %s v ON v.id = l.%s JOIN equipment e ON e.id = l.equipment_id"
                        .formatted(own.lineTable(), own.voucherTable(), own.fk())
                + " WHERE v.status = 'DRAFT' AND v.id <> ?"
                + " AND l.equipment_id IN (" + String.join(",", Collections.nCopies(equipmentIds.size(), "?")) + ")"
                + visible.sqlFilter("e.school_id")
                + " ORDER BY v.created_at, v.id";
        List<Object> args = new ArrayList<>();
        args.add(exceptId == null ? -1L : exceptId);
        args.addAll(equipmentIds);
        return jdbc.queryForList(sql, args.toArray()).stream()
                .map(r -> new Draft(((Number) r.get("equipment_id")).longValue(), ((Number) r.get("vid")).longValue(),
                        ((java.sql.Date) r.get("created")).toLocalDate()))
                .toList();
    }

    /** Từ chối nếu tài sản đang bị một phiếu đang chạy giữ — cho thao tác ngoài phiếu (sửa hồ sơ thiết bị). */
    public void requireNotHeld(Long equipmentId, String what) {
        heldBy(List.of(equipmentId)).stream().findFirst().ifPresent(h -> {
            throw new FieldValidationException("room", "Thiết bị đang nằm trên %s %s (%s) — %s qua phiếu đó, không sửa trên hồ sơ"
                    .formatted(h.label(), h.code() == null ? "" : h.code(), h.pending() ? "chờ duyệt" : "đang thực hiện", what));
        });
    }

    /** Phiếu đang giữ một tài sản — cho ô chọn tài sản làm mờ dòng đó trước khi người lập tới bước trình. */
    public record Hold(Long equipmentId, String resource, String label, String code, boolean pending) {
    }

    private static String heldUnion() {
        return HOLDING.entrySet().stream()
                .map(e -> "SELECT '%s' AS res, v.id AS vid, v.code AS vcode, v.status AS vstatus, %s AS equipment_id"
                        .formatted(e.getKey(), e.getValue().held())
                        + " FROM %s l JOIN %s v ON v.id = l.%s WHERE v.status IN %s%s"
                        .formatted(e.getValue().lineTable(), e.getValue().voucherTable(), e.getValue().fk(),
                                RUNNING, e.getValue().extra()))
                .collect(Collectors.joining(" UNION ALL "));
    }

    /** Các tài sản trong {@code equipmentIds} đang bị phiếu nào giữ — chỉ tài sản của trường người gọi thấy được. */
    public List<Hold> heldBy(List<Long> equipmentIds) {
        if (equipmentIds.isEmpty()) {
            return List.of();
        }
        String sql = "SELECT h.equipment_id, h.res, h.vcode, h.vstatus FROM (" + heldUnion() + ") h"
                + " JOIN equipment e ON e.id = h.equipment_id"
                + " WHERE h.equipment_id IN (" + String.join(",", Collections.nCopies(equipmentIds.size(), "?")) + ")"
                + visible.sqlFilter("e.school_id");
        return jdbc.queryForList(sql, equipmentIds.toArray()).stream()
                .map(r -> new Hold(((Number) r.get("equipment_id")).longValue(), (String) r.get("res"),
                        HOLDING.get((String) r.get("res")).label(), (String) r.get("vcode"),
                        "PENDING".equals(r.get("vstatus"))))
                .toList();
    }

    /**
     * Từ chối trình nếu tài sản nào trên phiếu {@code (resource, id)} đang nằm trên một phiếu khác đang chạy. Loại
     * phiếu không trong {@link #HOLDING} thì bỏ qua.
     */
    public void requireFree(String resource, Long id) {
        Lines own = HOLDING.get(resource);
        if (own == null || id == null) {
            return;
        }
        // Khoá các tài sản của phiếu (theo id, để hai lần trình không khoá chéo nhau) TRƯỚC khi đọc phiếu khác: hai
        // phiếu cùng tài sản trình song song thì lần sau phải chờ lần trước commit, rồi mới thấy phiếu kia đã chờ
        // duyệt. Đọc không khoá thì cả hai vẫn thấy phía kia là nháp, và cùng giữ một tài sản.
        jdbc.queryForList("SELECT e.id FROM equipment e WHERE e.id IN (SELECT o.equipment_id FROM %s o WHERE o.%s = ?)"
                .formatted(own.lineTable(), own.fk()) + " ORDER BY e.id FOR UPDATE", Long.class, id);
        String held = heldUnion();
        String sql = "SELECT e.code AS equipment, h.res, h.vcode, h.vstatus"
                + " FROM %s o JOIN equipment e ON e.id = o.equipment_id".formatted(own.lineTable())
                + " JOIN (" + held + ") h ON h.equipment_id = o.equipment_id"
                + " WHERE o.%s = ? AND NOT (h.res = ? AND h.vid = ?)".formatted(own.fk())
                + " ORDER BY e.code LIMIT 5";
        List<Map<String, Object>> clashes = jdbc.queryForList(sql, id, resource, id);
        if (clashes.isEmpty()) {
            return;
        }
        // Gộp theo phiếu đang giữ: "Phiếu cấp phát CP-… (đang thực hiện) đang giữ A, B." — không lặp lại cả câu
        // cho từng tài sản.
        Map<String, List<String>> byVoucher = new LinkedHashMap<>();
        for (Map<String, Object> c : clashes) {
            String voucher = "%s %s (%s)".formatted(HOLDING.get((String) c.get("res")).label(),
                    c.get("vcode") == null ? "" : c.get("vcode"),
                    "PENDING".equals(c.get("vstatus")) ? "chờ duyệt" : "đang thực hiện");
            byVoucher.computeIfAbsent(voucher, k -> new ArrayList<>()).add((String) c.get("equipment"));
        }
        String detail = byVoucher.entrySet().stream()
                .map(e -> "%s đang giữ %s".formatted(capitalize(e.getKey()), String.join(", ", e.getValue())))
                .collect(Collectors.joining(". "));
        throw new FieldValidationException("lines", detail + ". Hoàn tất phiếu đó trước rồi trình lại.");
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
