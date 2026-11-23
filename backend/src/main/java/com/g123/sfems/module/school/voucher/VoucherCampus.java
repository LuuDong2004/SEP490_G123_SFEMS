package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.CampusScope.CampusLabel;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.From;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import org.hibernate.Hibernate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.util.ReflectionUtils;

/**
 * Phạm vi CƠ SỞ của phiếu (267, giai đoạn 2) — MỘT luật cho mọi loại phiếu và phiếu ghi tăng. Phiếu "chạm" một cơ sở
 * khi phòng ở đầu phiếu, thiết bị ở đầu phiếu, hoặc BẤT KỲ dòng nào (phòng của dòng, thiết bị của dòng theo phòng hiện
 * tại) thuộc cơ sở đó — phiếu có thiết bị của hai cơ sở thì cán bộ cả hai cơ sở cùng thấy. Phiếu không phòng, không
 * thiết bị (đề xuất mua sắm, phiếu xuất kho chỉ có danh mục) thuộc cơ sở chính. Thiết bị chưa có phòng thuộc cơ sở chính.
 *
 * <p>Mỗi loại phiếu chỉ khai HÌNH DẠNG ({@link Shape}: thuộc tính phòng / thiết bị ở đầu phiếu, các tập dòng và
 * phòng / thiết bị trên dòng); từ đó dựng cả vế lọc (EXISTS tương quan — không join nhân dòng, {@code X-Total-Count}
 * đúng) lẫn kiểm ghi trong bộ nhớ. Tài khoản không bị giới hạn: không lọc gì.
 */
@Component
public class VoucherCampus {

    /** Một tập dòng của phiếu: tên collection, các thuộc tính phòng và thiết bị trên dòng. */
    public record Line(String collection, List<String> rooms, List<String> equipment) {
    }

    /**
     * Hình dạng của một loại phiếu. {@code targetSchool} / {@code targetRoom}: phiếu còn thuộc trường NHẬN (điều chuyển)
     * — chạm cơ sở của phòng nhận, phòng nhận trống thì cơ sở chính của trường nhận.
     */
    public record Shape(List<String> rooms, List<String> equipment, List<Line> lines, String targetSchool,
            String targetRoom) {

        /** Mặc định: dòng {@code lines} trỏ tới thiết bị ({@code VoucherEquipmentLine}). */
        public static final Shape LINES = new Shape(List.of(), List.of(),
                List.of(new Line("lines", List.of(), List.of("equipment"))), null, null);

        /** Không phòng, không thiết bị — luôn thuộc cơ sở chính. */
        public static final Shape NONE = new Shape(List.of(), List.of(), List.of(), null, null);

        public static Shape of(List<String> rooms, List<String> equipment, Line... lines) {
            return new Shape(rooms, equipment, List.of(lines), null, null);
        }
    }

    static final String OTHER_ROOM = "Phòng thuộc cơ sở khác";
    static final String OTHER_EQUIPMENT = "Thiết bị thuộc cơ sở khác";
    static final String NOT_MINE = "Phiếu phải có thiết bị hoặc phòng thuộc cơ sở của tài khoản";

    private final CampusScope campus;
    private final RowLevelPrincipalResolver principals;

    public VoucherCampus(CampusScope campus, RowLevelPrincipalResolver principals) {
        this.campus = campus;
        this.principals = principals;
    }

    /** Cơ sở mà người gọi bị giới hạn trong ({@code null} = không giới hạn). */
    public Long pinnedCampus() {
        return campus.pinnedCampusId();
    }

    // ------------------------------------------------------------------ đọc

    /** Phiếu chạm cơ sở của người gọi; người gọi không bị giới hạn thì không lọc. */
    public <V> Specification<V> pinned(Shape shape) {
        return (root, query, cb) -> {
            Long pinned = campus.pinnedCampusId();
            return pinned == null ? null : touches(shape, root, query, cb, pinned);
        };
    }

    /** Phiếu chạm cơ sở {@code campusId}. */
    public <V> Specification<V> inCampus(Shape shape, long campusId) {
        return (root, query, cb) -> touches(shape, root, query, cb, campusId);
    }

    /**
     * Bộ lọc {@code campus=<id>} của danh sách. Áp CÙNG phạm vi của người gọi (không thay nó), nên tài khoản bị giới
     * hạn gửi cơ sở khác chỉ nhận danh sách rỗng hoặc phiếu chạm cả hai.
     */
    public <V> Specification<V> filter(Shape shape, ListParams params) {
        List<Specification<V>> specs = new ArrayList<>();
        for (ListParams.Criterion criterion : params.filters()) {
            if (!"campus".equals(criterion.field()) || criterion.value() == null || criterion.value().isBlank()) {
                continue;
            }
            try {
                specs.add(inCampus(shape, Long.parseLong(criterion.value().trim())));
            } catch (NumberFormatException e) {
                specs.add((root, query, cb) -> cb.disjunction());
            }
        }
        return Specification.allOf(specs);
    }

    /**
     * Nhãn Cơ sở của từng phiếu trên một trang danh sách — chỉ cho tài khoản một trường, không bị giới hạn, trường có
     * từ hai cơ sở; còn lại trả rỗng. Mỗi cơ sở một truy vấn {@code id IN (trang) AND chạm cơ sở} — cùng luật lọc.
     */
    public <V extends SchoolVoucher> Map<Long, List<CampusLabel>> labels(Shape shape, List<Long> ids,
            Function<Specification<V>, List<V>> finder) {
        RowLevelPrincipal principal = principals.current().orElse(null);
        if (ids.isEmpty() || principal == null || principal.schoolId() == null || principal.campusId() != null) {
            return Map.of();
        }
        List<CampusLabel> campuses = campus.activeCampuses(principal.schoolId());
        if (campuses.size() < 2) {
            return Map.of();
        }
        Map<Long, List<CampusLabel>> out = new LinkedHashMap<>();
        for (CampusLabel c : campuses) {
            Specification<V> page = (root, q, cb) -> root.get("id").in(ids);
            Specification<V> spec = page.and(inCampus(shape, c.id()));
            for (V voucher : finder.apply(spec)) {
                out.computeIfAbsent(voucher.getId(), k -> new ArrayList<>()).add(c);
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ ghi

    /** Khoá các phòng / thiết bị phiếu đang trỏ tới — chụp TRƯỚC khi sửa, để chỉ kiểm cái mới thêm. */
    public Set<String> anchorKeys(Shape shape, SchoolVoucher voucher) {
        if (campus.pinnedCampusId() == null) {
            return Set.of();
        }
        Set<String> keys = new HashSet<>();
        for (Anchor a : anchors(shape, voucher)) {
            keys.add(a.key());
        }
        return keys;
    }

    /**
     * Kiểm ghi của tài khoản bị giới hạn (422): mọi phòng / thiết bị MỚI thêm (không có trong {@code before}) của trường
     * mình phải thuộc cơ sở mình, và sau khi lưu phiếu phải còn chạm cơ sở mình (không thì người lập không thấy lại
     * phiếu vừa lưu).
     */
    public void requireWritable(Shape shape, SchoolVoucher voucher, Set<String> before) {
        Long pinned = campus.pinnedCampusId();
        if (pinned == null) {
            return;
        }
        Long school = campus.schoolOfCampus(pinned);
        boolean touches = false;
        boolean anchored = false;
        for (Anchor a : anchors(shape, voucher)) {
            anchored = anchored || !a.target();
            if (!Objects.equals(a.schoolId(), school)) {
                continue;
            }
            if (Objects.equals(a.campusId(), pinned)) {
                touches = true;
            } else if (!before.contains(a.key())) {
                throw new FieldValidationException(a.field(), a.message());
            }
        }
        if (touches) {
            return;
        }
        if (campus.isMainCampus(pinned)) {
            // Cơ sở chính nhận phiếu không trỏ tới phòng / thiết bị nào, và phiếu điều chuyển tới chưa có phòng nhận.
            boolean ownSchool = voucher.getSchool() != null && Objects.equals(voucher.getSchool().getId(), school);
            boolean targetMain = shape.targetSchool() != null && read(voucher, shape.targetRoom()) == null
                    && read(voucher, shape.targetSchool()) instanceof School target
                    && Objects.equals(target.getId(), school);
            if ((ownSchool && !anchored) || targetMain) {
                return;
            }
        }
        throw new FieldValidationException("lines", NOT_MINE);
    }

    // ------------------------------------------------------------------ dựng predicate

    private <V> Predicate touches(Shape shape, Root<V> root, CriteriaQuery<?> query, CriteriaBuilder cb,
            long campusId) {
        Set<Long> rooms = campus.roomIdsOf(campusId);
        Long school = campus.schoolOfCampus(campusId);
        boolean main = campus.isMainCampus(campusId);
        List<Predicate> any = new ArrayList<>();
        for (String attr : shape.rooms()) {
            any.add(roomIn(root.get(attr), rooms, cb));
        }
        for (String attr : shape.equipment()) {
            Subquery<Long> sq = query.subquery(Long.class);
            Root<V> self = sq.correlate(root);
            Join<V, Object> e = self.join(attr);
            sq.select(e.<Long>get("id")).where(equipmentIn(e, rooms, school, main, cb));
            any.add(cb.exists(sq));
        }
        for (Line line : shape.lines()) {
            if (line.rooms().isEmpty() && line.equipment().isEmpty()) {
                continue;
            }
            Subquery<Long> sq = query.subquery(Long.class);
            Root<V> self = sq.correlate(root);
            Join<V, Object> l = self.join(line.collection());
            List<Predicate> hit = new ArrayList<>();
            for (String attr : line.rooms()) {
                hit.add(roomIn(l.get(attr), rooms, cb));
            }
            for (String attr : line.equipment()) {
                Join<Object, Object> e = l.join(attr, JoinType.LEFT);
                hit.add(cb.and(cb.isNotNull(l.get(attr)), equipmentIn(e, rooms, school, main, cb)));
            }
            sq.select(l.<Long>get("id")).where(cb.or(hit.toArray(Predicate[]::new)));
            any.add(cb.exists(sq));
        }
        if (main) {
            any.add(noAnchor(shape, root, query, cb, school));
            if (shape.targetSchool() != null) {
                any.add(cb.and(cb.isNull(root.get(shape.targetRoom())),
                        cb.equal(root.get(shape.targetSchool()).get("id"), school)));
            }
        }
        if (shape.targetRoom() != null) {
            any.add(roomIn(root.get(shape.targetRoom()), rooms, cb));
        }
        return cb.or(any.toArray(Predicate[]::new));
    }

    /** Phiếu của trường {@code school} không trỏ tới phòng, thiết bị nào — thuộc cơ sở chính. */
    private <V> Predicate noAnchor(Shape shape, Root<V> root, CriteriaQuery<?> query, CriteriaBuilder cb,
            Long school) {
        List<Predicate> none = new ArrayList<>();
        none.add(cb.equal(root.get("school").get("id"), school));
        for (String attr : shape.rooms()) {
            none.add(cb.isNull(root.get(attr)));
        }
        for (String attr : shape.equipment()) {
            none.add(cb.isNull(root.get(attr)));
        }
        for (Line line : shape.lines()) {
            if (line.rooms().isEmpty() && line.equipment().isEmpty()) {
                continue;
            }
            Subquery<Long> sq = query.subquery(Long.class);
            Root<V> self = sq.correlate(root);
            Join<V, Object> l = self.join(line.collection());
            List<Predicate> set = new ArrayList<>();
            for (String attr : line.rooms()) {
                set.add(cb.isNotNull(l.get(attr)));
            }
            for (String attr : line.equipment()) {
                set.add(cb.isNotNull(l.get(attr)));
            }
            sq.select(l.<Long>get("id")).where(cb.or(set.toArray(Predicate[]::new)));
            none.add(cb.not(cb.exists(sq)));
        }
        return cb.and(none.toArray(Predicate[]::new));
    }

    /** Thiết bị {@code e} thuộc cơ sở: phòng của nó trong cơ sở, hoặc chưa có phòng và cơ sở là cơ sở chính. */
    private static Predicate equipmentIn(From<?, ?> e, Set<Long> rooms, Long school, boolean main,
            CriteriaBuilder cb) {
        Predicate inRoom = roomIn(e.get("room"), rooms, cb);
        if (!main) {
            return inRoom;
        }
        return cb.or(inRoom, cb.and(cb.isNull(e.get("room")), cb.equal(e.get("school").get("id"), school)));
    }

    private static Predicate roomIn(Path<?> ref, Set<Long> rooms, CriteriaBuilder cb) {
        return rooms.isEmpty() ? cb.disjunction() : ref.get("id").in(rooms);
    }

    // ------------------------------------------------------------------ trong bộ nhớ

    /** Một phòng / thiết bị mà phiếu trỏ tới. {@code target}: phòng nhận của trường nhận. */
    private record Anchor(String key, String field, String message, Long schoolId, Long campusId, boolean target) {
    }

    private List<Anchor> anchors(Shape shape, SchoolVoucher voucher) {
        List<Anchor> out = new ArrayList<>();
        Object self = Hibernate.unproxy(voucher);
        for (String attr : shape.rooms()) {
            room(out, read(self, attr), attr, OTHER_ROOM, false);
        }
        if (shape.targetRoom() != null) {
            room(out, read(self, shape.targetRoom()), shape.targetRoom(), OTHER_ROOM, true);
        }
        for (String attr : shape.equipment()) {
            equipment(out, read(self, attr), attr, OTHER_EQUIPMENT);
        }
        for (Line line : shape.lines()) {
            if (!(read(self, line.collection()) instanceof Collection<?> rows)) {
                continue;
            }
            int index = 0;
            for (Object row : rows) {
                index++;
                Object lineNo = read(row, "lineNo");
                int no = lineNo instanceof Integer n ? n : index;
                for (String attr : line.rooms()) {
                    room(out, read(row, attr), line.collection(), "Dòng %d: phòng thuộc cơ sở khác".formatted(no), false);
                }
                for (String attr : line.equipment()) {
                    Object value = read(row, attr);
                    String code = value instanceof Equipment e ? e.getCode() : "";
                    equipment(out, value, line.collection(),
                            "Dòng %d (%s): thiết bị thuộc cơ sở khác".formatted(no, code));
                }
            }
        }
        return out;
    }

    private void room(List<Anchor> out, Object value, String field, String message, boolean target) {
        if (value instanceof Room room) {
            out.add(new Anchor("R" + room.getId(), field, message,
                    room.getSchool() == null ? null : room.getSchool().getId(), campus.campusOfRoom(room), target));
        }
    }

    private void equipment(List<Anchor> out, Object value, String field, String message) {
        if (value instanceof Equipment item) {
            out.add(new Anchor("E" + item.getId(), field, message,
                    item.getSchool() == null ? null : item.getSchool().getId(), campus.campusOfEquipment(item), false));
        }
    }

    /** Giá trị thuộc tính {@code attr} của thực thể (đọc thẳng trường Java — cùng tên với thuộc tính JPA). */
    private static Object read(Object entity, String attr) {
        if (entity == null || attr == null) {
            return null;
        }
        Object target = Hibernate.unproxy(entity);
        Field field = ReflectionUtils.findField(target.getClass(), attr);
        if (field == null) {
            return null;
        }
        ReflectionUtils.makeAccessible(field);
        Object value = ReflectionUtils.getField(field, target);
        return value instanceof Room || value instanceof Equipment || value instanceof School
                ? Hibernate.unproxy(value) : value;
    }
}
