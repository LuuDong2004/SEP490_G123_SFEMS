package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.shared.cache.SharedCache;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.web.ListParams;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Màn Thiết bị dạng TỔNG HỢP SỐ LƯỢNG: mỗi dòng một mặt hàng (hoặc một mặt hàng trong
 * một kho/phòng), cột là số lượng tách theo tình trạng — tổng, dùng được, đang dùng,
 * trong kho, hỏng — cùng số tối thiểu trường cần có của mặt hàng.
 *
 * <p>Mọi thứ đều đếm từ {@code equipment} (bỏ thiết bị đã mất): thiết bị
 * mỗi bản ghi một cái, VẬT TƯ TIÊU HAO mỗi bản ghi mang số lượng ({@code quantity}),
 * nên tổng là {@code SUM(quantity)} chứ không phải số bản ghi.
 *
 * <p>Đơn vị tính của một dòng là đơn vị trên HỒ SƠ của chính các thiết bị được cộng (hồ sơ để
 * trống thì theo danh mục) — cùng thứ màn chi tiết hiện, nên hai chỗ không lệch nhau; các hồ sơ
 * mang đơn vị khác nhau thì dòng ghi cả hai ("Bộ / Cái") thay vì giấu đi một.
 *
 * <p>SQL thuần nên phạm vi đi qua {@link VisibleSchools}, như mọi truy vấn gộp (báo cáo,
 * bảng điều khiển). Bộ lọc đúng nghĩa với bộ lọc của bảng từng tài sản
 * ({@code EquipmentService.ownedFilters}) — cùng một cây lọc bên trái cho cả hai.
 */
@Service
@Transactional(readOnly = true)
public class EquipmentSummaryService {

    public enum By { CATALOG, ROOM }

    /** Trạng thái của tài sản đã ra khỏi sổ: mất. */
    private static final String OFF_BOOK_SQL = "'LOST'";

    /**
     * {@code schoolIds}: chỉ các trường này (xuất Excel theo trường tự chọn); rỗng / vắng = không giới hạn thêm.
     * {@code assetStatus} / {@code condition}: bộ lọc nâng cao của màn Thiết bị — một hoặc nhiều mã
     * ({@code AssetStatus} / {@code EquipmentCondition}) cách nhau bằng dấu phẩy; vắng = không lọc.
     */
    public record Filters(Long schoolId, String schoolBody, String catalogType, Long catalogTree, String subject,
                          String q, List<Long> schoolIds, String assetStatus, String condition,
                          /** in: trong danh mục của Sở; out: ngoài danh mục (trường tự thêm); trống: cả hai. */
                          String catalogScope,
                          /** Cơ sở (bộ lọc Cơ sở): thiết bị ở phòng thuộc cơ sở đó, chưa xếp phòng = cơ sở chính. */
                          Long campusId) {
        public Filters(Long schoolId, String schoolBody, String catalogType, Long catalogTree, String subject, String q) {
            this(schoolId, schoolBody, catalogType, catalogTree, subject, q, null, null, null, null, null);
        }

        public Filters(Long schoolId, String schoolBody, String catalogType, Long catalogTree, String subject, String q,
                       List<Long> schoolIds) {
            this(schoolId, schoolBody, catalogType, catalogTree, subject, q, schoolIds, null, null, null, null);
        }

        /** Cùng bộ lọc, gói vào MỘT trường (trang Excel của từng trường). */
        Filters withSchool(Long id) {
            return new Filters(id, schoolBody, catalogType, catalogTree, subject, q, null, assetStatus, condition,
                    catalogScope, campusId);
        }

        /** Cùng bộ lọc, bỏ ô tìm — bảng chi tiết tự tìm trên mã / tên tài sản. */
        Filters withoutQuery() {
            return new Filters(schoolId, schoolBody, catalogType, catalogTree, subject, null, schoolIds, assetStatus,
                    condition, catalogScope, campusId);
        }
    }

    /** Thời gian đệm bảng tổng hợp của phạm vi nhiều trường — xem {@link #screen}. */
    static final int CACHE_SECONDS = 30;

    /** Trần số nhóm (trường × kho/phòng) một trang của bảng theo kho/phòng. */
    static final int MAX_ROOM_PAGE = 200;

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;
    private final EquipmentCatalogService catalogs;
    private final SummaryCache<Map<String, Object>> cache;
    private final SummaryCache<Long> countCache;
    private final CampusScope campusScope;
    private final com.g123.sfems.module.school.procurement.AdequacyService adequacy;

    public EquipmentSummaryService(JdbcTemplate jdbc, VisibleSchools visible, EquipmentCatalogService catalogs,
                                   SharedCache shared, CampusScope campusScope,
                                   com.g123.sfems.module.school.procurement.AdequacyService adequacy) {
        this.adequacy = adequacy;
        this.jdbc = jdbc;
        this.visible = visible;
        this.catalogs = catalogs;
        this.campusScope = campusScope;
        Duration ttl = Duration.ofSeconds(CACHE_SECONDS);
        this.cache = new SummaryCache<>(ttl, 300, shared, "equipment-summary", shared.mapType(String.class, Object.class));
        this.countCache = new SummaryCache<>(ttl, 500, shared, "equipment-items-count", shared.type(Long.class));
    }

    /**
     * Bảng tổng hợp ra tệp Excel thật (.xlsx): số lượng là ô SỐ có ngăn hàng nghìn, nên 15.750 gam trên màn
     * là 15.750 trong tệp — tệp CSV trước đây ghi trơn "15750", đọc dễ nhầm với 15,75.
     */
    /**
     * Tệp Excel của bảng tổng hợp. {@code perSchool}: trang đầu là tổng hợp của cả lựa chọn, sau đó MỖI
     * TRƯỜNG MỘT TRANG TÍNH (tên trang là tên trường) — chỉ trường có thiết bị khớp bộ lọc, nên chọn cả địa
     * bàn không sinh ra hàng trăm trang trống.
     */
    public byte[] excel(By by, Filters f, boolean perSchool) {
        boolean byRoom = by == By.ROOM;
        List<XlsxWriter.Tab> tabs = new ArrayList<>();
        tabs.add(new XlsxWriter.Tab(perSchool ? "Tổng hợp" : "Bao cao",
                sheet(by, f, byRoom ? "Thiết bị theo kho / phòng" : "Tổng hợp thiết bị", byRoom)));
        if (perSchool) {
            for (Map<String, Object> school : schoolsOf(f)) {
                Long id = ((Number) school.get("id")).longValue();
                String name = (String) school.get("name");
                Filters one = f.withSchool(id);
                // Trang của một trường không cần cột Trường: tên trường đã là tên trang và dòng tiêu đề.
                tabs.add(new XlsxWriter.Tab(name, sheet(by, one, name, false)));
            }
        }
        return XlsxWriter.writeAll(tabs);
    }

    /** Các trường có thiết bị (còn trên sổ) khớp bộ lọc, trong phạm vi người xem, theo tên. */
    private List<Map<String, Object>> schoolsOf(Filters f) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = commonWhere(f, args);
        return jdbc.queryForList("""
                SELECT DISTINCT sc.id, sc.name
                FROM equipment x
                JOIN schools sc ON sc.id = x.school_id
                JOIN equipment_catalogs c ON c.id = x.catalog_id
                WHERE x.status NOT IN (""" + OFF_BOOK_SQL + ")" + visible.sqlFilter("x.school_id") + " " + where
                + " ORDER BY sc.name", args.toArray());
    }

    @SuppressWarnings("unchecked")
    private XlsxWriter.Sheet sheet(By by, Filters f, String title, boolean schoolColumn) {
        boolean byRoom = by == By.ROOM;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> r : (List<Map<String, Object>>) summarize(by, f).get("rows")) {
            Map<String, Object> row = new HashMap<>(r);
            row.put("tracking", "BULK".equals(r.get("tracking_type")) ? "Theo lô" : "Từng cái");
            row.put("minimum", Boolean.TRUE.equals(r.get("minimum_required")) ? "Có" : "");
            readable(row);
            rows.add(row);
        }
        List<XlsxWriter.Column> columns = new ArrayList<>();
        if (schoolColumn) {
            columns.add(new XlsxWriter.Column("school", "Trường", "text"));
        }
        if (byRoom) {
            columns.add(new XlsxWriter.Column("room", "Kho / phòng", "text"));
        }
        columns.add(new XlsxWriter.Column("code", "Mã DM thiết bị", "text"));
        columns.add(new XlsxWriter.Column("name", "Thiết bị", "text"));
        columns.add(new XlsxWriter.Column("subject", "Môn học", "text"));
        columns.add(new XlsxWriter.Column("unit", "ĐVT", "text"));
        columns.add(new XlsxWriter.Column("type", "Loại", "text"));
        columns.add(new XlsxWriter.Column("tracking", "Cách quản lý", "text"));
        columns.add(new XlsxWriter.Column("total", "Tổng", "number"));
        columns.add(new XlsxWriter.Column("in_use", "Đang dùng", "number"));
        columns.add(new XlsxWriter.Column("in_stock", "Trong kho", "number"));
        if (!byRoom) {
            columns.add(new XlsxWriter.Column("required", "Chuẩn tối thiểu: phải có", "number"));
            columns.add(new XlsxWriter.Column("shortage", "Chuẩn tối thiểu: còn thiếu", "number"));
        }
        columns.add(new XlsxWriter.Column("minimum", "Thuộc danh mục tối thiểu", "text"));
        return new XlsxWriter.Sheet(title, "Số lượng theo đơn vị tính của từng thiết bị", columns, rows);
    }

    /** Đơn vị nhỏ → đơn vị lớn gấp nghìn lần, theo tên trong danh mục Đơn vị tính (viết thường). */
    private static final Map<String, String> THOUSANDFOLD = Map.of("gam", "Kg", "g", "Kg", "mililít", "Lít", "ml", "Lít");
    private static final List<String> QUANTITIES = List.of("total", "in_use", "in_stock", "required", "shortage");

    /**
     * Hoá chất ghi theo gam / mililít (đơn vị của phụ lục thông tư) mà từ 1.000 trở lên thì ghi ra tệp theo
     * kg / lít — 15.750 gam là 15,75 kg, cùng cách hiện trên màn. Cả dòng một đơn vị, chọn theo cột Tổng.
     */
    private static void readable(Map<String, Object> row) {
        Object unit = row.get("unit");
        String big = unit == null ? null : THOUSANDFOLD.get(unit.toString().trim().toLowerCase(Locale.ROOT));
        Object total = row.get("total");
        if (big == null || !(total instanceof Number t) || Math.abs(t.doubleValue()) < 1000) {
            return;
        }
        row.put("unit", big);
        for (String key : QUANTITIES) {
            if (row.get(key) instanceof Number q) {
                row.put(key, new BigDecimal(q.toString()).divide(BigDecimal.valueOf(1000)).setScale(2, RoundingMode.HALF_UP));
            }
        }
    }

    /**
     * Đầu vào của màn hình ({@code GET /equipment/summary}). Hai điều khác {@link #summarize}:
     *
     * <ul>
     *   <li><b>Theo kho/phòng có phân trang ở máy chủ</b>, theo NHÓM (mỗi trường × kho/phòng một nhóm),
     *       không theo dòng — một phòng không bị xẻ qua hai trang. Toàn địa bàn là hàng trăm nghìn dòng
     *       (thiết bị × phòng × trường); trả hết một lần là dựng cả triệu Map trong heap rồi bắt trình
     *       duyệt tự phân trang.</li>
     *   <li><b>Phạm vi nhiều trường (Sở, UBND) dùng bộ nhớ đệm {@value #CACHE_SECONDS} giây</b>, một lần
     *       tính mỗi khoá: mở màn gọi hai lần (cột trái và bảng), mỗi lần là một lượt GROUP BY trên cả sổ.
     *       Số tổng hợp của cơ quan quản lý vì thế chậm tối đa chừng ấy giây sau một phiếu. Tài khoản của
     *       MỘT trường (hoặc đã lọc một trường) không đệm: câu đó rẻ nhờ chỉ mục theo trường, và người vừa
     *       ghi tăng phải thấy ngay tài sản của mình.</li>
     * </ul>
     *
     * {@code SUPPORTS}: không tự mở giao dịch, nên người đang chờ chung một lần tính không giữ kết nối.
     */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Map<String, Object> screen(By by, Filters f, int start, int size) {
        int from = Math.max(0, start);
        int pageSize = Math.clamp(size, 1, MAX_ROOM_PAGE);
        Supplier<Map<String, Object>> work = by == By.ROOM ? () -> roomPage(f, from, pageSize) : () -> summarize(by, f);
        Set<Long> scope = visible.current();
        boolean wide = f.schoolId() == null && (scope == null || scope.size() > 1);
        if (!wide) {
            return work.get();
        }
        String key = (scope == null ? "*" : new TreeSet<>(scope).toString()) + "|" + by + "|" + f
                + "|c" + campusScope.effectiveFilter(f.campusId())
                + (by == By.ROOM ? "|" + from + "|" + pageSize : "");
        return cache.get(key, work);
    }

    /** Nguồn chung của mọi phép tổng hợp: tài sản còn trên sổ, trong phạm vi người xem. */
    private String itemsCte() {
        return """
                WITH items AS (
                    SELECT e.school_id, e.catalog_id, e.room_id, e.unit_id, COALESCE(e.quantity, 1) AS q, e.status,
                           e.condition
                    FROM equipment e
                    WHERE e.status NOT IN (""" + OFF_BOOK_SQL + ")" + visible.sqlFilter("e.school_id") + """
                )
                """;
    }

    public Map<String, Object> summarize(By by, Filters f) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = commonWhere(f, args);
        List<Map<String, Object>> rows = jdbc.queryForList(summarySql(by == By.ROOM, where), args.toArray());
        if (by == By.CATALOG) {
            withStandard(rows, f);
        }
        long schools = rows.stream().map(r -> ((Number) r.get("schools")).longValue()).max(Long::compare).orElse(0L);
        return Map.of("by", by.name().toLowerCase(), "rows", rows, "maxSchools", schools);
    }

    /**
     * Gắn đối chiếu chuẩn tối thiểu vào từng dòng (bảng Tổng hợp): {@code required} là số phải có, {@code shortage}
     * là số còn thiếu, cộng trên các trường đang xem. Thiết bị không thuộc chuẩn của trường nào trong phạm vi thì
     * để trống (giao diện ghi "—"). Chuẩn tính theo trường, không theo phòng, nên bảng Theo kho/phòng không có.
     */
    private void withStandard(List<Map<String, Object>> rows, Filters f) {
        Set<Long> schools = schoolsInFilter(f);
        Map<Long, int[]> totals = adequacy.catalogTotals(schools, f.campusId());
        for (Map<String, Object> r : rows) {
            int[] t = totals.get(((Number) r.get("catalog_id")).longValue());
            r.put("required", t == null ? null : t[0]);
            r.put("shortage", t == null ? null : t[1]);
            r.put("short_schools", t == null ? null : t[2]);
        }
    }

    /** Các trường bộ lọc khoanh lại (một trường, danh sách trường, một cơ quan quản lý); {@code null} = cả phạm vi. */
    private Set<Long> schoolsInFilter(Filters f) {
        if (f.schoolId() != null) {
            return Set.of(f.schoolId());
        }
        if (f.schoolIds() != null && !f.schoolIds().isEmpty()) {
            return Set.copyOf(f.schoolIds());
        }
        if (f.schoolBody() != null && !f.schoolBody().isBlank()) {
            String body = f.schoolBody().trim();
            List<Long> ids = body.equals("none")
                    ? jdbc.queryForList("SELECT id FROM schools WHERE department_of_education_id IS NULL", Long.class)
                    : jdbc.queryForList("SELECT id FROM schools WHERE department_of_education_id = ?", Long.class,
                            Long.parseLong(body));
            return Set.copyOf(ids);
        }
        return null;
    }

    private String summarySql(boolean byRoom, CharSequence where) {
        return itemsCte() + """
                SELECT c.id AS catalog_id, c.code, c.name, c.tracking_type, c.minimum_required,
                       c.equipment_type_id AS type_id, c.subject_id AS subject_id,
                       c.self_made, c.asset_category, sj.name AS subject, t.name AS type,
                       string_agg(DISTINCT u.name, ' / ' ORDER BY u.name) AS unit,
                """ + (byRoom
                        ? " r.id AS room_id, COALESCE(r.name, 'Chưa xếp phòng') AS room, sc.name AS school, "
                        : " ") + """
                       COUNT(DISTINCT x.school_id) AS schools,
                       COUNT(*) AS records,
                       SUM(x.q) AS total,
                       SUM(x.q) FILTER (WHERE x.status IN ('IN_STOCK', 'IN_USE')) AS usable,
                       SUM(x.q) FILTER (WHERE x.status = 'IN_USE') AS in_use,
                       SUM(x.q) FILTER (WHERE x.status = 'IN_STOCK') AS in_stock
                FROM items x
                JOIN equipment_catalogs c ON c.id = x.catalog_id
                JOIN schools sc ON sc.id = x.school_id
                LEFT JOIN units u ON u.id = COALESCE(x.unit_id, c.unit_id)
                LEFT JOIN subjects sj ON sj.id = c.subject_id
                LEFT JOIN equipment_types t ON t.id = c.equipment_type_id
                """ + (byRoom ? " LEFT JOIN rooms r ON r.id = x.room_id " : " ") + """
                WHERE TRUE""" + " " + where + " " + """
                GROUP BY c.id, c.code, c.name, c.tracking_type, c.minimum_required, c.self_made, c.asset_category,
                         c.equipment_type_id, c.subject_id,
                         sj.name, t.name""" + (byRoom ? ", r.id, r.name, sc.name" : "")
                + " ORDER BY " + (byRoom ? "sc.name, room, " : "") + "c.name";
    }

    /**
     * Một trang của bảng "Theo kho/phòng": {@code size} nhóm (trường × kho/phòng) kể từ nhóm thứ
     * {@code start}, cùng thứ tự với {@link #summarize} (trường, phòng, thiết bị). Kèm tổng số nhóm
     * ({@code total}), số trường ({@code maxSchools}) và — cho dòng tiêu đề trường — số kho/phòng và số
     * hồ sơ của mỗi trường có mặt trên trang, đếm trên CẢ danh sách chứ không riêng trang này.
     */
    Map<String, Object> roomPage(Filters f, int start, int size) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = commonWhere(f, args);
        String groupsSql = itemsCte() + """
                , g AS (
                    SELECT x.school_id, x.room_id, sc.name AS school, COALESCE(r.name, 'Chưa xếp phòng') AS room,
                           COUNT(*) AS records
                    FROM items x
                    JOIN equipment_catalogs c ON c.id = x.catalog_id
                    JOIN schools sc ON sc.id = x.school_id
                    LEFT JOIN rooms r ON r.id = x.room_id
                    WHERE TRUE""" + " " + where + " " + """
                    GROUP BY x.school_id, x.room_id, sc.name, r.name
                )
                SELECT g.school_id, g.room_id, g.school, g.records,
                       COUNT(*) OVER () AS total_groups,
                       COUNT(*) OVER (PARTITION BY g.school_id) AS school_rooms,
                       SUM(g.records) OVER (PARTITION BY g.school_id) AS school_records,
                       (SELECT COUNT(DISTINCT school_id) FROM g) AS school_count
                FROM g
                ORDER BY g.school, g.room, g.school_id, g.room_id NULLS FIRST
                LIMIT ? OFFSET ?""";
        List<Object> groupArgs = new ArrayList<>(args);
        groupArgs.add(size);
        groupArgs.add(start);
        List<Map<String, Object>> groups = jdbc.queryForList(groupsSql, groupArgs.toArray());
        if (groups.isEmpty()) {
            // Lật quá trang cuối vẫn phải biết tổng, để màn hình kéo về trang có dữ liệu.
            Long total = start == 0 ? Long.valueOf(0) : jdbc.queryForObject(itemsCte() + """
                    SELECT COUNT(DISTINCT (x.school_id, x.room_id)) FROM items x
                    JOIN equipment_catalogs c ON c.id = x.catalog_id
                    JOIN schools sc ON sc.id = x.school_id
                    WHERE TRUE""" + " " + where, Long.class, args.toArray());
            return Map.of("by", "room", "rows", List.of(), "maxSchools", 0L, "total", total == null ? 0L : total,
                    "schoolTotals", List.of());
        }

        // Dòng thiết bị của đúng các nhóm trên trang: thêm điều kiện (trường, phòng) vào cùng câu tổng hợp.
        StringBuilder pageWhere = new StringBuilder(where).append(" AND (x.school_id, COALESCE(x.room_id, -1)) IN (");
        List<Object> pageArgs = new ArrayList<>(args);
        Map<Long, Map<String, Object>> schoolTotals = new LinkedHashMap<>();
        for (int i = 0; i < groups.size(); i++) {
            Map<String, Object> g = groups.get(i);
            pageWhere.append(i == 0 ? "(?, ?)" : ", (?, ?)");
            pageArgs.add(((Number) g.get("school_id")).longValue());
            pageArgs.add(g.get("room_id") == null ? -1L : ((Number) g.get("room_id")).longValue());
            schoolTotals.computeIfAbsent(((Number) g.get("school_id")).longValue(), id -> {
                Map<String, Object> t = new LinkedHashMap<>();
                t.put("schoolId", id);
                t.put("school", g.get("school"));
                t.put("rooms", ((Number) g.get("school_rooms")).longValue());
                t.put("records", ((Number) g.get("school_records")).longValue());
                return t;
            });
        }
        pageWhere.append(") ");
        List<Map<String, Object>> rows = jdbc.queryForList(summarySql(true, pageWhere), pageArgs.toArray());
        Map<String, Object> first = groups.get(0);
        return Map.of("by", "room", "rows", rows,
                "maxSchools", ((Number) first.get("school_count")).longValue(),
                "total", ((Number) first.get("total_groups")).longValue(),
                "schoolTotals", List.copyOf(schoolTotals.values()));
    }

    /** Bộ lọc riêng của bảng chi tiết, ngoài cây bên trái. */
    public record ItemFilters(String kind, Long catalogId, String roomId, String status, Boolean profileComplete,
                              String legacyCode, Long intakeId, String expiry, Boolean available,
                              String serial, String originSource, Integer inUseYear) {
    }

    /** Vật tư, hoá chất còn bao nhiêu ngày thì tính là "sắp hết hạn". */
    public static final int EXPIRY_WARNING_DAYS = 30;

    /** Một trang của bảng chi tiết và tổng số dòng (cho {@code X-Total-Count}). */
    public record ItemPage(List<Map<String, Object>> rows, long total) {
    }

    /**
     * Bảng CHI TIẾT: mọi bản ghi thiết bị còn trên sổ — thiết bị một bản ghi một cái, vật tư tiêu
     * hao một bản ghi một lô có số lượng. Cùng bộ lọc cây trái và cùng phép đếm với
     * {@link #summarize}; hồ sơ đã ra khỏi sổ chỉ hiện khi lọc đích danh trạng thái của nó.
     *
     * <p>Ba câu, mỗi câu chỉ chạm những gì nó cần — toàn địa bàn là hàng triệu dòng:
     * <ol>
     *   <li><b>Trang</b>: chỉ {@code equipment} + nhóm thiết bị + trường, lọc và xếp rồi lấy đúng {@code size}
     *       id. Không tính regex hồ sơ chuẩn trên từng dòng (trừ khi đang lọc theo nó), không nối đơn vị,
     *       phòng, phiếu nhập — xếp hạng top-N trên dòng hẹp. {@code id} là khoá phụ cuối, nên lật trang
     *       ổn định.</li>
     *   <li><b>Chi tiết</b>: đủ cột hiển thị và cờ hồ sơ, chỉ cho các id của trang.</li>
     *   <li><b>Tổng</b> ({@code X-Total-Count}): cùng FROM / WHERE với câu trang, không ORDER, và với phạm vi
     *       nhiều trường thì đệm {@value #CACHE_SECONDS} giây theo bộ lọc — lật trang không đếm lại cả sổ.</li>
     * </ol>
     * {@code SUPPORTS}: không tự mở giao dịch, mỗi câu mượn rồi trả kết nối.
     */
    @Transactional(propagation = Propagation.SUPPORTS)
    public ItemPage items(Filters f, ItemFilters i, int start, int size, String sortField, boolean desc) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = commonWhere(f.withoutQuery(), args);
        if (i.kind() != null && !i.kind().isBlank()) {
            // Cách quản lý theo nhóm thiết bị: BULK là vật tư tiêu hao, còn lại là từng cái.
            where.append(i.kind().trim().equalsIgnoreCase("bulk") ? " AND c.tracking_type = 'BULK' "
                    : " AND c.tracking_type IS DISTINCT FROM 'BULK' ");
        }
        if (i.catalogId() != null) {
            where.append(" AND x.catalog_id = ? ");
            args.add(i.catalogId());
        }
        if (i.roomId() != null && !i.roomId().isBlank()) {
            if (i.roomId().trim().equals("none")) {
                where.append(" AND x.room_id IS NULL ");
            } else {
                where.append(" AND x.room_id = ? ");
                args.add(Long.parseLong(i.roomId().trim()));
            }
        }
        if (i.status() != null && !i.status().isBlank()) {
            List<String> statuses = Arrays.stream(i.status().split(","))
                    .map(v -> v.trim().toUpperCase()).filter(v -> v.matches("[A-Z_]+")).toList();
            where.append(statuses.isEmpty() ? " AND FALSE "
                    : " AND x.status IN (" + String.join(",", Collections.nCopies(statuses.size(), "?")) + ") ");
            args.addAll(statuses);
        }
        // Không lọc trạng thái thì bảng liệt kê CẢ hồ sơ đã ra khỏi sổ (Mất),
        // xếp cuối và mang đúng trạng thái: hồ sơ không bao giờ biến mất vì lịch sử và phiếu còn trỏ tới nó (trưởng
        // nhóm, 26/10). Chỉ PHÉP ĐẾM bỏ chúng — cột trái và bảng tổng hợp vẫn lọc `OFF_BOOK_SQL`.
        if (i.intakeId() != null) {
            // "Tài sản của phiếu này": mọi hồ sơ phiếu đã sinh, kể cả cái đã ra khỏi sổ — nếu không, con số
            // ở đây lệch với "đã sinh N hồ sơ" trên chính phiếu đó.
            where.append(" AND EXISTS (SELECT 1 FROM equipment_intake_lines il WHERE il.id = x.intake_line_id"
                    + " AND il.intake_id = ?) ");
            args.add(i.intakeId());
        }
        if (i.profileComplete() != null) {
            // Regex hồ sơ chuẩn chỉ khi lọc theo nó; cùng điều kiện với Equipment.missingProfile().
            where.append(" AND (x.code ~ ? AND x.unit_id IS NOT NULL"
                    + " AND x.funding_source IS NOT NULL AND x.received_date IS NOT NULL) = ? ");
            args.add(Equipment.STANDARD_CODE_SQL);
            args.add(i.profileComplete());
        }
        if (Boolean.TRUE.equals(i.available())) {
            where.append(" AND COALESCE(x.quantity, 1) > 0 ");
        }
        // Hạn sử dụng: `expired` = đã quá hạn, `soon` = còn trong hạn nhưng hết hạn trong 30 ngày tới.
        if ("expired".equals(i.expiry())) {
            where.append(" AND x.expiry_date < CURRENT_DATE ");
        } else if ("soon".equals(i.expiry())) {
            where.append(" AND x.expiry_date >= CURRENT_DATE AND x.expiry_date <= CURRENT_DATE + ? ");
            args.add(EXPIRY_WARNING_DAYS);
        }
        if (i.legacyCode() != null && !i.legacyCode().isBlank()) {
            where.append(" AND lower(x.legacy_code) LIKE ? ");
            args.add("%" + i.legacyCode().trim().toLowerCase() + "%");
        }
        if (i.serial() != null && !i.serial().isBlank()) {
            where.append(" AND lower(x.serial_number) LIKE ? ");
            args.add("%" + i.serial().trim().toLowerCase(Locale.ROOT) + "%");
        }
        if (i.originSource() != null && !i.originSource().isBlank()) {
            // Nguồn hình thành của hồ sơ (phiếu ghi tăng chép xuống lúc duyệt): id, mã (MUA_SAM…) hoặc `none`.
            String origin = i.originSource().trim();
            if (origin.equals("none")) {
                where.append(" AND " + ORIGIN_SQL + " IS NULL ");
            } else if (origin.matches("[0-9]+")) {
                where.append(" AND " + ORIGIN_SQL + " = ? ");
                args.add(Long.parseLong(origin));
            } else {
                where.append(" AND " + ORIGIN_SQL + " IN (SELECT id FROM origin_sources WHERE upper(code) = ?) ");
                args.add(origin.toUpperCase(Locale.ROOT));
            }
        }
        if (i.inUseYear() != null) {
            where.append(" AND " + IN_USE_YEAR_SQL + " = ? ");
            args.add(i.inUseYear());
        }

        if (f.q() != null && !f.q().isBlank()) {
            // Tìm trên tên / mã / số serial của CHÍNH dòng (tài sản hoặc lô) và của mặt hàng, không phân biệt dấu.
            where.append(" AND (").append(folded("x.name")).append(" LIKE ? OR ")
                    .append(folded("coalesce(x.code, '')")).append(" LIKE ? OR ")
                    .append(folded("coalesce(x.serial_number, '')")).append(" LIKE ? OR ")
                    .append(folded("c.name")).append(" LIKE ?) ");
            String pattern = "%" + ListParams.fold(f.q().trim()) + "%";
            args.add(pattern);
            args.add(pattern);
            args.add(pattern);
            args.add(pattern);
        }

        String dir = desc ? "DESC" : "ASC";
        String order = switch (sortField == null ? "" : sortField) {
            case "code" -> "x.code " + dir + " NULLS LAST, x.name";
            case "name" -> "x.name " + dir + ", x.code NULLS LAST";
            case "quantity" -> "COALESCE(x.quantity, 1) " + dir + ", x.name";
            case "status" -> "x.status " + dir + ", x.code NULLS LAST";
            case "serialNumber" -> "x.serial_number " + dir + " NULLS LAST, x.code NULLS LAST";
            case "room" -> "(SELECT r.name FROM rooms r WHERE r.id = x.room_id) " + dir + " NULLS LAST, x.code NULLS LAST";
            case "expiryDate" -> "x.expiry_date " + dir + " NULLS LAST, x.code NULLS LAST";
            case "inUseYear" -> IN_USE_YEAR_SQL + " " + dir + " NULLS LAST, x.code NULLS LAST";
            case "intake" -> "(SELECT i.code FROM equipment_intake_lines il JOIN equipment_intakes i ON i.id = il.intake_id"
                    + " WHERE il.id = x.intake_line_id) " + dir + " NULLS LAST, x.code NULLS LAST";
            // Tệp Excel của bảng Từng thiết bị: các dòng của một trường đứng liền nhau.
            case "school" -> "sc.name, c.name, x.code NULLS LAST, x.id";
            default -> "c.name, x.code NULLS LAST";
        };
        String from = """
                FROM equipment x
                JOIN equipment_catalogs c ON c.id = x.catalog_id
                JOIN schools sc ON sc.id = x.school_id
                WHERE TRUE""" + visible.sqlFilter("x.school_id") + where;

        List<Object> paged = new ArrayList<>(args);
        paged.add(size);
        paged.add(start);
        List<Long> ids = jdbc.queryForList("SELECT x.id " + from + " ORDER BY (x.status IN (" + OFF_BOOK_SQL + ")), "
                + order + ", x.id LIMIT ? OFFSET ?", Long.class, paged.toArray());

        Set<Long> scope = visible.current();
        boolean wide = f.schoolId() == null && i.catalogId() == null && i.intakeId() == null
                && (scope == null || scope.size() > 1);
        Supplier<Long> count = () -> {
            Long n = jdbc.queryForObject("SELECT COUNT(*) " + from, Long.class, args.toArray());
            return n == null ? 0L : n;
        };
        long total;
        if (start == 0 && ids.size() < size) {
            // Trang đầu chưa đầy: tổng chính là số dòng vừa đọc, không cần câu đếm.
            total = ids.size();
        } else if (wide) {
            String key = (scope == null ? "*" : new TreeSet<>(scope).toString()) + "|" + from + "|" + args;
            total = countCache.get(key, count);
        } else {
            total = count.get();
        }
        return new ItemPage(details(ids), total);
    }

    /**
     * Nguồn hình thành của một hồ sơ: của chính nó, không có thì của phiếu ghi tăng đã sinh ra nó. Câu trang chỉ đọc
     * bảng {@code equipment} (bí danh {@code x}), nên phiếu đi qua một câu con chỉ chạy khi lọc theo nguồn.
     */
    private static final String ORIGIN_SQL = "COALESCE(x.origin_source_id, (SELECT i.origin_source_id"
            + " FROM equipment_intake_lines il JOIN equipment_intakes i ON i.id = il.intake_id"
            + " WHERE il.id = x.intake_line_id))";

    /** Năm đưa vào sử dụng: khai tay, không có thì năm tiếp nhận. */
    private static final String IN_USE_YEAR_SQL =
            "COALESCE(x.usage_start_year, CAST(EXTRACT(YEAR FROM x.received_date) AS INTEGER))";

    /** Đủ cột của bảng chi tiết cho đúng các id của trang, giữ thứ tự của trang. */
    private List<Map<String, Object>> details(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Object> args = new ArrayList<>();
        args.add(Equipment.STANDARD_CODE_SQL);
        args.addAll(ids);
        Map<Long, Map<String, Object>> byId = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList("""
                SELECT CASE WHEN c.tracking_type = 'BULK' THEN 'bulk' ELSE 'serial' END AS kind,
                       e.id, e.school_id, e.catalog_id, e.room_id, e.code, e.name, COALESCE(e.quantity, 1) AS quantity,
                       e.status, e.legacy_code, e.expiry_date, e.serial_number,
                       COALESCE(e.origin_source_id, i.origin_source_id) AS origin_source_id, os.name AS origin_source_name,
                       COALESCE(e.usage_start_year, CAST(EXTRACT(YEAR FROM e.received_date) AS INTEGER)) AS in_use_year,
                       i.id AS intake_id, i.code AS intake_code,
                       (e.code !~ ?) AS miss_code, (e.unit_id IS NULL) AS miss_unit,
                       (e.funding_source IS NULL) AS miss_funding, (e.received_date IS NULL) AS miss_received,
                       c.code AS catalog_code, c.name AS catalog_name, (c.owner_school_id IS NOT NULL) AS out_of_catalog,
                       u.name AS unit_name,
                       pu.name AS pack_unit_name, e.pack_size,
                       r.name AS room_name, sc.name AS school_name,
                       cp.id AS campus_id, cp.name AS campus_name, cp.is_primary AS campus_main,
                       cp.branch AS campus_branch
                FROM equipment e
                LEFT JOIN units pu ON pu.id = e.pack_unit_id
                JOIN equipment_catalogs c ON c.id = e.catalog_id
                JOIN schools sc ON sc.id = e.school_id
                LEFT JOIN units u ON u.id = COALESCE(e.unit_id, c.unit_id)
                LEFT JOIN rooms r ON r.id = e.room_id
                LEFT JOIN equipment_intake_lines il ON il.id = e.intake_line_id
                LEFT JOIN equipment_intakes i ON i.id = il.intake_id
                LEFT JOIN origin_sources os ON os.id = COALESCE(e.origin_source_id, i.origin_source_id)
                LEFT JOIN campuses cp ON cp.id = """ + FacilityCounting.campusOfRoomSql("e.room_id", "e.school_id") + """
                WHERE e.id IN (""" + String.join(",", Collections.nCopies(ids.size(), "?")) + ")", args.toArray())) {
            byId.put(((Number) r.get("id")).longValue(), r);
        }
        return ids.stream().map(byId::get).filter(r -> r != null).map(EquipmentSummaryService::itemRow).toList();
    }

    /** {@code {id, code, name}} chấp nhận null — {@code Map.of} thì không. */
    private static Map<String, Object> ref(Object id, Object code, Object name) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        if (code != null) {
            m.put("code", code);
        }
        if (name != null) {
            m.put("name", name);
        }
        return m;
    }

    private static Map<String, Object> itemRow(Map<String, Object> r) {
        Long id = ((Number) r.get("id")).longValue();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("kind", r.get("kind"));
        out.put("equipmentId", id);
        out.put("code", r.get("code"));
        out.put("name", r.get("name"));
        out.put("catalog", ref(r.get("catalog_id"), r.get("catalog_code"), r.get("catalog_name")));
        out.put("outOfCatalog", Boolean.TRUE.equals(r.get("out_of_catalog")));
        out.put("room", r.get("room_id") == null ? null : ref(r.get("room_id"), null, r.get("room_name")));
        out.put("school", ref(r.get("school_id"), null, r.get("school_name")));
        // Cơ sở thực (phòng → khối nhà → cơ sở chính), cho cột / nhãn Cơ sở.
        if (r.get("campus_id") == null) {
            out.put("campus", null);
        } else {
            Map<String, Object> campus = ref(r.get("campus_id"), null, r.get("campus_name"));
            campus.put("primary", Boolean.TRUE.equals(r.get("campus_main")));
            campus.put("branch", Boolean.TRUE.equals(r.get("campus_branch")));
            out.put("campus", campus);
        }
        out.put("quantity", r.get("quantity"));
        out.put("unit", r.get("unit_name"));
        out.put("packUnitName", r.get("pack_unit_name"));
        out.put("packSize", r.get("pack_size"));
        out.put("status", r.get("status"));
        out.put("inStore", "IN_STOCK".equals(r.get("status")));
        out.put("legacyCode", r.get("legacy_code"));
        out.put("serialNumber", r.get("serial_number"));
        out.put("originSource", r.get("origin_source_id") == null ? null
                : ref(r.get("origin_source_id"), null, r.get("origin_source_name")));
        out.put("inUseYear", r.get("in_use_year"));
        out.put("expiryDate", r.get("expiry_date") == null ? null : r.get("expiry_date").toString());
        out.put("intake", r.get("intake_id") == null ? null : ref(r.get("intake_id"), r.get("intake_code"), null));
        {
            List<String> missing = new ArrayList<>();
            if (Boolean.TRUE.equals(r.get("miss_code"))) missing.add("mã chuẩn");
            if (Boolean.TRUE.equals(r.get("miss_unit"))) missing.add("đơn vị tính");
            if (Boolean.TRUE.equals(r.get("miss_funding"))) missing.add("nguồn kinh phí");
            if (Boolean.TRUE.equals(r.get("miss_received"))) missing.add("ngày tiếp nhận");
            out.put("profileComplete", missing.isEmpty());
            out.put("missingProfile", missing);
        }
        return out;
    }

    /**
     * Lọc chung của cây bên trái, trên bí danh {@code x} (nguồn gộp: school_id, catalog_id),
     * {@code sc} (trường) và {@code c} (mặt hàng). Dùng cho cả tổng hợp lẫn bảng chi tiết,
     * nên hai màn không thể hiểu một bộ lọc theo hai cách.
     */
    private StringBuilder commonWhere(Filters f, List<Object> args) {
        // Lọc chung trên cột school_id / catalog_id của nguồn x.
        StringBuilder where = new StringBuilder();
        if (f.schoolId() != null) {
            where.append(" AND x.school_id = ? ");
            args.add(f.schoolId());
        }
        if (f.schoolIds() != null && !f.schoolIds().isEmpty()) {
            where.append(" AND x.school_id IN (")
                    .append(f.schoolIds().stream().map(id -> "?").collect(Collectors.joining(","))).append(") ");
            args.addAll(f.schoolIds());
        }
        if (f.schoolBody() != null && !f.schoolBody().isBlank()) {
            if (f.schoolBody().trim().equals("none")) {
                where.append(" AND sc.department_of_education_id IS NULL ");
            } else {
                where.append(" AND sc.department_of_education_id = ? ");
                args.add(Long.parseLong(f.schoolBody().trim()));
            }
        }
        if (f.catalogType() != null && !f.catalogType().isBlank()) {
            if (f.catalogType().trim().equals("none")) {
                where.append(" AND c.equipment_type_id IS NULL ");
            } else {
                where.append(" AND c.equipment_type_id = ? ");
                args.add(Long.parseLong(f.catalogType().trim()));
            }
        }
        if (f.subject() != null && !f.subject().isBlank()) {
            if (f.subject().trim().equals("none")) {
                where.append(" AND c.subject_id IS NULL ");
            } else {
                where.append(" AND c.subject_id = ? ");
                args.add(Long.parseLong(f.subject().trim()));
            }
        }
        if (f.catalogTree() != null) {
            List<Long> ids = catalogs.subtreeIds(f.catalogTree());
            where.append(ids.isEmpty() ? " AND FALSE "
                    : " AND c.id IN (" + ids.stream().map(String::valueOf).collect(Collectors.joining(",")) + ") ");
        }
        // Cơ sở: tài khoản bị giới hạn luôn lọc theo cơ sở của mình, bộ lọc gửi lên không nới được.
        where.append(campusScope.sqlFilter("x.room_id", "x.school_id", campusScope.effectiveFilter(f.campusId()), args));
        codes(where, args, "x.status", f.assetStatus());
        codes(where, args, "x.condition", f.condition());
        if ("in".equals(f.catalogScope())) {
            where.append(" AND c.owner_school_id IS NULL ");
        } else if ("out".equals(f.catalogScope())) {
            where.append(" AND c.owner_school_id IS NOT NULL ");
        }
        if (f.q() != null && !f.q().isBlank()) {
            // Không phân biệt dấu, cùng phép với ô tìm của danh mục (ListParams.foldedLike).
            where.append(" AND (").append(folded("c.name")).append(" LIKE ? OR ").append(folded("c.code"))
                    .append(" LIKE ?) ");
            String pattern = "%" + ListParams.fold(f.q().trim()) + "%";
            args.add(pattern);
            args.add(pattern);
        }
        return where;
    }

    /**
     * {@code column IN (...)} cho một danh sách mã cách nhau bằng dấu phẩy (bộ lọc nâng cao). Chỉ nhận mã dạng
     * {@code A_Z}; có giá trị mà không mã nào hợp lệ thì không ra dòng nào thay vì bỏ qua bộ lọc.
     */
    private static void codes(StringBuilder where, List<Object> args, String column, String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        List<String> values = Arrays.stream(raw.split(","))
                .map(v -> v.trim().toUpperCase()).filter(v -> v.matches("[A-Z_]+")).distinct().toList();
        if (values.isEmpty()) {
            where.append(" AND FALSE ");
            return;
        }
        where.append(" AND ").append(column).append(" IN (")
                .append(String.join(",", Collections.nCopies(values.size(), "?"))).append(") ");
        args.addAll(values);
    }

    /** Bỏ dấu tiếng Việt trong SQL — vế SQL của {@link ListParams#fold}. */
    private static String folded(String column) {
        return "translate(lower(" + column + "), '" + ListParams.VN_ACCENTED + "', '" + ListParams.VN_PLAIN + "')";
    }
}
