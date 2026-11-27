package com.g123.sfems.module.report;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.report.ReportService.Column;
import com.g123.sfems.module.report.ReportService.Params;
import com.g123.sfems.module.report.ReportService.Report;
import com.g123.sfems.module.school.facility.FacilityCounting;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Các báo cáo PHÂN TÍCH (Phase 2 của roadmap QLDA): thiết bị không còn sử dụng (UC53), nằm kho kéo dài (UC54),
 * thời điểm cập nhật dữ liệu của từng đơn vị (UC29), đơn vị chưa cập nhật (UC26), thiết bị có dữ liệu bất thường
 * (UC27), sổ sách thiết bị, đánh giá chuẩn phòng bộ môn.
 *
 * <p>Tách khỏi {@link ReportService} cho file đó khỏi phình, nhưng cùng một hình báo cáo và cùng phạm vi: mọi truy
 * vấn đi qua {@link ReportService#scope} (phạm vi của người xem AND bộ lọc), nên Sở / trường thấy đúng phần
 * của mình. Không phải bean — {@link ReportService} dựng nó, để hai lớp không cần nhau qua Spring.
 */
final class AnalysisReports {

    /** Tài sản còn dùng được — cùng tập với {@code AdequacyService.USABLE}. */
    private static final String USABLE = " ('IN_STOCK', 'IN_USE') ";
    private static final String LOCAL_DATE = " AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";

    private final JdbcTemplate jdbc;
    private final ReportService reports;

    AnalysisReports(JdbcTemplate jdbc, ReportService reports) {
        this.jdbc = jdbc;
        this.reports = reports;
    }

    // ------------------------------------------------------------------ UC54: nằm kho kéo dài

    /**
     * Tài sản đang trong kho mà lâu không được dùng: tính từ lần cuối đổi trạng thái (lịch sử thiết bị, tức lúc về
     * kho), chưa đổi lần nào thì từ ngày tiếp nhận. Ngưỡng là ô chọn của báo cáo (3 tháng / 6 tháng / 1 năm).
     */
    Report idle(Params p, int days) {
        String since = "COALESCE((u.changed_at" + LOCAL_DATE + ", e.received_date, (e.created_at" + LOCAL_DATE + ")";
        List<Map<String, Object>> rows = jdbc.queryForList("WITH u AS (SELECT h.equipment_id, MAX(h.created_at)"
                + " AS changed_at FROM equipment_history h WHERE h.field = 'status' GROUP BY h.equipment_id)"
                + " SELECT e.id AS equipment_id, s.name AS school, e.code, e.name, c.name AS catalog, r.name AS room, st.name AS manager,"
                + " e.received_date, " + since + " AS in_stock_since,"
                + " (CURRENT_DATE - " + since + ") AS idle_days, e.quantity, e.original_value"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
                + " LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id LEFT JOIN rooms r ON r.id = e.room_id"
                + " LEFT JOIN staff st ON st.id = e.manager_id LEFT JOIN u ON u.equipment_id = e.id"
                + " WHERE e.status = 'IN_STOCK' AND CURRENT_DATE - " + since + " >= ?"
                + reports.assets("e", p) + " ORDER BY idle_days DESC, s.name, e.code LIMIT "
                + ReportService.LIST_LIMIT, days);
        return new Report("idle-equipment", "Thiết bị nằm kho từ " + idleLabel(days) + " trở lên",
                reports.subtitle(p, null),
                List.of(col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("catalog", "DM thiết bị", "text"),
                        col("room", "Kho", "text"), col("manager", "Người quản lý", "text"),
                        col("received_date", "Ngày tiếp nhận", "date"), col("in_stock_since", "Trong kho từ ngày", "date"),
                        col("idle_days", "Số ngày nằm kho", "number"), col("quantity", "Số lượng", "number"),
                        col("original_value", "Nguyên giá (đ)", "money")),
                rows);
    }

    static String idleLabel(int days) {
        return switch (days) {
            case 90 -> "3 tháng";
            case 365 -> "1 năm";
            default -> "6 tháng";
        };
    }

    // ------------------------------------------------------------------ UC29 / UC26: cập nhật dữ liệu

    /**
     * Mỗi trường lần cuối cập nhật dữ liệu lúc nào — tài sản, phiếu, cơ sở vật chất (phòng, khối nhà, điểm trường,
     * lớp, cán bộ), và lần mới nhất trong ba thứ đó. {@code staleDays} khác null là UC26: chỉ giữ trường chưa có dữ
     * liệu nào hoặc không cập nhật từ ngần ấy ngày.
     */
    Report lastUpdate(Params p, Integer staleDays) {
        String vouchers = ReportService.voucherTables().keySet().stream()
                .map(t -> "SELECT school_id, updated_at FROM " + t)
                .collect(Collectors.joining(" UNION ALL "));
        String facilities = List.of("rooms", "buildings", "campuses", "school_classes", "staff").stream()
                .map(t -> "SELECT school_id, updated_at FROM " + t)
                .collect(Collectors.joining(" UNION ALL "));
        String sql = "WITH eq AS (SELECT school_id, MAX(updated_at) AS at, COUNT(*) AS n FROM equipment GROUP BY school_id),"
                + " v AS (SELECT school_id, MAX(updated_at) AS at FROM (" + vouchers + ") x GROUP BY school_id),"
                + " f AS (SELECT school_id, MAX(updated_at) AS at FROM (" + facilities + ") x GROUP BY school_id),"
                + " t AS (SELECT s.id, s.code, s.name, dob.name AS body, lv.name AS level, COALESCE(eq.n, 0) AS equipment,"
                + "   eq.at AS eq_at, v.at AS v_at, f.at AS f_at, GREATEST(eq.at, v.at, f.at) AS last_at"
                + "   FROM schools s LEFT JOIN departments_of_education dob ON dob.id = s.department_of_education_id"
                + "   LEFT JOIN education_levels lv ON lv.id = s.education_level_id"
                + "   LEFT JOIN eq ON eq.school_id = s.id LEFT JOIN v ON v.school_id = s.id LEFT JOIN f ON f.school_id = s.id"
                + "   WHERE s.status = 'ACTIVE'" + reports.scope("s.id", p) + ")"
                + " SELECT t.code, t.name, t.body, t.level, t.equipment, (t.eq_at" + LOCAL_DATE + " AS eq_at,"
                + " (t.v_at" + LOCAL_DATE + " AS v_at, (t.f_at" + LOCAL_DATE + " AS f_at,"
                + " (t.last_at" + LOCAL_DATE + " AS last_at, (CURRENT_DATE - (t.last_at" + LOCAL_DATE + ") AS days,"
                + " CASE WHEN t.last_at IS NULL THEN 'Chưa có dữ liệu nào' WHEN t.equipment = 0 THEN 'Chưa nhập thiết bị'"
                + "      ELSE 'Cập nhật ' || (CURRENT_DATE - (t.last_at" + LOCAL_DATE + ") || ' ngày trước' END AS note"
                + " FROM t" + (staleDays == null ? "" : " WHERE t.last_at IS NULL OR t.equipment = 0"
                + " OR t.last_at < now() - make_interval(days => " + staleDays.intValue() + ")")
                + " ORDER BY t.last_at ASC NULLS FIRST, t.name";
        List<Map<String, Object>> rows = jdbc.queryForList(sql);
        List<Column> columns = List.of(col("code", "Mã trường", "text"), col("name", "Trường", "text"),
                col("body", "Cơ quan quản lý", "text"), col("level", "Cấp học", "text"),
                col("equipment", "Số thiết bị", "number"), col("eq_at", "Thiết bị cập nhật", "date"),
                col("v_at", "Phiếu cập nhật", "date"), col("f_at", "Cơ sở vật chất, lớp, cán bộ", "date"),
                col("last_at", "Cập nhật gần nhất", "date"), col("days", "Số ngày", "number"),
                col("note", "Ghi chú", "text"));
        return staleDays == null
                ? new Report("last-update", "Thời điểm cập nhật dữ liệu gần nhất của từng đơn vị",
                        reports.subtitle(p, null), columns, rows)
                : new Report("stale-schools", "Đơn vị chưa cập nhật dữ liệu trong " + staleDays + " ngày",
                        reports.subtitle(p, null), columns, rows);
    }

    // ------------------------------------------------------------------ UC27: dữ liệu bất thường

    /**
     * Từng tài sản có dữ liệu mâu thuẫn — không phải THIẾU (đã có "Chất lượng dữ liệu"), mà SAI: còn lại lớn hơn
     * nguyên giá, nguyên giá ≤ 0, ngày tiếp nhận ở tương lai, trạng thái không khớp chỗ để, số lượng
     * không dương, bảo hành hết trước khi nhận, trùng số serial. Một tài sản có thể hiện nhiều dòng.
     */
    Report anomalies(Params p) {
        String base = "SELECT e.id AS equipment_id, s.name AS school, e.code, e.name, %s AS issue, %s AS detail"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
                + " LEFT JOIN rooms r ON r.id = e.room_id LEFT JOIN room_types rt ON rt.id = r.room_type_id"
                + " WHERE e.status NOT IN" + ReportService.OFF_BOOK + reports.assets("e", p) + " AND (%s)";
        String money = "to_char(%s, 'FM999G999G999G990')";
        List<String> checks = List.of(
                base.formatted("'Nguyên giá bằng 0 hoặc âm'", money.formatted("e.original_value"), "e.original_value <= 0"),
                base.formatted("'Ngày tiếp nhận ở tương lai'", "to_char(e.received_date, 'DD/MM/YYYY')",
                        "e.received_date > CURRENT_DATE"),
                base.formatted("'Đang sử dụng nhưng chưa xếp chỗ'", "''", "e.status = 'IN_USE' AND e.room_id IS NULL"),
                base.formatted("'Đang sử dụng nhưng nằm ở kho'", "r.name", "e.status = 'IN_USE' AND rt.system_key = 'KHO'"),
                base.formatted("'Trong kho nhưng đặt ở phòng không phải kho'", "r.name",
                        "e.status = 'IN_STOCK' AND r.id IS NOT NULL AND COALESCE(rt.system_key, '') <> 'KHO'"),
                base.formatted("'Số lượng bằng 0 hoặc âm'", "e.quantity::text", "e.quantity <= 0"),
                base.formatted("'Hết bảo hành trước ngày tiếp nhận'",
                        "to_char(e.warranty_expiry, 'DD/MM/YYYY') || ' < ' || to_char(e.received_date, 'DD/MM/YYYY')",
                        "e.warranty_expiry < e.received_date"),
                base.formatted("'Trùng số serial với thiết bị khác của trường'", "e.serial_number",
                        "e.serial_number IS NOT NULL AND btrim(e.serial_number) <> '' AND EXISTS (SELECT 1 FROM equipment o"
                                + " WHERE o.school_id = e.school_id AND o.id <> e.id AND o.serial_number = e.serial_number"
                                + " AND o.status NOT IN" + ReportService.OFF_BOOK + ")"));
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM (" + String.join(" UNION ALL ", checks)
                + ") a ORDER BY school, code, issue LIMIT " + ReportService.LIST_LIMIT);
        return new Report("data-anomalies", "Thiết bị có dữ liệu bất thường", reports.subtitle(p, null),
                List.of(col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("issue", "Bất thường", "text"),
                        col("detail", "Giá trị", "text")),
                rows);
    }

    // ------------------------------------------------------------------ sổ sách thiết bị

    /** Loại sổ: khoá (tham số {@code choice}) → nhãn và điều kiện trên phân loại tài sản. */
    static final Map<String, String[]> LEDGERS = new LinkedHashMap<>();

    static {
        LEDGERS.put("all", new String[] {"Bảng theo dõi thiết bị", "TRUE"});
        LEDGERS.put("fixed", new String[] {"Bảng theo dõi tài sản cố định", "cat = 'FIXED_ASSET'"});
        LEDGERS.put("tool", new String[] {"Bảng theo dõi công cụ, dụng cụ", "cat = 'DURABLE_TOOL'"});
        LEDGERS.put("supply", new String[] {"Bảng theo dõi vật tư, hoá chất", "cat IN ('SUPPLY', 'CHEMICAL')"});
    }

    /**
     * Sổ sách thiết bị: mỗi tài sản còn trên sổ một dòng — chứng từ ghi tăng, ngày nhận, số lượng, nguyên giá, giá trị
     * còn lại, chỗ để, người quản lý. Phân loại tài sản lấy của tài sản, chưa khai thì của thiết bị trong danh
     * mục (cùng luật với {@code EquipmentService}).
     */
    Report ledger(Params p, String choice) {
        String[] ledger = LEDGERS.getOrDefault(choice, LEDGERS.get("all"));
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM (SELECT e.id AS equipment_id, s.name AS school, e.code, e.name,"
                + " c.name AS catalog, u.name AS unit, e.quantity, ei.code AS voucher, e.received_date,"
                + " e.original_value, r.name AS room, st.name AS manager,"
                + " " + ReportService.statusLabel("e.status") + " AS status,"
                + " COALESCE(e.asset_category, c.asset_category) AS cat"
                + " FROM " + reports.equipment(p) + " e JOIN schools s ON s.id = e.school_id"
                + " LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id LEFT JOIN units u ON u.id = e.unit_id"
                + " LEFT JOIN equipment_intake_lines il ON il.id = e.intake_line_id"
                + " LEFT JOIN equipment_intakes ei ON ei.id = il.intake_id"
                + " LEFT JOIN rooms r ON r.id = e.room_id LEFT JOIN staff st ON st.id = e.manager_id"
                + " WHERE e.status NOT IN" + ReportService.OFF_BOOK + reports.assets("e", p) + ") l"
                + " WHERE " + ledger[1] + " ORDER BY school, received_date NULLS LAST, code LIMIT " + ReportService.LIST_LIMIT);
        rows.forEach(r -> r.remove("cat"));
        return new Report("equipment-ledger", ledger[0], reports.subtitle(p, null),
                List.of(col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("catalog", "DM thiết bị", "text"),
                        col("unit", "Đơn vị tính", "text"), col("quantity", "Số lượng", "number"),
                        col("voucher", "Chứng từ ghi tăng", "text"), col("received_date", "Ngày tiếp nhận", "date"),
                        col("original_value", "Nguyên giá (đ)", "money"),
                        col("room", "Chỗ để", "text"),
                        col("manager", "Người quản lý", "text"), col("status", "Trạng thái", "text")),
                rows);
    }

    // ------------------------------------------------------------------ CSVC: chuẩn phòng bộ môn

    /**
     * Đánh giá chuẩn từng phòng bộ môn (phòng có gắn môn): các dòng định mức "tính cho 01 phòng học bộ môn" của bộ
     * tiêu chuẩn đang áp dụng cho cấp học của trường, cùng môn với phòng — mỗi thiết bị lấy số đòi NHIỀU NHẤT (như
     * {@code AdequacyService}) — so với số đang đặt TẠI PHÒNG đó và còn dùng được. Đủ mọi thiết bị là "Đạt".
     * Dòng tự chọn và dòng phụ lục không ghi số không tính. Chỉ phòng được tính theo {@link FacilityCounting} (còn
     * dùng, không ngừng sử dụng, đã xác nhận).
     */
    Report roomStandard(Params p) {
        List<Map<String, Object>> rows = jdbc.queryForList("WITH need AS ("
                // "01/HS" trong phòng (PER_ROOM_STUDENT, 305): một phòng cần số lượng × ⌈45 ÷ cỡ nhóm⌉.
                + "  SELECT r.id AS room_id, n.catalog_id, MAX(CASE WHEN n.norm_basis = 'PER_ROOM_STUDENT'"
                + "   THEN CEIL(n.min_quantity * CEIL(" + NormBasis.ROOM_STUDENTS + ".0 / COALESCE(n.basis_size, 1)))"
                + "   ELSE n.min_quantity END) AS required"
                + "  FROM rooms r JOIN schools s ON s.id = r.school_id"
                + "  JOIN equipment_standards sd ON sd.education_level_id = s.education_level_id AND sd.status = 'ACTIVE'"
                + "  JOIN equipment_norms n ON n.standard_id = sd.id AND n.norm_basis IN ('PER_ROOM', 'PER_ROOM_STUDENT')"
                + "   AND n.subject_id = r.subject_id AND NOT n.optional AND n.min_quantity IS NOT NULL"
                + "   AND n.catalog_id IS NOT NULL AND" + EquipmentNorm.effectiveTodaySql("n")
                + "  WHERE" + FacilityCounting.COUNTED_ROOM + "AND r.subject_id IS NOT NULL"
                + reports.scope("r.school_id", p) + reports.campusRoom("r.id", "r.school_id", p)
                + "  GROUP BY r.id, n.catalog_id),"
                + " have AS (SELECT need.room_id, need.catalog_id, need.required,"
                + "  (SELECT COALESCE(SUM(CASE WHEN c.tracking_type = 'BULK' THEN x.quantity ELSE 1 END), 0)"
                + "   FROM equipment x JOIN equipment_catalogs c ON c.id = x.catalog_id"
                + "   WHERE x.room_id = need.room_id AND x.catalog_id = need.catalog_id AND x.status IN" + USABLE
                + "  ) AS present FROM need)"
                + " SELECT r.id AS room_id, s.name AS school, r.name AS room, COALESCE(rt.name, 'Chưa phân loại') AS room_type,"
                + " sj.name AS subject, r.area, r.capacity,"
                + " (SELECT COUNT(*) FROM equipment x WHERE x.room_id = r.id AND x.status NOT IN" + ReportService.OFF_BOOK
                + ") AS equipment, COUNT(h.catalog_id) AS norms,"
                + " COUNT(h.catalog_id) FILTER (WHERE h.present >= h.required) AS met,"
                + " COUNT(h.catalog_id) FILTER (WHERE h.present < h.required) AS short,"
                // % thiết bị đã đủ trên số thiết bị phải có theo phòng; chưa có định mức thì trống.
                + " CASE WHEN COUNT(h.catalog_id) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(h.catalog_id)"
                + "   FILTER (WHERE h.present >= h.required) / COUNT(h.catalog_id)) END AS percent,"
                + " CASE WHEN COUNT(h.catalog_id) = 0 THEN 'Chưa xác định'"
                + "      WHEN COUNT(h.catalog_id) FILTER (WHERE h.present < h.required) = 0 THEN 'Đạt'"
                + "      ELSE 'Chưa đạt' END AS verdict"
                + " FROM rooms r JOIN schools s ON s.id = r.school_id"
                + " LEFT JOIN room_types rt ON rt.id = r.room_type_id LEFT JOIN subjects sj ON sj.id = r.subject_id"
                + " LEFT JOIN have h ON h.room_id = r.id"
                + " WHERE" + FacilityCounting.COUNTED_ROOM + "AND r.subject_id IS NOT NULL"
                + reports.scope("r.school_id", p) + reports.campusRoom("r.id", "r.school_id", p)
                + " GROUP BY s.name, r.id, r.name, rt.name, sj.name, r.area, r.capacity"
                // Chưa đạt lên đầu (thiếu nhiều trước), rồi Đạt, cuối cùng phòng chưa xác định được.
                + " ORDER BY COUNT(h.catalog_id) = 0, short DESC, s.name, r.name");
        return new Report("room-standard", "Đánh giá chuẩn phòng bộ môn", reports.subtitle(p, null),
                List.of(col("school", "Trường", "text"), col("room", "Phòng", "text"),
                        col("room_type", "Loại phòng", "text"), col("subject", "Môn", "text"),
                        col("area", "Diện tích (m²)", "number"), col("capacity", "Sức chứa", "number"),
                        col("equipment", "Thiết bị trong phòng", "number"),
                        col("norms", "Thiết bị phải có theo phòng", "number"), col("met", "Đã đủ", "number"),
                        col("short", "Còn thiếu", "number"), col("percent", "% đạt", "number"),
                        col("verdict", "Kết luận", "text")),
                rows);
    }

    // ------------------------------------------------------------------ tiện ích

    private static Column col(String key, String label, String type) {
        return new Column(key, label, type);
    }

    private static String vn(LocalDate d) {
        return "%02d/%02d/%d".formatted(d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }
}
