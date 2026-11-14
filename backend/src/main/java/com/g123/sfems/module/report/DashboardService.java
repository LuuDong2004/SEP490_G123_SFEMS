package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.procurement.AdequacyService;
import com.g123.sfems.shared.cache.SharedCache;
import com.g123.sfems.shared.security.Hashes;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Bảng điều khiển theo cấp quản lý. Cùng một bộ chỉ số cho cả ba cấp, gộp trên
 * {@link VisibleSchools} — trường thấy trường mình, UBND thấy địa bàn, Sở thấy
 * toàn ngành. Cấp trên có thêm bảng "trường cần chú ý".
 *
 * <p>Mỗi lần dựng là vài chục câu gộp, và trang chủ là màn mở nhiều nhất — nên kết quả được đệm
 * {@value #TTL_MS} ms theo (cấp, tập trường thấy được, kỳ, số ngày): hai người cùng phạm vi thấy cùng một bảng,
 * số liệu chậm tối đa một phút. Lúc chưa có hoặc đã hết hạn chỉ MỘT luồng tính cho mỗi khoá, các luồng khác
 * chờ kết quả đó (không N người mở trang cùng lúc thành N lần tính). Lớp KHÔNG mang {@code @Transactional}:
 * mỗi câu mượn rồi trả kết nối ngay, nên lúc tính không giữ một kết nối suốt cả chục câu, và luồng đang chờ
 * kết quả không giữ kết nối nào.
 */
@Service
public class DashboardService {

    private static final long TTL_MS = 60_000;
    /** Vượt số khoá này thì dọn khoá đã hết hạn (không xoá sạch — xoá sạch là mọi người cùng tính lại). */
    private static final int MAX_KEYS = 5_000;

    private record Cached(Dashboard value, long at) {
        boolean fresh() {
            return System.currentTimeMillis() - at < TTL_MS;
        }
    }

    private final ConcurrentHashMap<String, CompletableFuture<Cached>> cache = new ConcurrentHashMap<>();

    public record Kpis(long schools, long equipment, java.math.BigDecimal originalValue, long inUse, long broken,
            // Tên trường JSON cũ được giữ để các màn đang dùng API không bị gãy; gồm cả chờ tiêu huỷ.
            long missing, long pendingLiquidation, long pendingVouchers, long overdueLoans, long maintenanceDue,
            int adequacyPercent, int adequacySchools) {
    }

    public record Count(String key, String label, long count) {
    }

    public record Month(String month, long intake, long allocation, long damage, long disposal) {
    }

    public record SchoolRow(Long id, String name, long equipment, long broken, long missing, long pending) {
    }

    /** Một ngày: số phiếu lập ra và số phiếu hoàn tất trong ngày đó. */
    public record Day(String date, long created, long completed) {
    }

    public record Dashboard(String level, String scope, Kpis kpis, List<Count> statuses, List<Count> pending,
            List<Month> months, List<SchoolRow> attention, String period, List<Count> vouchers, int days,
            List<Day> daily, List<Count> conditions, List<Count> waitingAt) {
    }

    /** Kỳ của ô "tình trạng xử lý phiếu": tháng này, quý này, năm nay, hoặc mọi lúc. */
    private static final Map<String, String> PERIODS = Map.of(
            "month", "DATE_TRUNC('month', CURRENT_DATE)",
            "quarter", "DATE_TRUNC('quarter', CURRENT_DATE)",
            "year", "DATE_TRUNC('year', CURRENT_DATE)",
            "all", "DATE '1900-01-01'");

    private static final Map<String, String> VOUCHER_STATUS = new java.util.LinkedHashMap<>();

    static {
        VOUCHER_STATUS.put("DRAFT", "Nháp");
        VOUCHER_STATUS.put("PENDING", "Chờ duyệt");
        VOUCHER_STATUS.put("APPROVED", "Đang thực hiện");
        VOUCHER_STATUS.put("COMPLETED", "Hoàn tất");
        VOUCHER_STATUS.put("REJECTED", "Từ chối");
        VOUCHER_STATUS.put("CANCELLED", "Đã huỷ");
    }

    private static final Map<String, String> CONDITIONS = new java.util.LinkedHashMap<>();

    static {
        CONDITIONS.put("TOT", "Tốt");
        CONDITIONS.put("TRUNG_BINH", "Trung bình");
        CONDITIONS.put("KEM", "Kém");
        CONDITIONS.put("HONG", "Hỏng");
    }

    /**
     * Mọi phiếu trong phạm vi, gộp một bảng ảo: loại, trạng thái, lúc lập, lúc xong.
     * Phiếu nhập ghi lúc xong ở {@code confirmed_at}; các phiếu khác ở {@code completed_at}.
     */
    private String allVouchers() {
        List<String> parts = new ArrayList<>();
        for (String table : ReportService.voucherTables().keySet()) {
            String done = "equipment_intakes".equals(table) ? "confirmed_at" : "completed_at";
            parts.add("SELECT '%s' AS kind, status, created_at, %s AS completed_at FROM %s WHERE TRUE%s"
                    .formatted(table, done, table, visible.sqlFilter("school_id")));
        }
        return "(" + String.join(" UNION ALL ", parts) + ") v";
    }

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;
    private final AdequacyService adequacy;
    private final ReportService reports;

    private final SharedCache shared;

    public DashboardService(JdbcTemplate jdbc, VisibleSchools visible, AdequacyService adequacy,
            ReportService reports, SharedCache shared) {
        this.shared = shared;
        this.jdbc = jdbc;
        this.visible = visible;
        this.adequacy = adequacy;
        this.reports = reports;
    }

    public Dashboard build() {
        return build("month", 7);
    }

    public Dashboard build(String period, int days) {
        String kind = PERIODS.containsKey(period) ? period : "month";
        int span = days == 30 ? 30 : 7;
        Set<Long> schools = visible.current();
        String key = visible.level() + "|" + (schools == null ? "*" : new TreeSet<>(schools).toString()) + "|"
                + kind + "|" + span;
        while (true) {
            CompletableFuture<Cached> current = cache.get(key);
            if (current != null && current.isDone() && !current.isCompletedExceptionally()
                    && current.join().fresh()) {
                return current.join().value();
            }
            if (current != null && !current.isDone()) {
                // Có luồng khác đang tính đúng khoá này: chờ nó.
                try {
                    return current.join().value();
                } catch (CompletionException ex) {
                    throw ex.getCause() instanceof RuntimeException cause ? cause : ex;
                }
            }
            CompletableFuture<Cached> mine = new CompletableFuture<>();
            boolean won = current == null ? cache.putIfAbsent(key, mine) == null : cache.replace(key, current, mine);
            if (!won) {
                continue;
            }
            try {
                // Mức 2 (Redis): node khác vừa tính đúng khoá này thì dùng lại, không chạy lại ~50 câu SQL.
                String sharedKey = "dashboard:" + Hashes.sha256(key);
                Dashboard fresh = shared.<Dashboard>get(sharedKey, shared.type(Dashboard.class)).orElse(null);
                if (fresh == null) {
                    fresh = compute(kind, span);
                    shared.put(sharedKey, fresh, Duration.ofMillis(TTL_MS));
                }
                mine.complete(new Cached(fresh, System.currentTimeMillis()));
                if (cache.size() > MAX_KEYS) {
                    cache.entrySet().removeIf(en -> en.getValue().isDone()
                            && (en.getValue().isCompletedExceptionally() || !en.getValue().join().fresh()));
                }
                return fresh;
            } catch (RuntimeException ex) {
                cache.remove(key, mine);
                mine.completeExceptionally(ex);
                throw ex;
            }
        }
    }

    private Dashboard compute(String kind, int span) {
        String since = PERIODS.get(kind);
        String eq = visible.sqlFilter("e.school_id");
        Map<String, Object> e = jdbc.queryForMap("""
                SELECT COUNT(*) FILTER (WHERE e.status NOT IN ('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED')) AS total,
                       COALESCE(SUM(e.original_value) FILTER (WHERE e.status NOT IN ('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED')), 0) AS value,
                       COUNT(*) FILTER (WHERE e.status = 'IN_USE') AS in_use,
                       COUNT(*) FILTER (WHERE e.condition = 'HONG' OR e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY')) AS broken,
                       COUNT(*) FILTER (WHERE e.status = 'MISSING' OR EXISTS (
                           SELECT 1 FROM disposal_lines dl JOIN disposals d ON d.id = dl.disposal_id
                           WHERE dl.equipment_id = e.id AND d.kind = 'LOSS' AND d.status IN ('DRAFT', 'PENDING'))) AS missing,
                       COUNT(*) FILTER (WHERE e.status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')) AS pending_liq
                FROM equipment e WHERE TRUE""" + eq);
        long schools = jdbc.queryForObject("SELECT COUNT(*) FROM schools s WHERE s.status = 'ACTIVE'"
                + visible.sqlFilter("s.id"), Long.class);

        List<Count> pending = new ArrayList<>();
        long pendingTotal = 0;
        // Tài khoản của trường: "chờ duyệt" là phiếu đang chờ LÃNH ĐẠO TRƯỜNG. Phiếu đã qua trường, đang chờ UBND /
        // Sở thì trường không còn việc gì — đếm vào là báo hiệu trưởng "14 phiếu chờ duyệt" mà mở ra không phiếu
        // nào có nút Duyệt (E2E-06).
        String atSchool = "SCHOOL".equals(visible.level()) ? " AND approval_step = 'SCHOOL'" : "";
        for (Map.Entry<String, String> t : ReportService.voucherTables().entrySet()) {
            Long n = jdbc.queryForObject("SELECT COUNT(*) FROM %s WHERE status = 'PENDING'".formatted(t.getKey())
                    + atSchool + visible.sqlFilter("school_id"), Long.class);
            long count = n == null ? 0 : n;
            pendingTotal += count;
            pending.add(new Count(t.getKey(), t.getValue(), count));
        }
        // Phiếu chờ duyệt theo NƠI đang phải duyệt: lãnh đạo trường, UBND hay Sở. Thẻ của cơ quan quản lý
        // đếm phiếu của mọi trường trong phạm vi, nhưng Sở chỉ duyệt trường Sở quản lý — một con số chung
        // làm người xem tưởng cả chừng ấy phiếu đang chờ mình.
        Map<String, Long> waiting = new LinkedHashMap<>();
        waiting.put("SCHOOL", 0L);
        waiting.put("UBND", 0L);
        waiting.put("SO", 0L);
        for (String table : ReportService.voucherTables().keySet()) {
            String approver = "equipment_transfers".equals(table)
                    ? "CASE WHEN v.approval_step = 'RECEIVING_BODY' THEN v.target_school_id ELSE v.school_id END"
                    : "v.school_id";
            jdbc.query("""
                    SELECT CASE WHEN v.approval_step IN ('MANAGING_BODY', 'RECEIVING_BODY') AND d.type IS NOT NULL
                                THEN d.type ELSE 'SCHOOL' END, COUNT(*)
                    FROM %s v
                    LEFT JOIN schools s ON s.id = %s
                    LEFT JOIN departments_of_education d ON d.id = s.department_of_education_id
                    WHERE v.status = 'PENDING'""".formatted(table, approver) + visible.sqlFilter("v.school_id")
                    + " GROUP BY 1", rs -> {
                        waiting.merge(rs.getString(1), rs.getLong(2), Long::sum);
                    });
        }
        List<Count> waitingAt = waiting.entrySet().stream()
                .map(w -> new Count(w.getKey(), switch (w.getKey()) {
                    case "SCHOOL" -> "Chờ lãnh đạo trường duyệt";
                    case "UBND" -> "Chờ UBND duyệt";
                    case "SO" -> "Chờ Sở duyệt";
                    default -> w.getKey();
                }, w.getValue()))
                .toList();

        Long overdue = jdbc.queryForObject("""
                SELECT COUNT(*) FROM equipment_loans WHERE status = 'APPROVED' AND due_date < CURRENT_DATE"""
                + visible.sqlFilter("school_id"), Long.class);
        Long maintenance = jdbc.queryForObject("""
                SELECT COUNT(*) FROM maintenance_plans WHERE active AND plan_status = 'ACTIVE' AND approval_status = 'APPROVED'
                  AND next_due_date <= CURRENT_DATE + 7"""
                + visible.sqlFilter("school_id"), Long.class);

        List<Count> statuses = jdbc.query("""
                SELECT e.status, COUNT(*) FROM equipment e WHERE TRUE""" + eq + " GROUP BY 1 ORDER BY 2 DESC",
                (rs, i) -> new Count(rs.getString(1), rs.getString(1), rs.getLong(2)));

        // Chỉ đọc lịch sử của 12 tháng đang vẽ (chỉ mục created_at, 171), không gộp cả bảng rồi mới bỏ bớt. Lùi
        // thêm một ngày vì mốc so ở UTC còn tháng thì tính theo giờ Việt Nam; dòng lọt sang tháng trước không
        // khớp tháng nào của m nên tự rơi ra.
        List<Month> months = jdbc.query("""
                WITH m AS (SELECT generate_series(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
                                                  DATE_TRUNC('month', CURRENT_DATE), INTERVAL '1 month') AS m)
                SELECT TO_CHAR(m.m, 'MM/YYYY'),
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action = 'GHI_TANG'),
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action IN ('CAP_PHAT', 'THU_HOI', 'DIEU_CHUYEN')),
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action = 'BAO_HONG'),
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action IN ('THANH_LY', 'TIEU_HUY', 'MAT'))
                FROM m
                LEFT JOIN (SELECT h.* FROM equipment_history h JOIN equipment e ON e.id = h.equipment_id
                           WHERE h.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                                                 - INTERVAL '1 day'""" + eq + """
                ) h ON DATE_TRUNC('month', h.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = m.m
                GROUP BY m.m ORDER BY m.m""",
                (rs, i) -> new Month(rs.getString(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)));

        List<SchoolRow> attention = List.of();
        if (!"SCHOOL".equals(visible.level())) {
            // "Chờ duyệt" của một trường đếm trên MỌI loại phiếu — cùng phép đếm với thẻ "Phiếu chờ duyệt"
            // và danh sách bên cạnh. Trước đây chỉ cộng thanh lý, điều chuyển, đề xuất mua sắm, nên một
            // trường có ba phiếu mượn chờ duyệt hiện 0 ngay dưới một thẻ ghi 3.
            String pendingOfSchool = ReportService.voucherTables().keySet().stream()
                    .map(t -> "(SELECT COUNT(*) FROM %s v WHERE v.school_id = s.id AND v.status = 'PENDING')"
                            .formatted(t))
                    .collect(java.util.stream.Collectors.joining(" + "));
            attention = jdbc.query("""
                    SELECT s.id, s.name,
                           COUNT(e.id) FILTER (WHERE e.status NOT IN ('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED')),
                           COUNT(e.id) FILTER (WHERE e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY')),
                           COUNT(e.id) FILTER (WHERE e.status = 'MISSING'),
                           """ + pendingOfSchool + """

                    FROM schools s JOIN equipment e ON e.school_id = s.id
                    WHERE TRUE""" + visible.sqlFilter("s.id") + """
                     GROUP BY s.id, s.name
                    HAVING COUNT(e.id) FILTER (WHERE e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY', 'MISSING')) > 0
                    ORDER BY COUNT(e.id) FILTER (WHERE e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY', 'MISSING')) DESC LIMIT 10""",
                    (rs, i) -> new SchoolRow(rs.getLong(1), rs.getString(2), rs.getLong(3), rs.getLong(4),
                            rs.getLong(5), rs.getLong(6)));
        }

        // Tình trạng xử lý phiếu trong kỳ — lập trong kỳ, đang ở trạng thái nào.
        Map<String, Long> byStatus = new java.util.HashMap<>();
        jdbc.query("SELECT v.status, COUNT(*) FROM " + allVouchers()
                        + " WHERE v.created_at >= " + since + " GROUP BY 1",
                rs -> {
                    byStatus.put(rs.getString(1), rs.getLong(2));
                });
        List<Count> vouchers = VOUCHER_STATUS.entrySet().stream()
                .map(s -> new Count(s.getKey(), s.getValue(), byStatus.getOrDefault(s.getKey(), 0L)))
                .toList();

        // Phiếu lập ra / hoàn tất theo ngày, 7 hoặc 30 ngày gần nhất (giờ Việt Nam).
        List<Day> daily = jdbc.query("""
                WITH d AS (SELECT generate_series(CURRENT_DATE - %d, CURRENT_DATE, INTERVAL '1 day')::date AS d),
                     v AS (SELECT * FROM %s)
                SELECT TO_CHAR(d.d, 'YYYY-MM-DD'),
                       (SELECT COUNT(*) FROM v WHERE (v.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.d),
                       (SELECT COUNT(*) FROM v WHERE (v.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.d)
                FROM d ORDER BY d.d""".formatted(span - 1, allVouchers()),
                (rs, i) -> new Day(rs.getString(1), rs.getLong(2), rs.getLong(3)));

        // Tình trạng kỹ thuật của tài sản còn trên sổ.
        Map<String, Long> byCondition = new java.util.HashMap<>();
        jdbc.query("SELECT COALESCE(e.condition, 'NONE'), COUNT(*) FROM equipment e"
                        + " WHERE e.status NOT IN ('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED')" + eq + " GROUP BY 1",
                rs -> {
                    byCondition.put(rs.getString(1), rs.getLong(2));
                });
        List<Count> conditions = new ArrayList<>(CONDITIONS.entrySet().stream()
                .map(c -> new Count(c.getKey(), c.getValue(), byCondition.getOrDefault(c.getKey(), 0L)))
                .toList());
        long unrated = byCondition.entrySet().stream().filter(x -> !CONDITIONS.containsKey(x.getKey()))
                .mapToLong(Map.Entry::getValue).sum();
        if (unrated > 0) {
            conditions.add(new Count("NONE", "Chưa đánh giá", unrated));
        }

        // Tỷ lệ đáp ứng chỉ tính trường ĐÃ nhập thiết bị, như màn Thiết bị tối thiểu các trường: trường chưa
        // nhập thì "thiếu" của nó là thiếu dữ liệu, tính vào là cả địa bàn về 0%.
        int norms = 0;
        int met = 0;
        int entered = 0;
        for (AdequacyService.SchoolSummary row : adequacy.summary().rows()) {
            if (row.hasEquipment()) {
                entered++;
                norms += row.norms();
                met += row.met();
            }
        }
        int adequacyPercent = norms == 0 ? 0 : Math.round(met * 100f / norms);

        Kpis kpis = new Kpis(schools, num(e.get("total")), (java.math.BigDecimal) e.get("value"), num(e.get("in_use")),
                num(e.get("broken")), num(e.get("missing")), num(e.get("pending_liq")), pendingTotal,
                overdue == null ? 0 : overdue, maintenance == null ? 0 : maintenance, adequacyPercent, entered);
        return new Dashboard(visible.level(), reports.scopeLabel(), kpis, statuses, pending, months, attention,
                kind, vouchers, span, daily, conditions, waitingAt);
    }

    private static long num(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }
}
