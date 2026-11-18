package com.g123.sfems.module.school.overview;

import com.g123.sfems.shared.web.HeavyQuery;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.organization.school.repo.SchoolRepository;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.Permissions;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.JoinType;
import java.math.BigDecimal;
import java.sql.Array;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Số liệu tổng hợp cho màn "Tổng quan trường học": mỗi trường một dòng đếm
 * cán bộ, cơ sở vật chất, thiết bị và giá trị — cho Sở so sánh các trường,
 * cho trường xem nhanh trường mình.
 *
 * <p><b>Phạm vi</b>: chỉ các trường mà người gọi ĐỌC ĐƯỢC qua phân quyền dòng
 * của {@code schools} (Sở: mọi trường, cán bộ trường: trường mình). Các phép
 * đếm là SQL gộp theo {@code school_id} trong đúng tập trường đó — không đọc
 * dòng nào ngoài các trường người gọi đã được phép thấy.
 */
@HeavyQuery
@RestController
@RequestMapping("/api/school_overview")
public class SchoolOverviewController {

    private final SchoolRepository schools;
    private final RowLevelSecurity rowLevel;
    private final JdbcTemplate jdbc;
    private final CampusScope campusScope;

    public SchoolOverviewController(SchoolRepository schools, RowLevelSecurity rowLevel, JdbcTemplate jdbc,
            CampusScope campusScope) {
        this.schools = schools;
        this.rowLevel = rowLevel;
        this.jdbc = jdbc;
        this.campusScope = campusScope;
    }

    public record SchoolStats(
            Long id,
            String code,
            String name,
            String ward,
            long staff,
            long campuses,
            long buildings,
            long rooms,
            /**
             * Số THIẾT BỊ trên sổ = số hồ sơ (một tài sản = 1, một lô vật tư = 1), bỏ hồ sơ đã ra khỏi
             * sổ — cùng phép đếm với cột trái và bảng Chi tiết của màn Thiết bị. Không cộng số lượng:
             * 12 bình hoá chất và 9.800 tờ giấy cộng vào ra một con số "thiết bị" không ai đối chiếu được.
             */
            long equipment,
            long equipmentBroken,
            long pendingLiquidation,
            BigDecimal equipmentValue,
            /** Lớp học đang hoạt động của NĂM HỌC HIỆN HÀNH, và tổng sĩ số của chúng. */
            long classes,
            long students) {
    }

    /**
     * @param schools một TRANG các trường, không phải toàn bộ
     * @param totals  số liệu gộp trên TOÀN BỘ phạm vi người gọi đọc được — cố ý
     *                không tính từ {@code schools}: tổng của trang một không
     *                phải tổng của ngành, và một con số sai kiểu đó không ai
     *                nhìn ra bằng mắt
     * @param total   tổng số trường trong phạm vi, để giao diện biết còn bao
     *                nhiêu chưa tải
     */
    public record Overview(List<SchoolStats> schools, SchoolStats totals, long total) {
    }

    /**
     * Một trang của bảng tổng quan.
     *
     * <p>Trước đây trả về TOÀN BỘ trường trong một lần gọi. Với 1.162 trường
     * thì đó là một payload lớn, một cây bên trái dựng hơn nghìn nút, và một
     * bảng bên phải không ai cuộn tới cuối — chưa kể yêu cầu 3.600 người dùng
     * đồng thời ở mục 3.4.
     *
     * <p>Tham số giữ đúng phương ngữ mà data provider đang dùng ở các resource
     * khác ({@code _start}, {@code _end}, {@code q}), nên phía giao diện không
     * phải học thêm một quy ước thứ hai.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_READ + "')")
    @Transactional(readOnly = true)
    public ResponseEntity<Overview> overview(
            @RequestParam(name = "_start", defaultValue = "0") int start,
            @RequestParam(name = "_end", defaultValue = "50") int end,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "body", required = false) String body,
            @RequestParam(name = "sort", defaultValue = "name") String sort) {

        Specification<School> spec = rowLevel.scope(School.class, Action.READ);
        if (body != null && !body.isBlank()) {
            // Trường của MỘT cơ quan quản lý ("null" = chưa xác định cơ quan) — khi mở một cơ quan ở lưới, để
            // thẻ trường có số liệu như ở chế độ tìm. Ghép AND sau phạm vi dòng, không nới được.
            Long bodyId = "null".equals(body.trim()) ? null : Long.valueOf(body.trim());
            spec = spec.and((root, query, cb) -> bodyId == null
                    ? cb.isNull(root.get("departmentOfEducation"))
                    : cb.equal(root.get("departmentOfEducation").get("id"), bodyId));
        }
        Specification<School> term = search(q);
        if (term != null) {
            // `and` chứ không phải `or`: phạm vi dòng đứng trước, và không có
            // phép trừ nào để một từ khoá nới rộng nó ra.
            spec = spec.and(term);
        }

        long total = schools.count(spec);
        if (total == 0) {
            return withCount(new Overview(List.of(), empty(), 0), 0);
        }

        int size = Math.max(1, Math.min(end - start, MAX_PAGE));
        String metric = SORT_METRICS.get(sort);
        List<School> visible;
        if (metric == null) {
            visible = schools.findAll(spec, PageRequest.of(start / size, size, Sort.by("name", "id"))).getContent();
        } else {
            // Xếp theo một con số (thiết bị, hỏng, phòng, cán bộ): con số không nằm trên bảng trường nên
            // không xếp được bằng Sort — tính cho CẢ phạm vi (vài trăm trường, một câu gộp), xếp, rồi cắt trang.
            Long[] all = scopeIds(spec);
            Map<Long, Long> value = count(metric, all);
            List<Long> page = Arrays.stream(all)
                    .sorted(Comparator.comparing((Long id) -> value.getOrDefault(id, 0L)).reversed()
                            .thenComparing(id -> id))
                    .skip(start)
                    .limit(size)
                    .toList();
            Map<Long, School> byId = new HashMap<>();
            schools.findAll(spec.and((root, query, cb) -> root.get("id").in(page))).forEach(x -> byId.put(x.getId(), x));
            visible = page.stream().map(byId::get).filter(Objects::nonNull).toList();
        }
        if (visible.isEmpty()) {
            return withCount(new Overview(List.of(), totalsOf(scopeIds(spec)), total), total);
        }
        Long[] ids = visible.stream().map(School::getId).toArray(Long[]::new);

        Pin pin = pin();
        Map<Long, Long> staff = count("SELECT school_id, count(*) FROM staff WHERE school_id = ANY(?)" + pin.staff()
                + " GROUP BY school_id", ids);
        Map<Long, Long> campuses = count("SELECT school_id, count(*) FROM campuses WHERE school_id = ANY(?)"
                + pin.campuses() + " GROUP BY school_id", ids);
        Map<Long, Long> buildings = count("SELECT school_id, count(*) FROM buildings WHERE school_id = ANY(?)"
                + pin.buildings() + " GROUP BY school_id", ids);
        Map<Long, Long> rooms = count("SELECT school_id, count(*) FROM rooms WHERE school_id = ANY(?)" + pin.rooms()
                + " GROUP BY school_id", ids);

        Map<Long, long[]> classes = new HashMap<>();
        withArray(ids, array -> jdbc.query(
                // Một nguồn với mọi số CSVC: lớp năm học hiện hành (FacilityCounting).
                "SELECT cl.school_id, cl.classes, coalesce(cl.students, 0) FROM (" + pin.classCounts()
                        + ") cl WHERE cl.school_id = ANY(?)",
                rs -> {
                    classes.put(rs.getLong(1), new long[] {rs.getLong(2), rs.getLong(3)});
                },
                array));
        Map<Long, long[]> equipment = new HashMap<>();
        Map<Long, BigDecimal> value = new HashMap<>();
        withArray(ids, array -> jdbc.query(
                "SELECT school_id, count(*),"
                        + " count(*) FILTER (WHERE " + Equipment.brokenSql("") + "),"
                        + " count(*) FILTER (WHERE status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')),"
                        + " coalesce(sum(original_value), 0)"
                        + " FROM equipment WHERE school_id = ANY(?) AND status NOT IN " + OFF_BOOK + pin.equipment()
                        + " GROUP BY school_id",
                rs -> {
                    long sid = rs.getLong(1);
                    equipment.put(sid, new long[] {rs.getLong(2), rs.getLong(3), rs.getLong(4)});
                    value.put(sid, rs.getBigDecimal(5));
                },
                array));

        List<SchoolStats> rows = new ArrayList<>();
        for (School s : visible) {
            long[] e = equipment.getOrDefault(s.getId(), new long[3]);
            long[] c = classes.getOrDefault(s.getId(), new long[2]);
            rows.add(new SchoolStats(s.getId(), s.getCode(), s.getName(), s.getWard() == null ? s.getWardText() : s.getWard().getName(),
                    staff.getOrDefault(s.getId(), 0L), campuses.getOrDefault(s.getId(), 0L),
                    buildings.getOrDefault(s.getId(), 0L), rooms.getOrDefault(s.getId(), 0L),
                    e[0], e[1], e[2], value.getOrDefault(s.getId(), BigDecimal.ZERO), c[0], c[1]));
        }
        // Tổng của toàn phạm vi, không phải của trang. Lấy riêng danh sách id
        // bằng projection nên chỉ đọc một cột, không dựng lại cả đồ thị thực thể.
        return withCount(new Overview(rows, totalsOf(scopeIds(spec)), total), total);
    }

    /**
     * Một cơ quan quản lý trong phạm vi người gọi, kèm số trường nó quản lý.
     *
     * @param id    rỗng ở đúng một dòng: nhóm trường CHƯA XÁC ĐỊNH cơ quan chủ
     *              quản, không phải một cơ quan có thật
     * @param type  SO, UBND, hoặc UNASSIGNED cho dòng rỗng nói trên — cùng vốn
     *              từ với {@code ManagingBodyType}, để giao diện nói được "Sở"
     *              hay "UBND" mà không phải tra thêm
     * @param schools số trường thuộc cơ quan này VÀ nằm trong phạm vi dữ liệu
     *                của người gọi, không phải tổng số trường của nó
     */
    public record BodyRow(
            Long id,
            String code,
            String name,
            String type,
            long schools,
            long staff,
            long rooms,
            long equipment,
            long equipmentBroken) {
    }

    /**
     * Các cơ quan quản lý CÓ trường trong phạm vi người gọi.
     *
     * <p>Đây là tầng giữa của cây tổng quan: Sở → cơ quan quản lý → trường.
     * Chỉ trả về cơ quan có ít nhất một trường, vì 168 UBND mà phần lớn rỗng
     * là một cây không ai cuộn nổi và không nói lên điều gì.
     *
     * <p>Số trường đếm TRONG phạm vi dữ liệu của người gọi, nên một cán bộ
     * trường thấy đúng cơ quan quản lý của trường mình với số 1 — không phải
     * số thật của cơ quan đó. Trả về số thật sẽ là tiết lộ dữ liệu ngoài phạm
     * vi bằng một con số.
     */
    @GetMapping("/bodies")
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_READ + "')")
    @Transactional(readOnly = true)
    public List<BodyRow> bodies() {
        Long[] ids = scopeIds(rowLevel.scope(School.class, Action.READ));
        if (ids.length == 0) {
            return List.of();
        }
        List<BodyRow> out = new ArrayList<>();
        // Đếm bằng truy vấn con gộp sẵn theo trường rồi mới cộng lên cơ quan.
        // Nối thẳng bốn bảng con vào `schools` sẽ nhân dòng chéo nhau — một
        // trường có 3 phòng và 4 cán bộ sẽ ra 12 dòng, và mọi con số nở ra
        // theo cách không ai nhìn bằng mắt mà thấy được.
        withArray(ids, array -> jdbc.query(
                "SELECT d.id, d.code, d.name, d.type, count(*),"
                        + " coalesce(sum(st.n), 0), coalesce(sum(rm.n), 0),"
                        + " coalesce(sum(eq.units), 0), coalesce(sum(eq.broken), 0)"
                        + " FROM schools s"
                        + " JOIN departments_of_education d"
                        + "   ON d.id = s.department_of_education_id"
                        + " LEFT JOIN (SELECT school_id, count(*) n FROM staff GROUP BY school_id) st"
                        + "   ON st.school_id = s.id"
                        + " LEFT JOIN (SELECT school_id, count(*) n FROM rooms GROUP BY school_id) rm"
                        + "   ON rm.school_id = s.id"
                        + " LEFT JOIN (SELECT school_id, count(*) units,"
                        + "                   count(*) FILTER (WHERE " + Equipment.brokenSql("") + ") broken"
                        + "            FROM equipment WHERE status NOT IN " + OFF_BOOK
                        + "            GROUP BY school_id) eq"
                        + "   ON eq.school_id = s.id"
                        + " WHERE s.id = ANY(?)"
                        + " GROUP BY d.id, d.code, d.name, d.type"
                        // Sở trước UBND, rồi theo tên: người đọc tìm Sở ở trên
                        // cùng, còn 168 UBND thì tìm theo tên.
                        + " ORDER BY CASE d.type WHEN 'SO' THEN 0 ELSE 1 END, d.name",
                rs -> {
                    out.add(new BodyRow(rs.getLong(1), rs.getString(2), rs.getString(3),
                            rs.getString(4), rs.getLong(5), rs.getLong(6), rs.getLong(7),
                            rs.getLong(8), rs.getLong(9)));
                },
                array));

        // Nhóm chưa xác định, ở CUỐI và chỉ khi có. Nó không phải một cơ quan,
        // nhưng nếu không có dòng này thì những trường ấy biến mất khỏi cây —
        // tổng các nhánh không bằng tổng số trường, và không ai thấy rằng còn
        // một việc phải làm. Một con số nói thẳng là cách duy nhất để việc dở
        // dang ấy được xử lý.
        withArray(ids, array -> jdbc.query(
                "SELECT count(*) FROM schools s"
                        + " WHERE s.id = ANY(?) AND s.department_of_education_id IS NULL",
                rs -> {
                    long n = rs.getLong(1);
                    if (n > 0) {
                        out.add(new BodyRow(null, UNASSIGNED, "Chưa xác định cơ quan quản lý",
                                UNASSIGNED, n, 0, 0, 0, 0));
                    }
                },
                array));
        return out;
    }

    /** Hồ sơ đã ra khỏi sổ (thanh lý, ghi giảm do mất, vật tư đã dùng hết) — không đếm là thiết bị của trường. */
    private static final String OFF_BOOK = "('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED')";

    /** Các cách xếp danh sách trường ngoài "theo tên": tên tham số → câu đếm theo trường. */
    private static final Map<String, String> SORT_METRICS = Map.of(
            "equipment", "SELECT school_id, count(*) FROM equipment WHERE school_id = ANY(?) AND status NOT IN "
                    + OFF_BOOK + " GROUP BY school_id",
            "broken", "SELECT school_id, count(*) FROM equipment WHERE school_id = ANY(?) AND status NOT IN "
                    + OFF_BOOK + " AND " + Equipment.brokenSql("") + " GROUP BY school_id",
            "rooms", "SELECT school_id, count(*) FROM rooms WHERE school_id = ANY(?) GROUP BY school_id",
            "staff", "SELECT school_id, count(*) FROM staff WHERE school_id = ANY(?) GROUP BY school_id");

    /** Mã của nhóm "chưa xác định" — không phải một {@code ManagingBodyType}. */
    private static final String UNASSIGNED = "UNASSIGNED";

    /**
     * Số liệu của MỘT trường, cho trang riêng của trường đó.
     *
     * <p>Trước đây màn Tổng quan là hai cột và khung bên phải lấy số liệu từ
     * dòng tương ứng của danh sách đã tải. Khi mỗi bản ghi có trang riêng thì
     * không còn danh sách nào để lấy — trang mở thẳng từ URL, có thể là lần
     * đầu tiên trong phiên.
     *
     * <p>Đi qua phạm vi dòng như mọi đường đọc khác, nên một trường ngoài phạm
     * vi trả 404 chứ không phải số 0: id của trường không được phép đọc không
     * nên phân biệt được với id không tồn tại.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + Permissions.SCHOOLS_READ + "')")
    @Transactional(readOnly = true)
    public SchoolStats one(@PathVariable Long id) {
        Specification<School> spec = rowLevel.scope(School.class, Action.READ)
                .and((root, query, cb) -> cb.equal(root.get("id"), id));
        School school = schools.findAll(spec, PageRequest.of(0, 1)).stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Trường", id));
        SchoolStats t = totalsOf(new Long[] {school.getId()});
        return new SchoolStats(
                school.getId(),
                school.getCode(),
                school.getName(),
                school.getWard() == null ? school.getWardText() : school.getWard().getName(),
                t.staff(), t.campuses(), t.buildings(), t.rooms(),
                t.equipment(), t.equipmentBroken(), t.pendingLiquidation(),
                t.equipmentValue(), t.classes(), t.students());
    }

    /** Trần một trang, để một tham số `_end` bất thường không kéo về cả ngành. */
    private static final int MAX_PAGE = 200;

    private static ResponseEntity<Overview> withCount(Overview body, long total) {
        // Cùng header mà mọi danh sách khác dùng, và nó đã nằm trong
        // Access-Control-Expose-Headers — không thêm thứ gì để quên phơi ra.
        return ResponseEntity.ok().header("X-Total-Count", Long.toString(total)).body(body);
    }

    /**
     * Id của mọi trường trong phạm vi, đọc bằng projection một cột.
     *
     * <p>Cần nó vì {@code totals} phải gộp trên toàn phạm vi, mà phạm vi là một
     * {@code Specification} nên không viết thẳng được vào SQL gộp.
     */
    private Long[] scopeIds(Specification<School> spec) {
        return schools.findBy(spec, fluent -> fluent.project("id").all()).stream()
                .map(School::getId)
                .toArray(Long[]::new);
    }

    /** Tìm nhanh trên mã, tên và địa bàn — cùng các cột mà danh sách trường tìm. */
    private static Specification<School> search(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        // Không phân biệt dấu: gõ "binh an" phải ra "Bình An", như ô tìm của danh sách trường.
        String term = q.trim();
        return (root, query, cb) -> cb.or(
                ListParams.foldedLike(cb, root.get("code"), term),
                ListParams.foldedLike(cb, root.get("name"), term),
                ListParams.foldedLike(cb, root.join("ward", JoinType.LEFT).get("name"), term),
                ListParams.foldedLike(cb, root.get("wardText"), term));
    }

    /** Số liệu gộp trên một tập trường, bằng SQL gộp chứ không cộng dồn ở Java. */
    private SchoolStats totalsOf(Long[] ids) {
        if (ids.length == 0) {
            return empty();
        }
        Pin pin = pin();
        long staff = sum("SELECT count(*) FROM staff WHERE school_id = ANY(?)" + pin.staff(), ids);
        long campuses = sum("SELECT count(*) FROM campuses WHERE school_id = ANY(?)" + pin.campuses(), ids);
        long buildings = sum("SELECT count(*) FROM buildings WHERE school_id = ANY(?)" + pin.buildings(), ids);
        long rooms = sum("SELECT count(*) FROM rooms WHERE school_id = ANY(?)" + pin.rooms(), ids);
        long[] cls = new long[2];
        withArray(ids, array -> jdbc.query(
                "SELECT coalesce(sum(cl.classes), 0), coalesce(sum(cl.students), 0) FROM ("
                        + pin.classCounts() + ") cl WHERE cl.school_id = ANY(?)",
                rs -> {
                    cls[0] = rs.getLong(1);
                    cls[1] = rs.getLong(2);
                },
                array));

        long[] eq = new long[3];
        BigDecimal[] value = {BigDecimal.ZERO};
        withArray(ids, array -> jdbc.query(
                "SELECT count(*),"
                        + " count(*) FILTER (WHERE " + Equipment.brokenSql("") + "),"
                        + " count(*) FILTER (WHERE status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')),"
                        + " coalesce(sum(original_value), 0)"
                        + " FROM equipment WHERE school_id = ANY(?) AND status NOT IN " + OFF_BOOK + pin.equipment(),
                rs -> {
                    eq[0] = rs.getLong(1);
                    eq[1] = rs.getLong(2);
                    eq[2] = rs.getLong(3);
                    value[0] = rs.getBigDecimal(4);
                },
                array));

        return new SchoolStats(null, null, "Tổng", null, staff, campuses, buildings, rooms,
                eq[0], eq[1], eq[2], value[0] == null ? BigDecimal.ZERO : value[0], cls[0], cls[1]);
    }

    /**
     * Vế lọc theo cơ sở của tài khoản bị giới hạn (271) — chỉ số của cơ sở mình; không giới hạn thì rỗng. Bảng không
     * đặt bí danh nên vế gọi cột bằng tên bảng ({@code staff.campus_id}…).
     */
    private record Pin(Long campus) {

        private String c() {
            return String.valueOf(campus.longValue());
        }

        String staff() {
            return campus == null ? " " : FacilityCounting.ownCampusInSql("staff.campus_id", "staff.school_id", c());
        }

        String campuses() {
            return campus == null ? " " : FacilityCounting.ownCampusInSql("campuses.id", "campuses.school_id", c());
        }

        String buildings() {
            return campus == null ? " "
                    : FacilityCounting.ownCampusInSql("buildings.campus_id", "buildings.school_id", c());
        }

        String rooms() {
            return campus == null ? " " : FacilityCounting.roomInCampusSql("rooms.id", "rooms.school_id", c());
        }

        String equipment() {
            return campus == null ? " "
                    : FacilityCounting.roomInCampusSql("equipment.room_id", "equipment.school_id", c());
        }

        String classCounts() {
            return campus == null ? FacilityCounting.CLASS_COUNTS : FacilityCounting.classCountsOf(campus);
        }
    }

    private Pin pin() {
        return new Pin(campusScope.pinnedCampusId());
    }

    private long sum(String sql, Long[] ids) {
        long[] out = {0};
        // Khối chứ không phải biểu thức: một lambda trả giá trị khớp cả
        // RowCallbackHandler lẫn ResultSetExtractor, và trình biên dịch không
        // chọn được.
        withArray(ids, array -> jdbc.query(sql, rs -> {
            out[0] = rs.getLong(1);
        }, array));
        return out[0];
    }

    private Map<Long, Long> count(String sql, Long[] ids) {
        Map<Long, Long> out = new HashMap<>();
        withArray(ids, array -> jdbc.query(sql, rs -> {
            out.put(rs.getLong(1), rs.getLong(2));
        }, array));
        return out;
    }

    private void withArray(Long[] ids, java.util.function.Consumer<Array> body) {
        jdbc.execute((ConnectionCallback<Void>) con -> {
            Array array = con.createArrayOf("bigint", ids);
            try {
                body.accept(array);
            } finally {
                array.free();
            }
            return null;
        });
    }

    private static SchoolStats empty() {
        return new SchoolStats(null, null, "Tổng", null, 0, 0, 0, 0, 0, 0, 0, BigDecimal.ZERO, 0, 0);
    }
}
