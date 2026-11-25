package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facilitystandard.FacilityStandardService;
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

    public record Kpis(long schools, long equipment, java.math.BigDecimal originalValue, long inUse,
            /* Thiết bị đã ghi mất (không tính vào {@code equipment}). */
            long missing, long pendingVouchers,
            int adequacyPercent, int adequacySchools,
            /* Đánh giá CSVC theo chuẩn (TC-04): % trường đạt từ mức tối thiểu trở lên, trên số trường đã khai phòng. */
            int facilityPercent, int facilitySchools) {
    }

    public record Count(String key, String label, long count) {
    }

    public record Month(String month, long intake) {
    }

    /**
     * Trường cần Sở đôn đốc. Thiết bị và CSVC mỗi thứ một trong hai việc: chưa khai, hoặc đã khai mà chưa đáp ứng
     * (thiết bị dạy học tối thiểu, chuẩn CSVC mức tối thiểu). Kiểm kê: chưa có biên bản được duyệt cho đợt đang mở.
     */
    public record SchoolRow(Long id, String name, long equipment, long rooms, boolean inventoryDue,
            boolean equipmentShort, boolean facilityShort) {
    }

    /** Một ngày: số phiếu lập ra và số phiếu hoàn tất trong ngày đó. */
    public record Day(String date, long created, long completed) {
    }

    public record Dashboard(String level, String scope, Kpis kpis, List<Count> statuses, List<Count> pending,
            List<Month> months, List<SchoolRow> attention, String period, List<Count> vouchers, int days,
            List<Day> daily, List<Count> conditions, List<Count> waitingAt,
            /* Tổng số trường cần đôn đốc ({@code attention} đủ danh sách, cho biểu đồ và hộp danh sách). */
            int attentionTotal,
            /* Năm học đang xem là năm hiện tại (biểu đồ ghi tăng là 12 tháng gần nhất thay vì 12 tháng của năm học). */
            boolean yearCurrent) {
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
    }

    /**
     * Mọi phiếu trong phạm vi, gộp một bảng ảo: loại, trạng thái, lúc lập, lúc xong.
     * Phiếu nhập ghi lúc xong ở {@code confirmed_at}; các phiếu khác ở {@code completed_at}.
     */
    private String allVouchers(Long campus) {
        List<String> parts = new ArrayList<>();
        for (String table : ReportService.voucherTables().keySet()) {
            String done = "equipment_intakes".equals(table) ? "confirmed_at" : "completed_at";
            parts.add("SELECT '%s' AS kind, x.status, x.created_at, x.%s AS completed_at FROM %s x WHERE TRUE%s"
                    .formatted(table, done, table, visible.sqlFilter("x.school_id"))
                    + reports.campusVoucher(table, "x", campus));
        }
        return "(" + String.join(" UNION ALL ", parts) + ") v";
    }

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;
    private final AdequacyService adequacy;
    private final ReportService reports;

    private final SharedCache shared;
    private final CampusScope campuses;
    private final FacilityStandardService facilityStandards;

    public DashboardService(JdbcTemplate jdbc, VisibleSchools visible, AdequacyService adequacy,
            ReportService reports, SharedCache shared, CampusScope campuses,
            FacilityStandardService facilityStandards) {
        this.facilityStandards = facilityStandards;
        this.shared = shared;
        this.campuses = campuses;
        this.jdbc = jdbc;
        this.visible = visible;
        this.adequacy = adequacy;
        this.reports = reports;
    }

    public Dashboard build() {
        return build("month", 7);
    }

    public Dashboard build(String period, int days) {
        return build(period, days, null);
    }

    /**
     * {@code yearId}: năm học đang xem (null = năm hiện tại) — chỉ biểu đồ ghi tăng theo 12 tháng của năm học đó, các
     * số khác luôn là số liệu hiện tại.
     */
    public Dashboard build(String period, int days, Long yearId) {
        String kind = PERIODS.containsKey(period) ? period : "month";
        int span = days == 30 ? 30 : 7;
        Set<Long> schools = visible.current();
        // Tài khoản một cơ sở chỉ thấy số của cơ sở mình — khoá đệm mang cơ sở.
        Long campus = campuses.pinnedCampusId();
        String key = visible.level() + "|" + (schools == null ? "*" : new TreeSet<>(schools).toString()) + "|"
                + kind + "|" + span + (campus == null ? "" : "|c" + campus) + (yearId == null ? "" : "|y" + yearId);
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
                    fresh = compute(kind, span, campus, yearId);
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

    private Dashboard compute(String kind, int span, Long campus, Long yearId) {
        // Năm học đang xem chỉ đổi biểu đồ ghi tăng (12 tháng của năm học đó). Các số khác là số liệu HIỆN TẠI: sổ
        // thiết bị cộng dồn, không có bản chụp theo năm (nhập từ tệp không có ngày vào sổ).
        Map<String, Object> year = jdbc.queryForList("""
                SELECT y.start_date, y.end_date, y.is_current FROM school_years y
                WHERE (CAST(? AS BIGINT) IS NULL AND y.is_current) OR y.id = ?
                ORDER BY y.is_current DESC LIMIT 1""", yearId, yearId).stream().findFirst().orElse(Map.of());
        boolean yearCurrent = year.isEmpty() || Boolean.TRUE.equals(year.get("is_current"));
        String monthStart = year.get("start_date") == null || yearCurrent
                ? "DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'"
                : "DATE_TRUNC('month', DATE '" + year.get("start_date") + "')";
        String since = PERIODS.get(kind);
        String eq = visible.sqlFilter("e.school_id") + ReportCampus.room("e.room_id", "e.school_id", campus);
        Map<String, Object> e = jdbc.queryForMap("""
                SELECT COUNT(*) FILTER (WHERE e.status <> 'LOST') AS total,
                       COALESCE(SUM(e.original_value) FILTER (WHERE e.status <> 'LOST'), 0) AS value,
                       COUNT(*) FILTER (WHERE e.status = 'IN_USE') AS in_use,
                       COUNT(*) FILTER (WHERE e.status = 'LOST') AS missing
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
            Long n = jdbc.queryForObject("SELECT COUNT(*) FROM %s v WHERE status = 'PENDING'".formatted(t.getKey())
                    + atSchool + visible.sqlFilter("v.school_id") + reports.campusVoucher(t.getKey(), "v", campus),
                    Long.class);
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
            jdbc.query("""
                    SELECT CASE WHEN v.approval_step = 'MANAGING_BODY' AND d.type IS NOT NULL
                                THEN d.type ELSE 'SCHOOL' END, COUNT(*)
                    FROM %s v
                    LEFT JOIN schools s ON s.id = v.school_id
                    LEFT JOIN departments_of_education d ON d.id = s.department_of_education_id
                    WHERE v.status = 'PENDING'""".formatted(table) + visible.sqlFilter("v.school_id")
                    + reports.campusVoucher(table, "v", campus) + " GROUP BY 1", rs -> {
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

        List<Count> statuses = jdbc.query("""
                SELECT e.status, COUNT(*) FROM equipment e WHERE TRUE""" + eq + " GROUP BY 1 ORDER BY 2 DESC",
                (rs, i) -> new Count(rs.getString(1), rs.getString(1), rs.getLong(2)));

        // 12 tháng gần nhất, màn hình chọn xem 3 / 6 / 12 tháng. Chỉ đọc lịch sử của các tháng đang vẽ (chỉ mục created_at, 171), không gộp cả bảng rồi mới bỏ bớt. Lùi
        // thêm một ngày vì mốc so ở UTC còn tháng thì tính theo giờ Việt Nam; dòng lọt sang tháng trước không
        // khớp tháng nào của m nên tự rơi ra.
        List<Month> months = jdbc.query(("""
                WITH m AS (SELECT generate_series(MONTH_START, MONTH_START + INTERVAL '11 months', INTERVAL '1 month') AS m)
                SELECT TO_CHAR(m.m, 'MM/YYYY'),
                       COUNT(DISTINCT h.equipment_id) FILTER (WHERE h.action = 'GHI_TANG')
                FROM m
                LEFT JOIN (SELECT h.* FROM equipment_history h JOIN equipment e ON e.id = h.equipment_id
                           WHERE h.created_at >= MONTH_START - INTERVAL '1 day'""" + eq + """
                ) h ON DATE_TRUNC('month', h.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = m.m
                GROUP BY m.m ORDER BY m.m""").replace("MONTH_START", monthStart),
                (rs, i) -> new Month(rs.getString(1), rs.getLong(2)));

        List<SchoolRow> attention = List.of();
        int attentionTotal = 0;
        if (!"SCHOOL".equals(visible.level())) {
            List<SchoolRow> due = jdbc.query("""
                    SELECT s.id, s.name,
                           (SELECT COUNT(*) FROM equipment e WHERE e.school_id = s.id),
                           (SELECT COUNT(*) FROM rooms r WHERE r.school_id = s.id),
                           EXISTS (SELECT 1 FROM inventory_campaigns c
                                   WHERE NOT c.closed AND c.managing_body_id = s.department_of_education_id
                                     AND NOT EXISTS (SELECT 1 FROM inventory_sessions x WHERE x.campaign_id = c.id
                                                     AND x.school_id = s.id AND x.status = 'COMPLETED'))
                    FROM schools s WHERE s.status = 'ACTIVE'""" + visible.sqlFilter("s.id") + " ORDER BY s.name",
                    (rs, i) -> new SchoolRow(rs.getLong(1), rs.getString(2), rs.getLong(3), rs.getLong(4),
                            rs.getBoolean(5), false, false));
            attention = due;
        }

        // Tình trạng xử lý phiếu trong kỳ — lập trong kỳ, đang ở trạng thái nào.
        Map<String, Long> byStatus = new java.util.HashMap<>();
        jdbc.query("SELECT v.status, COUNT(*) FROM " + allVouchers(campus)
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
                FROM d ORDER BY d.d""".formatted(span - 1, allVouchers(campus)),
                (rs, i) -> new Day(rs.getString(1), rs.getLong(2), rs.getLong(3)));

        // Tình trạng kỹ thuật của tài sản còn trên sổ.
        Map<String, Long> byCondition = new java.util.HashMap<>();
        jdbc.query("SELECT COALESCE(e.condition, 'NONE'), COUNT(*) FROM equipment e"
                        + " WHERE e.status <> 'LOST'" + eq + " GROUP BY 1",
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
        for (AdequacyService.SchoolSummary row : adequacy.summary(campus).rows()) {
            if (row.hasEquipment()) {
                entered++;
                norms += row.norms();
                met += row.met();
            }
        }
        int adequacyPercent = norms == 0 ? 0 : Math.round(met * 100f / norms);
        java.util.Set<Long> equipmentShort = new java.util.HashSet<>();
        for (AdequacyService.SchoolSummary row : adequacy.summary(campus).rows()) {
            if (row.hasEquipment() && row.met() < row.norms()) {
                equipmentShort.add(row.schoolId());
            }
        }

        // Chuẩn CSVC: như đáp ứng tối thiểu, chỉ tính trường ĐÃ khai phòng — trường chưa khai thì "chưa đạt" là thiếu
        // dữ liệu, không phải thiếu phòng.
        java.util.Set<Long> withRooms = new java.util.HashSet<>(jdbc.queryForList(
                "SELECT DISTINCT r.school_id FROM rooms r WHERE TRUE" + visible.sqlFilter("r.school_id"), Long.class));
        int facilityReached = 0;
        java.util.Set<Long> facilityShort = new java.util.HashSet<>();
        for (FacilityStandardService.Summary s : facilityStandards.summaries(visible.sqlFilter("s.id"), campus)) {
            if (s.reached() != null && withRooms.contains(s.school().id())) {
                facilityReached++;
            } else if (s.reached() == null && withRooms.contains(s.school().id())) {
                facilityShort.add(s.school().id());
            }
        }
        int facilityPercent = withRooms.isEmpty() ? 0 : Math.round(facilityReached * 100f / withRooms.size());

        // Trường cần đôn đốc: gắn hai cờ "đã khai mà chưa đáp ứng", giữ trường còn ít nhất một việc, thiếu nhiều lên đầu.
        List<SchoolRow> gaps = new ArrayList<>();
        for (SchoolRow s : attention) {
            SchoolRow r = new SchoolRow(s.id(), s.name(), s.equipment(), s.rooms(), s.inventoryDue(),
                    equipmentShort.contains(s.id()), facilityShort.contains(s.id()));
            if (r.equipment() == 0 || r.rooms() == 0 || r.inventoryDue() || r.equipmentShort() || r.facilityShort()) {
                gaps.add(r);
            }
        }
        gaps.sort(java.util.Comparator.comparingInt((SchoolRow s) -> -((s.equipment() == 0 || s.equipmentShort() ? 1 : 0)
                + (s.rooms() == 0 || s.facilityShort() ? 1 : 0) + (s.inventoryDue() ? 1 : 0))));
        attention = gaps;
        attentionTotal = gaps.size();

        Kpis kpis = new Kpis(schools, num(e.get("total")), (java.math.BigDecimal) e.get("value"), num(e.get("in_use")),
                num(e.get("missing")), pendingTotal,
                adequacyPercent, entered, facilityPercent, withRooms.size());
        return new Dashboard(visible.level(), reports.scopeLabel(), kpis, statuses, pending, months, attention,
                kind, vouchers, span, daily, conditions, waitingAt, attentionTotal, yearCurrent);
    }

    private static long num(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }
}
