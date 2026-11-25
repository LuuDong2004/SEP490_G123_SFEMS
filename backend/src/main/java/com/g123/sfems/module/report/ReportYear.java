package com.g123.sfems.module.report;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Báo cáo của một năm học ĐÃ QUA: thiết bị dựng lại tại ngày cắt (hết ngày kết thúc năm học) — cùng quy tắc với chuẩn
 * tối thiểu theo năm ({@code YearAdequacyService}, docs/du-lieu-theo-nam-hoc.md).
 *
 * <ul>
 *   <li>Có trên sổ từ ngày sớm hơn giữa ngày ghi tăng (không có thì ngày nhập vào hệ thống) và ngày tiếp nhận.</li>
 *   <li>Trạng thái, tình trạng = giá trị TRƯỚC lần đổi đầu tiên sau ngày cắt; chưa đổi lần nào thì như hiện tại.</li>
 *   <li>Chỗ để, người quản lý: như hiện tại.</li>
 * </ul>
 */
class ReportYear {

    /** Báo cáo dựng lại được theo năm học. */
    static final Set<String> REPORTS = Set.of("equipment-by-school", "equipment-by-catalog", "equipment-by-status",
            "equipment-by-condition", "equipment-list", "equipment-ledger", "adequacy");

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Ngày vào sổ của thiết bị {@code e0}. */
    private static final String SINCE = "LEAST(COALESCE((SELECT min(h.created_at) FROM equipment_history h"
            + " WHERE h.equipment_id = e0.id AND h.action = 'GHI_TANG'), e0.created_at),"
            + " COALESCE(e0.received_date::timestamptz, 'infinity'::timestamptz))";

    private final JdbcTemplate jdbc;

    ReportYear(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Năm học áp dụng: id gửi lên khi báo cáo theo năm và năm đó ĐÃ QUA; không thì trống (số hiện tại). */
    Long past(String report, Long yearId) {
        if (yearId == null || !REPORTS.contains(report)) {
            return null;
        }
        return jdbc.queryForList("SELECT id FROM school_years WHERE id = ? AND NOT is_current AND end_date < ?",
                Long.class, yearId, LocalDate.now(VN)).stream().findFirst().orElse(null);
    }

    /** Bảng thiết bị (chưa có bí danh): bảng gốc, hoặc bảng dựng lại tại ngày cắt. */
    String equipment(Long yearId) {
        if (yearId == null) {
            return "equipment";
        }
        String cut = cut(yearId);
        StringBuilder status = new StringBuilder("CASE h.from_value");
        for (AssetStatus s : AssetStatus.values()) {
            status.append(" WHEN '").append(EquipmentLifecycle.statusLabel(s)).append("' THEN '").append(s.name()).append("'");
        }
        StringBuilder condition = new StringBuilder("CASE h.from_value");
        for (EquipmentCondition c : EquipmentCondition.values()) {
            condition.append(" WHEN '").append(EquipmentLifecycle.conditionLabel(c)).append("' THEN '").append(c.name()).append("'");
        }
        return "(SELECT e0.id, e0.school_id, e0.catalog_id, e0.code, e0.name, e0.room_id, e0.manager_id, e0.unit_id,"
                + " e0.quantity, e0.received_date, e0.original_value, e0.remaining_value, e0.origin_source_id,"
                + " e0.intake_line_id, e0.asset_category, "
                + before("status", status + " END", cut) + " AS status, "
                + before("condition", condition + " END", cut) + " AS condition"
                + " FROM equipment e0 WHERE " + SINCE + " < " + cut + ")";
    }

    private static String before(String field, String value, String cut) {
        return "COALESCE((SELECT " + value + " FROM equipment_history h WHERE h.equipment_id = e0.id AND h.field = '"
                + field + "' AND h.created_at >= " + cut + " ORDER BY h.created_at, h.id LIMIT 1), e0." + field + ")";
    }

    /** Nhãn phụ đề: cuối năm học nào, và bao nhiêu thiết bị không xếp được vào năm vì thiếu ngày tiếp nhận. */
    List<String> labels(Long yearId, String scope) {
        List<String> out = new ArrayList<>();
        out.add(jdbc.queryForObject("SELECT name FROM school_years WHERE id = ?", String.class, yearId)
                + ", tính đến " + DAY.format(end(yearId)));
        long undated = jdbc.queryForObject("SELECT COUNT(*) FROM equipment e WHERE e.status <> 'LOST'"
                + " AND e.received_date IS NULL AND e.created_at >= " + cut(yearId) + scope, Long.class);
        if (undated > 0) {
            out.add("chưa tính " + undated + " thiết bị thiếu ngày tiếp nhận");
        }
        return out;
    }

    private LocalDate end(Long yearId) {
        return jdbc.queryForObject("SELECT end_date FROM school_years WHERE id = ?", LocalDate.class, yearId);
    }

    /** Ngày cắt, dạng hằng SQL — dựng từ ngày trong CSDL, không từ chữ người dùng gửi. */
    private String cut(Long yearId) {
        return "TIMESTAMPTZ '" + end(yearId).plusDays(1).atStartOfDay(VN).toOffsetDateTime() + "'";
    }
}
