package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.facility.Building;
import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.school.team.SubjectTeam;
import com.g123.sfems.module.catalog.base.CampusRule;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/**
 * Phạm vi CƠ SỞ (270): tài khoản trường có {@code user_schools.campus_id} chỉ thấy, chỉ sửa dữ liệu CSVC / thiết bị
 * của cơ sở đó; trống = cả trường. Áp SAU phạm vi dòng (trường), qua {@link CampusRule} mà {@code CatalogService}
 * gọi ở mọi đường đọc / ghi.
 *
 * <p><b>Cơ sở thực</b> theo đúng luật của {@link FacilityCounting#campusJoins}: phòng → cơ sở ghi trên phòng, không thì
 * của khối nhà; cơ sở đó đã xoá / khác trường → cơ sở chính. Bản ghi gắn phòng (lớp, thiết bị, tồn kho) theo phòng;
 * không có phòng → cơ sở chính. Trường chưa có cơ sở chính thì dòng "không cơ sở" không thuộc cơ sở nào được giao.
 *
 * <p>Lọc bằng {@code IN (id phòng / khối nhà)}: tập id của một cơ sở tính MỘT lần mỗi yêu cầu (vài trăm phòng một
 * trường), ghi nhớ trong thuộc tính của request. Kiểm ghi chạy trên thực thể trong bộ nhớ (chưa flush vẫn đúng).
 */
@Component
public class CampusScope {

    /** Lời từ chối ghi ngoài cơ sở. */
    static final String OUTSIDE = "Không thuộc cơ sở của tài khoản";

    private static final String MEMO = CampusScope.class.getName() + ".";

    private final JdbcTemplate jdbc;
    private final RowLevelPrincipalResolver principals;

    public CampusScope(JdbcTemplate jdbc, RowLevelPrincipalResolver principals) {
        this.jdbc = jdbc;
        this.principals = principals;
    }

    /** Cơ sở mà người gọi bị giới hạn trong, hoặc {@code null} — không giới hạn (cả trường, Sở, việc nền). */
    public Long pinnedCampusId() {
        return principals.current().map(RowLevelPrincipal::campusId).orElse(null);
    }

    /**
     * Cơ sở cần lọc cho một màn: người gọi bị giới hạn thì luôn là cơ sở của họ (bộ lọc gửi lên không nới được);
     * không thì cơ sở đang chọn trên bộ lọc, hoặc {@code null}.
     */
    public Long effectiveFilter(Long requested) {
        Long pinned = pinnedCampusId();
        return pinned != null ? pinned : requested;
    }

    // ------------------------------------------------------------------ rule theo loại

    public CampusRule<Campus> campuses() {
        return new Rule<>("campus", self(Kind.CAMPUS_SELF), null, c -> c.getId(), null);
    }

    public CampusRule<Building> buildings() {
        return new Rule<>("campus", self(Kind.BUILDING), null, this::campusOf, null);
    }

    public CampusRule<Room> rooms() {
        return new Rule<>("campus", self(Kind.ROOM), null, this::campusOf, null);
    }

    /** Cán bộ (271): cơ sở làm việc ghi trên hồ sơ; trống / đã ngừng → cơ sở chính. */
    public CampusRule<Staff> staff() {
        return new Rule<>("campus", List.of(new Step("campus", Kind.CAMPUS)), null,
                s -> effective(s.getCampus(), s.getSchool()), null);
    }

    /** Tổ chuyên môn: theo cơ sở của tổ trưởng; chưa có tổ trưởng → cơ sở chính. */
    public CampusRule<SubjectTeam> subjectTeams() {
        return new Rule<>("leader", List.of(new Step("leader.campus", Kind.CAMPUS)), null,
                t -> t.getLeader() == null ? mainCampusId(t.getSchool())
                        : effective(t.getLeader().getCampus(), t.getSchool()),
                null);
    }

    /** Bản ghi gắn MỘT phòng ({@code room}): lớp, thiết bị, tồn kho. Không phòng → cơ sở chính. */
    public <T> CampusRule<T> byRoom(Function<T, Room> room, Function<T, School> school) {
        return new Rule<>("room", List.of(new Step("room", Kind.ROOM)), null,
                item -> room.apply(item) != null ? campusOf(room.apply(item), school.apply(item))
                        : mainCampusId(school.apply(item)),
                null);
    }

    // ------------------------------------------------------------------ cho phiếu (VoucherCampus)

    /** Một cơ sở còn dùng của trường — nhãn Cơ sở trên danh sách phiếu. */
    public record CampusLabel(Long id, String name, boolean primary, boolean branch) {
    }

    /** Id các phòng có cơ sở thực là {@code campusId} (tính một lần mỗi yêu cầu). */
    public Set<Long> roomIdsOf(long campusId) {
        return ids(Kind.ROOM, campusId);
    }

    /** Cơ sở {@code campusId} là cơ sở chính còn dùng — nhận các bản ghi không suy ra được cơ sở. */
    public boolean isMainCampus(long campusId) {
        return isMain(campusId);
    }

    /** Trường của một cơ sở. */
    public Long schoolOfCampus(long campusId) {
        return memo("school." + campusId, () -> jdbc.queryForList(
                "SELECT school_id FROM campuses WHERE id = ?", Long.class, campusId).stream().findFirst())
                .orElse(null);
    }

    /** Cơ sở thực của một phòng (theo trường của phòng). */
    public Long campusOfRoom(Room room) {
        return room == null ? null : campusOf(room, room.getSchool());
    }

    /** Cơ sở thực của một thiết bị: theo phòng, không phòng → cơ sở chính của trường. */
    public Long campusOfEquipment(Equipment item) {
        if (item == null) {
            return null;
        }
        return item.getRoom() != null ? campusOf(item.getRoom(), item.getSchool()) : mainCampusId(item.getSchool());
    }

    /** Cơ sở mà người gọi bị giới hạn trong, nếu cơ sở đó thuộc trường {@code schoolId}; không thì {@code null}. */
    public Long pinnedCampusIn(Long schoolId) {
        Long pinned = pinnedCampusId();
        return pinned != null && Objects.equals(schoolOfCampus(pinned), schoolId) ? pinned : null;
    }

    /** Các cơ sở còn dùng của trường, cơ sở chính trước. */
    public List<CampusLabel> activeCampuses(Long schoolId) {
        if (schoolId == null) {
            return List.of();
        }
        return memo("active." + schoolId, () -> List.copyOf(jdbc.query(
                "SELECT id, name, is_primary, branch FROM campuses WHERE school_id = ? AND active"
                        + " ORDER BY is_primary DESC, sort_order NULLS LAST, name",
                (rs, n) -> new CampusLabel(rs.getLong(1), rs.getString(2), rs.getBoolean(3), rs.getBoolean(4)),
                schoolId)));
    }

    // ------------------------------------------------------------------ SQL thuần

    /**
     * Vế {@code AND …} cho SQL thuần trên bản ghi có phòng {@code roomIdExpr} và trường {@code schoolIdExpr}: thuộc
     * cơ sở {@code campusId}; {@code null} thì chuỗi rỗng. Đẩy tham số vào {@code args}.
     */
    public String sqlFilter(String roomIdExpr, String schoolIdExpr, Long campusId, List<Object> args) {
        if (campusId == null) {
            return " ";
        }
        args.add(campusId);
        return FacilityCounting.roomInCampusSql(roomIdExpr, schoolIdExpr, "?");
    }

    // ------------------------------------------------------------------ tính cơ sở trong bộ nhớ

    private Long campusOf(Room room) {
        return campusOf(room, room.getSchool());
    }

    private Long campusOf(Room room, School school) {
        Campus own = room.getCampus() != null ? room.getCampus()
                : room.getBuilding() != null ? room.getBuilding().getCampus() : null;
        return effective(own, school);
    }

    private Long campusOf(Building building) {
        return effective(building.getCampus(), building.getSchool());
    }

    private Long campusOf(Building building, School school) {
        return effective(building.getCampus(), school);
    }

    /** Cơ sở còn dùng, cùng trường → chính nó; không thì cơ sở chính của trường (có thể null). */
    private Long effective(Campus own, School school) {
        if (own != null && Boolean.TRUE.equals(own.getActive()) && school != null
                && own.getSchool().getId().equals(school.getId())) {
            return own.getId();
        }
        return mainCampusId(school);
    }

    private Long mainCampusId(School school) {
        if (school == null) {
            return null;
        }
        return memo("main." + school.getId(), () -> jdbc.queryForList(
                "SELECT id FROM campuses WHERE school_id = ? AND is_primary AND active", Long.class, school.getId())
                .stream().findFirst()).orElse(null);
    }

    // ------------------------------------------------------------------ tập id của một cơ sở

    private enum Kind { ROOM, BUILDING, CAMPUS, CAMPUS_SELF }

    /** Một liên kết mà cơ sở của bản ghi suy ra từ đó; {@code attr == null} = chính bản ghi. */
    private record Step(String attr, Kind kind) {
    }

    private static List<Step> self(Kind kind) {
        return List.of(new Step(null, kind));
    }

    private Set<Long> ids(Kind kind, long campusId) {
        return memo(kind + "." + campusId, () -> switch (kind) {
            case ROOM -> idSet("SELECT x.room_id FROM (" + FacilityCounting.ROOM_CAMPUS + ") x"
                    + " WHERE x.campus_id = ? AND x.school_id = (SELECT school_id FROM campuses WHERE id = ?)", campusId);
            case BUILDING -> idSet("SELECT x.building_id FROM (" + FacilityCounting.BUILDING_CAMPUS + ") x"
                    + " WHERE x.campus_id = ? AND x.school_id = (SELECT school_id FROM campuses WHERE id = ?)", campusId);
            case CAMPUS -> idSet("SELECT x.campus_id FROM (" + FacilityCounting.CAMPUS_CAMPUS + ") x"
                    + " WHERE x.effective_id = ? AND x.school_id = (SELECT school_id FROM campuses WHERE id = ?)", campusId);
            case CAMPUS_SELF -> Set.of(campusId);
        });
    }

    private Set<Long> idSet(String sql, long campusId) {
        return Set.copyOf(new HashSet<>(jdbc.queryForList(sql, Long.class, campusId, campusId)));
    }

    /** Cơ sở {@code campusId} là cơ sở chính (còn dùng) — bản ghi không suy ra được cơ sở thuộc về nó. */
    private boolean isMain(long campusId) {
        return memo("isMain." + campusId, () -> Boolean.TRUE.equals(jdbc.query(
                "SELECT is_primary AND active FROM campuses WHERE id = ?",
                rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE, campusId)));
    }

    @SuppressWarnings("unchecked")
    private <V> V memo(String key, Supplier<V> load) {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request == null) {
            return load.get();
        }
        Object cached = request.getAttribute(MEMO + key, RequestAttributes.SCOPE_REQUEST);
        if (cached != null) {
            return (V) cached;
        }
        V value = load.get();
        request.setAttribute(MEMO + key, value, RequestAttributes.SCOPE_REQUEST);
        return value;
    }

    // ------------------------------------------------------------------ dựng predicate

    /** Vế dự phòng khi mọi liên kết của chuỗi đều trống — mặc định: thuộc cơ sở chính. */
    @FunctionalInterface
    private interface Fallback {
        Predicate build(Root<?> root, CriteriaQuery<?> query, CriteriaBuilder cb,
                long campusId);
    }

    /** Cơ sở trong bộ nhớ khi sửa có luật riêng (kế hoạch nhiều thiết bị). */
    @FunctionalInterface
    private interface Writable<T> {
        boolean test(T item, long pinned);
    }

    /** {@code ref} (một phòng, có thể trống) thuộc cơ sở; {@code nullIsMain}: phòng trống tính cơ sở chính. */
    private Predicate roomPredicate(Path<?> ref, CriteriaBuilder cb, long campusId, boolean nullIsMain) {
        Set<Long> rooms = ids(Kind.ROOM, campusId);
        Predicate hit = rooms.isEmpty() ? cb.disjunction() : ref.get("id").in(rooms);
        if (nullIsMain && isMain(campusId)) {
            return cb.or(cb.and(cb.isNotNull(ref), hit), cb.isNull(ref));
        }
        return cb.and(cb.isNotNull(ref), hit);
    }

    /** {@code a.b}: đi qua liên kết {@code a} bằng LEFT JOIN — {@code a} trống thì {@code b} trống (không mất dòng). */
    private static Path<?> path(Root<?> root, String attr) {
        int dot = attr.indexOf('.');
        return dot < 0 ? root.get(attr) : root.join(attr.substring(0, dot), JoinType.LEFT).get(attr.substring(dot + 1));
    }

    private final class Rule<T> implements CampusRule<T> {

        private final String field;
        private final List<Step> steps;
        private final Fallback fallback;
        private final Function<T, Long> campusOf;
        private final Writable<T> writable;

        Rule(String field, List<Step> steps, Fallback fallback, Function<T, Long> campusOf, Writable<T> writable) {
            this.field = field;
            this.steps = steps;
            this.fallback = fallback;
            this.campusOf = campusOf;
            this.writable = writable;
        }

        @Override
        public Specification<T> pinned() {
            return (root, query, cb) -> {
                Long pinned = pinnedCampusId();
                return pinned == null ? null : predicate(root, query, cb, pinned);
            };
        }

        @Override
        public Specification<T> inCampus(long campusId) {
            return (root, query, cb) -> predicate(root, query, cb, campusId);
        }

        @Override
        public void requireWritable(T item) {
            Long pinned = pinnedCampusId();
            if (pinned == null || item == null) {
                return;
            }
            boolean ok = writable != null ? writable.test(item, pinned)
                    : Objects.equals(campusOf.apply(item), pinned);
            if (!ok) {
                throw new FieldValidationException(field, OUTSIDE);
            }
        }

        private Predicate predicate(Root<T> root, CriteriaQuery<?> query,
                CriteriaBuilder cb, long campusId) {
            List<Predicate> branches = new ArrayList<>();
            List<Predicate> before = new ArrayList<>();
            for (Step step : steps) {
                Set<Long> ids = ids(step.kind(), campusId);
                if (step.attr() == null) {
                    return ids.isEmpty() ? cb.disjunction() : root.get("id").in(ids);
                }
                Path<?> ref = path(root, step.attr());
                List<Predicate> all = new ArrayList<>(before);
                all.add(cb.isNotNull(ref));
                all.add(ids.isEmpty() ? cb.disjunction() : ref.get("id").in(ids));
                branches.add(cb.and(all.toArray(Predicate[]::new)));
                before.add(cb.isNull(ref));
            }
            Predicate rest = fallback != null ? fallback.build(root, query, cb, campusId)
                    : isMain(campusId) ? cb.conjunction() : cb.disjunction();
            before.add(rest);
            branches.add(cb.and(before.toArray(Predicate[]::new)));
            return cb.or(branches.toArray(Predicate[]::new));
        }
    }
}
