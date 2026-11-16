package com.g123.sfems.module.report;

import com.g123.sfems.module.report.ReportService.Column;
import com.g123.sfems.module.report.ReportService.Params;
import com.g123.sfems.module.report.ReportService.Report;
import com.g123.sfems.module.school.facility.FacilityCounting;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Các báo cáo PHÂN TÍCH (Phase 2 của roadmap QLDA): thiết bị không còn sử dụng (UC53), nằm kho kéo dài (UC54),
 * thống kê mượn trả, xu hướng hư hỏng, thời điểm cập nhật dữ liệu của từng đơn vị (UC29), đơn vị chưa cập nhật
 * (UC26), thiết bị có dữ liệu bất thường (UC27), sổ sách thiết bị, sử dụng phòng, đánh giá chuẩn phòng bộ môn.
 *
 * <p>Tách khỏi {@link ReportService} cho file đó khỏi phình, nhưng cùng một hình báo cáo và cùng phạm vi: mọi truy
 * vấn đi qua {@link ReportService#scope} (phạm vi của người xem AND bộ lọc), nên Sở / UBND / trường thấy đúng phần
 * của mình. Không phải bean — {@link ReportService} dựng nó, để hai lớp không cần nhau qua Spring.
 */
final class AnalysisReports {

    /** Tài sản còn dùng được — cùng tập với {@code AdequacyService.USABLE}. */
    private static final String USABLE = " ('IN_STOCK', 'IN_USE', 'BORROWED', 'MAINTAINING') ";
    private static final String LOCAL_DATE = " AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";

    private final JdbcTemplate jdbc;
    private final ReportService reports;

    AnalysisReports(JdbcTemplate jdbc, ReportService reports) {
        this.jdbc = jdbc;
        this.reports = reports;
    }

    // ------------------------------------------------------------------ UC53: không còn sử dụng

    /**
     * Tài sản còn trên sổ mà KHÔNG CÒN DÙNG ĐƯỢC: hỏng chờ xử lý, tình trạng "hỏng" / "không sử dụng được", hoặc đã
     * có đề nghị thanh lý / tiêu huỷ. Đang sửa, đang bảo hành không tính — còn đang cứu. Cột "Lý do" nói vì sao nó
     * nằm trong danh sách, để người đọc biết bước kế tiếp (lập đề nghị thanh lý hay đợi duyệt).
     */
    Report unused(Params p) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT e.id AS equipment_id, s.name AS school, e.code, e.name,"
                + " c.name AS catalog, r.name AS room, " + ReportService.statusLabel("e.status") + " AS status, "
                + ReportService.conditionLabel("e.condition") + " AS condition,"
                + " CASE WHEN e.status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')"
                + "        THEN 'Đã duyệt thanh lý / tiêu huỷ, chờ thực hiện'"
                + "      WHEN e.status = 'UNREPAIRABLE'"
                + "        THEN 'Hỏng, đã kết luận không sửa được'"
                + "      WHEN e.status = 'BROKEN' THEN 'Hỏng, chờ xử lý'"
                + "      ELSE 'Tình trạng ghi: hỏng' END AS reason,"
                + " e.received_date, e.original_value, e.remaining_value"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
                + " LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id LEFT JOIN rooms r ON r.id = e.room_id"
                + " WHERE e.status NOT IN" + ReportService.OFF_BOOK
                + " AND (e.status IN ('BROKEN', 'UNREPAIRABLE', 'PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')"
                + "      OR (e.status NOT IN ('REPAIRING', 'WARRANTY') AND e.condition = 'HONG'))"
                + reports.assets("e", p) + " ORDER BY s.name, e.code LIMIT " + ReportService.LIST_LIMIT);
        return new Report("unused-equipment", "Thiết bị không còn sử dụng", reports.subtitle(p, null),
                List.of(col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("catalog", "DM thiết bị", "text"),
                        col("room", "Chỗ để", "text"), col("status", "Trạng thái", "text"),
                        col("condition", "Tình trạng", "text"), col("reason", "Lý do", "text"),
                        col("received_date", "Ngày tiếp nhận", "date"),
                        col("original_value", "Nguyên giá (đ)", "money"),
                        col("remaining_value", "Giá trị còn lại (đ)", "money")),
                rows);
    }

    // ------------------------------------------------------------------ UC54: nằm kho kéo dài

    /**
     * Tài sản đang trong kho mà lâu không được dùng: tính từ lần cuối có lịch sử SỬ DỤNG (cấp phát, mượn, trả,
     * chuyển, sửa, bảo trì, báo hỏng, tiêu hao — {@link ReportService#USAGE_ACTIONS}), chưa từng dùng thì từ ngày
     * tiếp nhận. Ngưỡng là ô chọn của báo cáo (3 tháng / 6 tháng / 1 năm).
     */
    Report idle(Params p, int days) {
        String since = "COALESCE((u.last_used" + LOCAL_DATE + ", e.received_date, (e.created_at" + LOCAL_DATE + ")";
        List<Map<String, Object>> rows = jdbc.queryForList("WITH u AS (SELECT h.equipment_id, MAX(h.created_at)"
                + " AS last_used FROM equipment_history h WHERE h.action IN" + ReportService.USAGE_ACTIONS
                + " GROUP BY h.equipment_id)"
                + " SELECT e.id AS equipment_id, s.name AS school, e.code, e.name, c.name AS catalog, r.name AS room, st.name AS manager,"
                + " e.received_date, (u.last_used" + LOCAL_DATE + " AS last_used,"
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
                        col("received_date", "Ngày tiếp nhận", "date"), col("last_used", "Lần dùng gần nhất", "date"),
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

    // ------------------------------------------------------------------ thống kê mượn trả

    /**
     * Một chiều gộp của báo cáo mượn trả, viết cho HAI bảng nguồn (phiếu mượn thiết bị và lượt mượn phòng, đều bí
     * danh {@code x}): nhãn, khoá nhóm (để bấm một dòng xem các phiếu của nó), JOIN và cột người mượn.
     */
    private record LoanGroup(String header, String label, String code, String key, String loanJoins,
            String bookingJoins, String loanKey, String bookingKey) {

        /** Biểu thức khoá nhóm cho bảng phiếu mượn (true) hoặc lượt mượn phòng (false). */
        String keyOf(boolean loan) {
            return "COALESCE(CAST(" + (loan ? loanKey : bookingKey) + " AS text), '-')";
        }

        String joins(boolean loan) {
            return loan ? loanJoins : bookingJoins;
        }
    }

    private static LoanGroup loanGroup(String group) {
        return switch (group) {
            case "purpose" -> new LoanGroup("Mục đích", purposeLabel("x.purpose_type"), null, null, " ", " ",
                    "x.purpose_type", "x.purpose_type");
            case "subject" -> new LoanGroup("Môn học", "COALESCE(sj.name, 'Không gắn môn')", null, null,
                    " LEFT JOIN subjects sj ON sj.id = x.subject_id ", " LEFT JOIN subjects sj ON sj.id = x.subject_id ",
                    "x.subject_id", "x.subject_id");
            // Báo cáo kinh tế - kỹ thuật nêu thống kê mượn trả theo giáo viên — người mượn thiết bị, người mượn phòng.
            case "borrower" -> new LoanGroup("Người mượn", "COALESCE(st.name, 'Chưa ghi người mượn')", null, null,
                    " LEFT JOIN staff st ON st.id = x.borrower_id ", " LEFT JOIN staff st ON st.id = x.requester_id ",
                    "x.borrower_id", "x.requester_id");
            default -> {
                ReportService.Dim d = ReportService.dim(group);
                String key = switch (group) {
                    case "body" -> "dob.id";
                    case "level" -> "lv.id";
                    default -> "s.id";
                };
                yield new LoanGroup(d.header(), d.label(), d.code(), key, d.joins(), d.joins(), key, key);
            }
        };
    }

    /**
     * Mượn trả trong kỳ: số phiếu, lượt thiết bị, đã trả / chưa trả, quá hạn, trả hỏng, trả mất, số người mượn, và
     * lượt mượn theo phòng — gộp theo đơn vị, địa bàn, cấp học, MỤC ĐÍCH, MÔN HỌC hoặc NGƯỜI MƯỢN.
     *
     * <p>"Người mượn" là số NGƯỜI khác nhau (cả mượn thiết bị lẫn mượn phòng), nên dòng Tổng không cộng cột đó mà
     * lấy số người khác nhau của cả kỳ ({@code totals}). Nhóm "Chưa phân loại" / "Không gắn môn" / "Chưa
     * ghi người mượn" đứng cuối bảng. Mỗi dòng mang khoá nhóm ẩn {@code group_key} để mở danh sách phiếu
     * của nhóm ({@link #loanRows}).
     */
    Report loans(Params p, String group, LocalDate from, LocalDate to, String period) {
        LoanGroup g = loanGroup(group);
        String select = g.label() + " AS name" + (g.code() == null ? "" : ", " + g.code() + " AS code");
        String f = from.toString();
        String t = to.toString();
        String scopeLoan = reports.scope("x.school_id", p);
        List<Map<String, Object>> loanRows = jdbc.queryForList("SELECT " + select + ", " + g.keyOf(true)
                + " AS group_key, COUNT(DISTINCT x.id) AS loans, COUNT(ll.id) AS items,"
                + " COUNT(ll.id) FILTER (WHERE ll.return_outcome IS NOT NULL) AS returned,"
                + " COUNT(ll.id) FILTER (WHERE ll.id IS NOT NULL AND ll.return_outcome IS NULL) AS open,"
                + " COUNT(DISTINCT x.id) FILTER (WHERE x.status = 'APPROVED' AND x.due_date < CURRENT_DATE) AS overdue,"
                + " COUNT(ll.id) FILTER (WHERE ll.return_outcome = 'DAMAGED') AS damaged,"
                + " COUNT(ll.id) FILTER (WHERE ll.return_outcome = 'LOST') AS lost"
                + " FROM equipment_loans x JOIN schools s ON s.id = x.school_id" + g.joins(true)
                + " LEFT JOIN equipment_loan_lines ll ON ll.loan_id = x.id"
                + " WHERE x.status NOT IN" + ReportService.NOT_LIVE + " AND x.loan_date BETWEEN ?::date AND ?::date"
                + scopeLoan + " GROUP BY 1" + (g.code() == null ? "" : ", 2") + ", " + (g.code() == null ? "2" : "3"),
                f, t);
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Map<String, Object> r : loanRows) {
            byKey.put(String.valueOf(r.get("group_key")), new LinkedHashMap<>(r));
        }
        jdbc.queryForList("SELECT " + select + ", " + g.keyOf(false) + " AS group_key, COUNT(x.id) AS n"
                + " FROM room_bookings x JOIN schools s ON s.id = x.school_id" + g.joins(false)
                + " WHERE x.status NOT IN" + ReportService.NOT_LIVE + " AND x.booking_date BETWEEN ?::date AND ?::date"
                + scopeLoan + " GROUP BY 1" + (g.code() == null ? "" : ", 2") + ", " + (g.code() == null ? "2" : "3"),
                f, t).forEach(b -> {
                    Map<String, Object> row = byKey.computeIfAbsent(String.valueOf(b.get("group_key")), k -> {
                        // Nhóm chỉ có mượn phòng (không có phiếu mượn thiết bị nào) vẫn phải hiện.
                        Map<String, Object> blank = new LinkedHashMap<>();
                        blank.put("name", b.get("name"));
                        if (b.get("code") != null) {
                            blank.put("code", b.get("code"));
                        }
                        blank.put("group_key", k);
                        for (String c : List.of("loans", "items", "returned", "open", "overdue", "damaged", "lost")) {
                            blank.put(c, 0L);
                        }
                        return blank;
                    });
                    row.put("bookings", b.get("n"));
                });
        // Số người mượn khác nhau: theo nhóm và cả kỳ (GROUPING SETS — dòng khoá rỗng là cả kỳ).
        Map<String, Object> people = new LinkedHashMap<>();
        jdbc.queryForList("SELECT k, COUNT(DISTINCT person) AS n FROM ("
                + " SELECT " + g.keyOf(true) + " AS k, x.borrower_id AS person FROM equipment_loans x"
                + " JOIN schools s ON s.id = x.school_id" + g.joins(true)
                + " WHERE x.status NOT IN" + ReportService.NOT_LIVE + " AND x.loan_date BETWEEN ?::date AND ?::date"
                + scopeLoan
                + " UNION ALL SELECT " + g.keyOf(false) + ", x.requester_id FROM room_bookings x"
                + " JOIN schools s ON s.id = x.school_id" + g.joins(false)
                + " WHERE x.status NOT IN" + ReportService.NOT_LIVE + " AND x.booking_date BETWEEN ?::date AND ?::date"
                + scopeLoan + ") t GROUP BY GROUPING SETS ((k), ())", f, t, f, t)
                .forEach(r -> people.put(r.get("k") == null ? "" : String.valueOf(r.get("k")), r.get("n")));
        List<Map<String, Object>> rows = new ArrayList<>(byKey.values());
        long total = 0;
        for (Map<String, Object> r : rows) {
            r.putIfAbsent("bookings", 0L);
            r.put("borrowers", people.getOrDefault(String.valueOf(r.get("group_key")), 0L));
            total += num(r.get("loans")) + num(r.get("bookings"));
        }
        for (Map<String, Object> r : rows) {
            long n = num(r.get("loans")) + num(r.get("bookings"));
            // Phần của nhóm trong mọi lượt mượn (phiếu mượn thiết bị + lượt mượn phòng) của kỳ.
            r.put("share", total == 0 ? 0 : Math.round(n * 1000.0 / total) / 10.0);
        }
        rows.sort((a, b) -> {
            int u = Boolean.compare(unclassified(a), unclassified(b));
            if (u != 0) {
                return u;
            }
            int c = Long.compare(num(b.get("loans")) + num(b.get("bookings")), num(a.get("loans")) + num(a.get("bookings")));
            return c != 0 ? c : String.valueOf(a.get("name")).compareTo(String.valueOf(b.get("name")));
        });
        List<Column> columns = new ArrayList<>();
        if (g.code() != null) {
            columns.add(col("code", "Mã trường", "text"));
        }
        columns.add(col("name", g.header(), "text"));
        columns.addAll(List.of(col("loans", "Phiếu mượn", "number"), col("items", "Lượt thiết bị", "number"),
                col("returned", "Đã trả", "number"), col("open", "Chưa trả", "number"),
                col("overdue", "Chưa trả quá hạn", "number"), col("damaged", "Trả hỏng", "number"),
                col("lost", "Báo mất", "number"), col("borrowers", "Người mượn", "number"),
                col("bookings", "Lượt mượn theo phòng", "number"),
                col("share", "Tỷ lệ lượt mượn (%)", "number")));
        if ("borrower".equals(group)) {
            // Mỗi dòng là một người: cột "Người mượn" (đếm người) luôn là 1 và trùng tên với cột nhóm.
            columns.removeIf(c -> c.key().equals("borrowers"));
        }
        String title = switch (group) {
            case "purpose" -> "theo mục đích";
            case "subject" -> "theo môn học";
            case "borrower" -> "theo người mượn";
            default -> ReportService.groupTitle(group);
        };
        return new Report("loans", "Thống kê mượn trả " + title, reports.subtitle(p, period), columns, rows,
                Map.of("borrowers", people.getOrDefault("", 0L), "share", total == 0 ? 0 : 100));
    }

    /**
     * Các phiếu của MỘT dòng báo cáo mượn trả: phiếu mượn thiết bị và lượt mượn phòng trong kỳ thuộc
     * nhóm có khoá {@code key} (giá trị {@code group_key} của dòng đó), trong phạm vi người xem.
     */
    Report loanRows(Params p, String group, String key, LocalDate from, LocalDate to, String period) {
        LoanGroup g = loanGroup(group);
        String f = from.toString();
        String t = to.toString();
        String scope = reports.scope("x.school_id", p);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM ("
                + " SELECT x.id AS loan_id, NULL::bigint AS booking_id, 'Mượn thiết bị' AS kind, x.code,"
                + " x.loan_date AS day, s.name AS school, bw.name AS person, " + purposeLabel("x.purpose_type")
                + " AS purpose, sj2.name AS subject,"
                + " (SELECT COUNT(*) FROM equipment_loan_lines l WHERE l.loan_id = x.id) AS items,"
                + " CASE x.status WHEN 'COMPLETED' THEN 'Đã trả' WHEN 'PENDING' THEN 'Chờ duyệt'"
                + " ELSE CASE WHEN x.due_date < CURRENT_DATE THEN 'Chưa trả quá hạn' ELSE 'Đang mượn' END END AS state"
                + " FROM equipment_loans x JOIN schools s ON s.id = x.school_id" + g.joins(true)
                + " LEFT JOIN staff bw ON bw.id = x.borrower_id LEFT JOIN subjects sj2 ON sj2.id = x.subject_id"
                + " WHERE x.status NOT IN" + ReportService.NOT_LIVE + " AND x.loan_date BETWEEN ?::date AND ?::date"
                + scope + " AND " + g.keyOf(true) + " = ?"
                + " UNION ALL SELECT NULL, x.id, 'Mượn phòng', x.code, x.booking_date, s.name, bw.name, "
                + purposeLabel("x.purpose_type") + ", sj2.name, NULL,"
                + " CASE WHEN x.status = 'COMPLETED' THEN 'Đã trả phòng' ELSE 'Đã ghi nhận' END"
                + " FROM room_bookings x JOIN schools s ON s.id = x.school_id" + g.joins(false)
                + " LEFT JOIN staff bw ON bw.id = x.requester_id LEFT JOIN subjects sj2 ON sj2.id = x.subject_id"
                + " WHERE x.status NOT IN" + ReportService.NOT_LIVE + " AND x.booking_date BETWEEN ?::date AND ?::date"
                + scope + " AND " + g.keyOf(false) + " = ?"
                + ") v ORDER BY day DESC, code", f, t, key, f, t, key);
        return new Report("loans", "Các phiếu mượn", reports.subtitle(p, period),
                List.of(col("code", "Số phiếu", "text"), col("kind", "Loại", "text"), col("day", "Ngày mượn", "date"),
                        col("school", "Trường", "text"), col("person", "Người mượn", "text"),
                        col("purpose", "Mục đích", "text"), col("subject", "Môn học", "text"),
                        col("items", "Số thiết bị", "number"), col("state", "Tình trạng", "text")),
                rows);
    }

    private static boolean unclassified(Map<String, Object> row) {
        return "-".equals(row.get("group_key"));
    }

    private static long num(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    private static String purposeLabel(String column) {
        return "CASE " + column + " WHEN 'THEORY' THEN 'Tiết học lý thuyết' WHEN 'PRACTICE' THEN 'Tiết thực hành'"
                + " WHEN 'EXTRACURRICULAR' THEN 'Hoạt động ngoại khoá, CLB'"
                + " WHEN 'PROFESSIONAL' THEN 'Sinh hoạt chuyên môn' WHEN 'TRAINING' THEN 'Bồi dưỡng, tập huấn'"
                + " WHEN 'OTHER' THEN 'Khác' ELSE 'Chưa phân loại' END";
    }

    // ------------------------------------------------------------------ xu hướng hư hỏng

    /**
     * Thiết bị nào hay hỏng: số lượt báo hỏng trong kỳ so với kỳ liền trước cùng độ dài, số tài sản bị báo hỏng
     * và tỷ lệ trên số tài sản của thiết bị đó đang trên sổ. Kỳ dài 3 tháng thì "kỳ trước" là 3 tháng ngay trước đó.
     */
    Report damageTrends(Params p, LocalDate from, LocalDate to, String period) {
        long length = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate prevFrom = from.minusDays(length);
        LocalDate prevTo = from.minusDays(1);
        String cur = "d.report_date BETWEEN '" + from + "'::date AND '" + to + "'::date";
        String prev = "d.report_date BETWEEN '" + prevFrom + "'::date AND '" + prevTo + "'::date";
        // Nhiều trường: thiết bị ngoài danh mục gộp một dòng "Khác" (khoá nhóm 0) — xem ReportService.otherCatalog.
        String other = reports.otherCatalog("c", p);
        String otherBook = reports.otherCatalog("xc", p);
        List<Map<String, Object>> rows = jdbc.queryForList("WITH book AS ("
                + " SELECT CASE WHEN " + otherBook + " THEN 0 ELSE xc.id END AS gk, COUNT(*) AS n"
                + " FROM equipment x JOIN equipment_catalogs xc ON xc.id = x.catalog_id"
                + " WHERE x.status NOT IN" + ReportService.OFF_BOOK + reports.scope("x.school_id", p) + " GROUP BY 1),"
                + " agg AS (SELECT CASE WHEN " + other + " THEN 0 ELSE c.id END AS gk,"
                + " CASE WHEN " + other + " THEN NULL ELSE c.code END AS code,"
                + " CASE WHEN " + other + " THEN '" + ReportService.OTHER_LABEL + "' ELSE COALESCE(c.name, e.name) END AS name,"
                + " CASE WHEN " + other + " THEN '—' ELSE COALESCE(et.name, 'Chưa phân loại') END AS type,"
                + " COUNT(dl.id) FILTER (WHERE " + cur + ") AS current,"
                + " COUNT(dl.id) FILTER (WHERE " + prev + ") AS previous,"
                + " COUNT(dl.id) FILTER (WHERE " + cur + ") - COUNT(dl.id) FILTER (WHERE " + prev + ") AS change,"
                + " COUNT(DISTINCT dl.equipment_id) FILTER (WHERE " + cur + ") AS assets,"
                + " COUNT(DISTINCT d.school_id) FILTER (WHERE " + cur + ") AS schools"
                + " FROM damage_report_lines dl JOIN damage_reports d ON d.id = dl.report_id"
                + " JOIN equipment e ON e.id = dl.equipment_id"
                + " LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id"
                + " LEFT JOIN equipment_types et ON et.id = c.equipment_type_id"
                + " WHERE d.status NOT IN" + ReportService.NOT_LIVE + " AND (" + cur + " OR " + prev + ")"
                + reports.scope("d.school_id", p)
                + " GROUP BY 1, 2, 3, 4)"
                + " SELECT agg.code, agg.name, agg.type, agg.current, agg.previous, agg.change, agg.assets, agg.schools,"
                + " COALESCE(book.n, 0) AS on_book FROM agg LEFT JOIN book ON book.gk = agg.gk"
                + " ORDER BY agg.current DESC, agg.change DESC, agg.name");
        for (Map<String, Object> row : rows) {
            long assets = ((Number) row.get("assets")).longValue();
            long onBook = ((Number) row.get("on_book")).longValue();
            row.put("rate", onBook == 0 ? null : Math.round(1000.0 * assets / onBook) / 10.0);
        }
        return new Report("damage-trends", "Xu hướng hư hỏng theo thiết bị",
                reports.subtitle(p, period + " (so với " + vn(prevFrom) + " – " + vn(prevTo) + ")"),
                List.of(col("code", "Mã DM thiết bị", "text"), col("name", "Thiết bị", "text"), col("type", "Loại", "text"),
                        col("current", "Lượt báo hỏng kỳ này", "number"), col("previous", "Kỳ trước", "number"),
                        col("change", "Tăng (+) / giảm (−)", "number"), col("assets", "Thiết bị bị báo hỏng", "number"),
                        col("on_book", "Thiết bị trong hệ thống", "number"), col("rate", "Tỷ lệ hỏng (%)", "number"),
                        col("schools", "Số trường", "number")),
                rows);
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
     * nguyên giá, nguyên giá ≤ 0, ngày tiếp nhận ở tương lai, trạng thái không khớp chỗ để hoặc tình trạng, số lượng
     * 0 mà chưa ghi dùng hết, bảo hành hết trước khi nhận, trùng số serial. Một tài sản có thể hiện nhiều dòng.
     */
    Report anomalies(Params p) {
        String base = "SELECT e.id AS equipment_id, s.name AS school, e.code, e.name, %s AS issue, %s AS detail"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
                + " LEFT JOIN rooms r ON r.id = e.room_id LEFT JOIN room_types rt ON rt.id = r.room_type_id"
                + " WHERE e.status NOT IN" + ReportService.OFF_BOOK + reports.assets("e", p) + " AND (%s)";
        String money = "to_char(%s, 'FM999G999G999G990')";
        List<String> checks = List.of(
                base.formatted("'Giá trị còn lại lớn hơn nguyên giá'",
                        "'Còn lại ' || " + money.formatted("e.remaining_value") + " || ' > nguyên giá ' || "
                                + money.formatted("e.original_value"),
                        "e.remaining_value > e.original_value"),
                base.formatted("'Nguyên giá bằng 0 hoặc âm'", money.formatted("e.original_value"), "e.original_value <= 0"),
                base.formatted("'Ngày tiếp nhận ở tương lai'", "to_char(e.received_date, 'DD/MM/YYYY')",
                        "e.received_date > CURRENT_DATE"),
                base.formatted("'Đang sử dụng nhưng chưa xếp chỗ'", "''", "e.status = 'IN_USE' AND e.room_id IS NULL"),
                base.formatted("'Đang sử dụng nhưng nằm ở kho'", "r.name", "e.status = 'IN_USE' AND rt.code = 'KHO'"),
                base.formatted("'Trong kho nhưng đặt ở phòng không phải kho'", "r.name",
                        "e.status = 'IN_STOCK' AND r.id IS NOT NULL AND COALESCE(rt.code, '') <> 'KHO'"),
                base.formatted("'Tình trạng hỏng nhưng vẫn ghi đang dùng / trong kho'",
                        ReportService.conditionLabel("e.condition"),
                        "e.status IN ('IN_STOCK', 'IN_USE') AND e.condition = 'HONG'"),
                base.formatted("'Số lượng bằng 0 nhưng chưa ghi dùng hết'", "e.quantity::text", "e.quantity <= 0"),
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
     * Sổ sách thiết bị: mỗi tài sản còn trên sổ một dòng — chứng từ ghi tăng, ngày nhận, số lượng, nguyên giá, hao
     * mòn, còn lại, chỗ để, người quản lý. Phân loại tài sản lấy của tài sản, chưa khai thì của thiết bị trong danh
     * mục (cùng luật với {@code EquipmentService}).
     */
    Report ledger(Params p, String choice) {
        String[] ledger = LEDGERS.getOrDefault(choice, LEDGERS.get("all"));
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM (SELECT e.id AS equipment_id, s.name AS school, e.code, e.name,"
                + " c.name AS catalog, u.name AS unit, e.quantity, ei.code AS voucher, e.received_date,"
                + " e.original_value, e.original_value - COALESCE(e.remaining_value, e.original_value) AS depreciation,"
                + " COALESCE(e.remaining_value, e.original_value) AS remaining_value, r.name AS room, st.name AS manager,"
                + " " + ReportService.statusLabel("e.status") + " AS status,"
                + " COALESCE(e.asset_category, c.asset_category) AS cat"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
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
                        col("depreciation", "Hao mòn luỹ kế (đ)", "money"),
                        col("remaining_value", "Giá trị còn lại (đ)", "money"), col("room", "Chỗ để", "text"),
                        col("manager", "Người quản lý", "text"), col("status", "Trạng thái", "text")),
                rows);
    }

    // ------------------------------------------------------------------ CSVC: sử dụng phòng, chuẩn phòng bộ môn

    /**
     * Mỗi phòng cho mượn được (hoặc có lượt mượn trong kỳ): số lượt mượn, số tiết đã dùng (buổi sáng / chiều = 5
     * tiết, cả ngày = 10, tối không tính tiết), tách tiết thực hành / lý thuyết / khác, lần mượn gần nhất, số lần trả
     * phòng có vấn đề.
     */
    Report roomUsage(Params p, LocalDate from, LocalDate to, String period) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT r.id AS room_id, s.name AS school, b.name AS building,"
                + " r.name AS room, COALESCE(rt.name, 'Chưa phân loại') AS room_type, sj.name AS subject, COUNT(bk.id) AS bookings,"
                + " COALESCE(SUM(CASE WHEN bk.booking_mode = 'THEO_TIET'"
                + "   THEN COALESCE(bk.period_to, bk.period_from) - bk.period_from + 1"
                + "   WHEN bk.session IN ('SANG', 'CHIEU') THEN 5 WHEN bk.session = 'CA_NGAY' THEN 10 ELSE 0 END), 0) AS periods,"
                + " COUNT(bk.id) FILTER (WHERE bk.purpose_type = 'PRACTICE') AS practice,"
                + " COUNT(bk.id) FILTER (WHERE bk.purpose_type = 'THEORY') AS theory,"
                + " COUNT(bk.id) FILTER (WHERE bk.id IS NOT NULL AND (bk.purpose_type IS NULL"
                + "   OR bk.purpose_type NOT IN ('PRACTICE', 'THEORY'))) AS other,"
                + " MAX(bk.booking_date) AS last_date, COUNT(bk.id) FILTER (WHERE bk.room_condition = 'ISSUE') AS issues"
                + " FROM rooms r JOIN schools s ON s.id = r.school_id LEFT JOIN buildings b ON b.id = r.building_id"
                + " LEFT JOIN room_types rt ON rt.id = r.room_type_id LEFT JOIN subjects sj ON sj.id = r.subject_id"
                // Lượt trong kỳ: ngày mượn trong kỳ, HOẶC trả trong kỳ — phiếu ghi trước cho ngày sau mà đã trả (kể cả trả
                // có vấn đề) không bị rơi khỏi báo cáo.
                + " LEFT JOIN room_bookings bk ON bk.room_id = r.id AND bk.status NOT IN" + ReportService.NOT_LIVE
                + "   AND (bk.booking_date BETWEEN ?::date AND ?::date OR bk.returned_at::date BETWEEN ?::date AND ?::date)"
                // Chỉ phòng bộ môn, phòng chức năng: loại CSVC có cờ functional (192);
                // phòng chưa phân loại thì tính khi có gắn môn. Phòng học thường (kể cả có ghi môn), kho, thư viện thì không.
                + " WHERE (rt.functional OR (r.room_type_id IS NULL AND r.subject_id IS NOT NULL))"
                + reports.scope("r.school_id", p)
                + " GROUP BY s.name, b.name, r.id, r.name, rt.name, sj.name"
                + " ORDER BY bookings DESC, periods DESC, s.name, r.name",
                from.toString(), to.toString(), from.toString(), to.toString());
        return new Report("room-usage", "Sử dụng phòng bộ môn, phòng chức năng", reports.subtitle(p, period),
                List.of(col("school", "Trường", "text"), col("building", "Khối nhà", "text"), col("room", "Phòng", "text"),
                        col("room_type", "Loại phòng", "text"), col("subject", "Môn", "text"),
                        col("bookings", "Lượt mượn", "number"), col("periods", "Số tiết", "number"),
                        col("practice", "Lượt thực hành", "number"), col("theory", "Lượt lý thuyết", "number"),
                        col("other", "Lượt khác", "number"), col("last_date", "Lần mượn gần nhất", "date"),
                        col("issues", "Trả có vấn đề", "number")),
                rows);
    }

    /**
     * Đánh giá chuẩn từng phòng bộ môn (phòng có gắn môn): các dòng định mức "tính cho 01 phòng học bộ môn" của bộ
     * tiêu chuẩn đang áp dụng cho cấp học của trường, cùng môn với phòng — mỗi thiết bị lấy số đòi NHIỀU NHẤT (như
     * {@code AdequacyService}) — so với số đang đặt TẠI PHÒNG đó và còn dùng được. Đủ mọi thiết bị là "Đạt".
     * Dòng tự chọn và dòng phụ lục không ghi số không tính. Chỉ phòng được tính theo {@link FacilityCounting} (còn
     * dùng, không ngừng sử dụng, đã xác nhận).
     */
    Report roomStandard(Params p) {
        List<Map<String, Object>> rows = jdbc.queryForList("WITH need AS ("
                + "  SELECT r.id AS room_id, n.catalog_id, MAX(n.min_quantity) AS required"
                + "  FROM rooms r JOIN schools s ON s.id = r.school_id"
                + "  JOIN equipment_standards sd ON sd.education_level_id = s.education_level_id AND sd.status = 'ACTIVE'"
                + "  JOIN equipment_norms n ON n.standard_id = sd.id AND n.norm_basis = 'PER_ROOM'"
                + "   AND n.subject_id = r.subject_id AND NOT n.optional AND n.min_quantity IS NOT NULL"
                + "   AND n.catalog_id IS NOT NULL"
                + "  WHERE" + FacilityCounting.COUNTED_ROOM + "AND r.subject_id IS NOT NULL"
                + reports.scope("r.school_id", p)
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
                + reports.scope("r.school_id", p)
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
