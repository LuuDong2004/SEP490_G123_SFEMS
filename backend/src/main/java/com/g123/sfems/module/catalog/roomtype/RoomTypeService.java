package com.g123.sfems.module.catalog.roomtype;

import java.util.Map;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.coderule.CodeGenerator;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.facilitygroup.FacilityGroupService;
import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import jakarta.persistence.FlushModeType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loại CSVC. Phần chung ở {@link CatalogService}; lớp này gán khối, phòng / khu vực, cấp áp dụng, chuẩn, văn bản và
 * hai cờ hành vi.
 *
 * <p>Hai nguồn loại: danh mục của Sở ({@code school_id} trống — qua màn danh mục, quyền {@code room_types:write}) và
 * loại NGOÀI DANH MỤC của một trường ({@link #createForSchool}, gọi từ feature phòng dưới quyền {@code rooms:write}).
 * Danh sách chỉ cho người xem thấy loại của Sở và loại của các trường họ thấy.
 */
@Service
public class RoomTypeService extends CatalogService<RoomType, RoomTypeRequest, RoomTypePatchRequest> {

    private static final Set<String> KINDS = Set.of(RoomType.ROOM, RoomType.AREA);

    private final RoomTypeRepository repository;
    private final EducationLevelService educationLevels;
    private final FacilityGroupService groups;
    private final VisibleSchools visibleSchools;
    private final CodeGenerator codes;
    private final CallerSchoolLevel callerLevel;

    public RoomTypeService(
            RoomTypeRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            FacilityGroupService groups,
            VisibleSchools visibleSchools,
            CodeGenerator codes,
            CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, RoomType.class, RoomType::new, "Loại CSVC");
        this.repository = repository;
        this.educationLevels = educationLevels;
        this.groups = groups;
        this.visibleSchools = visibleSchools;
        this.codes = codes;
        this.callerLevel = callerLevel;
    }

    @Override
    protected void applyCreate(RoomType item, RoomTypeRequest request) {
        item.setRoomGroup(blankToNull(request.roomGroup()));
        IdRef level = request.educationLevel();
        if (level != null && level.id() != null) {
            item.setEducationLevel(educationLevels.get(level.id()));
        }
        IdRef group = request.group();
        item.setGroup(group == null || group.id() == null ? null : groups.get(group.id()));
        item.setKind(kind(request.kind() == null ? RoomType.ROOM : request.kind()));
        item.setLevels(FacilityGroupService.levels(request.levels()));
        item.setStandard(request.standard() == null || request.standard());
        item.setLegalBasis(blankToNull(request.legalBasis()));
        item.setLoanable(Boolean.TRUE.equals(request.loanable()));
        item.setFunctional(Boolean.TRUE.equals(request.functional()));
        item.setParams(params(request.params() == null ? List.of() : request.params()));
        requireNameFree(item.getName(), null, null);
    }

    @Override
    protected void applyUpdate(RoomType item, RoomTypePatchRequest request) {
        if (request.name() != null) {
            requireNameFree(item.getName(), item.getId(), item.getSchoolId());
        }
        if (request.roomGroup() != null) {
            item.setRoomGroup(blankToNull(request.roomGroup()));
        }
        // Ba trạng thái: vắng mặt là để nguyên, id null là xoá, id n là gán.
        IdRef level = request.educationLevel();
        if (level != null) {
            item.setEducationLevel(level.id() == null ? null : educationLevels.get(level.id()));
        }
        IdRef group = request.group();
        if (group != null) {
            item.setGroup(group.id() == null ? null : groups.get(group.id()));
        }
        if (request.kind() != null) {
            String kind = kind(request.kind());
            if (RoomType.AREA.equals(kind) && !RoomType.AREA.equals(item.getKind())) {
                long inBuildings = countRooms(item.getId(), "r.room_type_id = :id AND r.building_id IS NOT NULL");
                if (inBuildings > 0) {
                    throw new FieldValidationException("kind", "Còn " + inBuildings
                            + " hạng mục loại này gắn khối nhà — bỏ khối nhà trước khi đổi sang Khu vực, công trình");
                }
            }
            item.setKind(kind);
        }
        if (Boolean.FALSE.equals(request.active()) && wasActive(item.getId())) {
            long inUse = countRooms(item.getId(), "(r.room_type_id = :id OR r.combined_type_id = :id) AND r.active");
            if (inUse > 0) {
                throw new FieldValidationException("active",
                        "Còn " + inUse + " hạng mục đang dùng loại này — đổi loại cho chúng trước khi ngừng dùng");
            }
        }
        if (request.levels() != null) {
            item.setLevels(FacilityGroupService.levels(request.levels()));
        }
        if (request.standard() != null) {
            item.setStandard(request.standard());
        }
        if (request.legalBasis() != null) {
            item.setLegalBasis(blankToNull(request.legalBasis()));
        }
        if (request.loanable() != null) {
            item.setLoanable(request.loanable());
        }
        if (request.functional() != null) {
            item.setFunctional(request.functional());
        }
        if (request.params() != null) {
            List<Map<String, String>> next = params(request.params());
            boolean changed = !next.equals(item.getParams());
            item.setParams(next);
            if (changed) {
                stripRoomParams(item);
            }
        }
    }

    /** Loại đang dùng trước lần sửa này (lớp cha đã gán cờ mới lên bản ghi). */
    private boolean wasActive(Long id) {
        Object v = entityManager().createNativeQuery("SELECT active FROM room_types WHERE id = :id")
                .setFlushMode(FlushModeType.COMMIT)
                .setParameter("id", id)
                .getSingleResult();
        return Boolean.TRUE.equals(v);
    }

    /** Số hạng mục (bảng {@code rooms}) dùng loại này theo điều kiện {@code where} (bí danh {@code r}, tham số :id). */
    private long countRooms(Long id, String where) {
        return ((Number) entityManager().createNativeQuery("SELECT count(*) FROM rooms r WHERE " + where)
                .setFlushMode(FlushModeType.COMMIT)
                .setParameter("id", id)
                .getSingleResult()).longValue();
    }

    /**
     * Danh sách thông số của loại đổi: hạng mục dùng loại này (chính hoặc kết hợp) bỏ khoá không còn trong loại chính
     * lẫn loại kết hợp, và bỏ giá trị không còn hợp ô số (ô chữ đổi thành ô số).
     */
    private void stripRoomParams(RoomType item) {
        entityManager().flush();
        entityManager().createNativeQuery("""
                UPDATE rooms r SET params = COALESCE((
                    SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(r.params) e
                    WHERE EXISTS (
                        SELECT 1 FROM room_types t CROSS JOIN LATERAL jsonb_array_elements(t.params) s
                        WHERE t.id IN (r.room_type_id, r.combined_type_id) AND s->>'key' = e.key
                          AND (COALESCE(s->>'type', 'number') <> 'number'
                               OR (jsonb_typeof(e.value) IN ('string', 'number')
                                   AND (e.value #>> '{}') ~ '^[0-9]+(\\.[0-9]+)?$')))), CAST('{}' AS jsonb))
                WHERE r.room_type_id = :id OR r.combined_type_id = :id""")
                .setParameter("id", item.getId())
                .executeUpdate();
    }

    /**
     * Loại ngoài danh mục của một trường: chỉ trường đó dùng, không thuộc danh mục chuẩn, mặc định không cho
     * mượn. Người gọi (feature phòng) đã kiểm quyền {@code rooms:write} và trường nằm trong phạm vi.
     */
    @Transactional
    public RoomType createForSchool(long schoolId, String name, Long groupId, String kind) {
        String clean = blankToNull(name);
        if (clean == null) {
            throw new FieldValidationException("name", "Tên là bắt buộc");
        }
        requireNameFree(clean, null, schoolId);
        RoomType item = new RoomType();
        String code = codes.resolveOnCreate("room_types", "");
        if (code.isBlank()) {
            String base = "NDM-" + schoolId + "-" + System.currentTimeMillis() % 1_000_000;
            code = base;
            for (int n = 2; repository.findByCodeIgnoreCase(code).isPresent(); n++) {
                code = base + "-" + n;
            }
        }
        item.setCode(code);
        item.setName(clean);
        item.setActive(true);
        item.setSortOrder(9000);
        item.setGroup(groupId == null ? null : groups.get(groupId));
        item.setKind(kind(kind == null ? RoomType.ROOM : kind));
        item.setStandard(false);
        item.setSchoolId(schoolId);
        return repository.persist(item);
    }

    /**
     * Tên không trùng trong phạm vi người dùng nhìn thấy: loại của Sở và loại của cùng trường. Hai trường khác nhau
     * cùng tự thêm "Phòng robot" thì được.
     */
    private void requireNameFree(String name, Long selfId, Long schoolId) {
        repository.findByNameIgnoreCase(name).stream()
                .filter(other -> !other.getId().equals(selfId))
                .filter(other -> other.getSchoolId() == null || Objects.equals(other.getSchoolId(), schoolId))
                .findFirst()
                .ifPresent(other -> {
                    throw new FieldValidationException("name",
                            "Loại CSVC tên \"%s\" đã có (mã %s) — chọn loại đó".formatted(other.getName(), other.getCode()));
                });
    }

    /**
     * Danh sách thông số của loại: nhãn bắt buộc, đơn vị tuỳ ý, kiểu số hoặc chữ; khoá tự sinh từ nhãn nếu
     * thiếu, và giữ nguyên khi sửa nhãn (phòng đã khai giữ được giá trị). Tối đa 20 ô.
     */
    private static List<Map<String, String>> params(List<Map<String, String>> input) {
        List<Map<String, String>> out = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        for (Map<String, String> p : input) {
            String label = blankToNull(p.get("label"));
            if (label == null) {
                continue;
            }
            if (label.length() > 100) {
                throw new FieldValidationException("params", "Tên thông số tối đa 100 ký tự");
            }
            String key = blankToNull(p.get("key"));
            if (key == null || !key.matches("[A-Za-z][A-Za-z0-9]{0,39}")) {
                key = keyOf(label);
            }
            String base = key;
            for (int n = 2; !keys.add(key); n++) {
                key = base + n;
            }
            String unit = Objects.requireNonNullElse(blankToNull(p.get("unit")), "");
            if (unit.length() > 20) {
                throw new FieldValidationException("params", "Đơn vị tối đa 20 ký tự");
            }
            String type = "text".equals(p.get("type")) ? "text" : "number";
            Map<String, String> spec = new LinkedHashMap<>();
            spec.put("key", key);
            spec.put("label", label);
            spec.put("unit", unit);
            spec.put("type", type);
            out.add(spec);
        }
        if (out.size() > 20) {
            throw new FieldValidationException("params", "Tối đa 20 thông số một loại");
        }
        return out;
    }

    /** "Diện tích kho sách kín" → dienTichKhoSachKin. */
    private static String keyOf(String label) {
        String plain = Normalizer.normalize(label.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        StringBuilder out = new StringBuilder();
        for (String w : plain.split("[^A-Za-z0-9]+")) {
            if (w.isEmpty()) {
                continue;
            }
            String lower = w.toLowerCase(Locale.ROOT);
            out.append(out.isEmpty() ? lower : Character.toUpperCase(lower.charAt(0)) + lower.substring(1));
        }
        String key = out.isEmpty() ? "p" : out.toString();
        if (!Character.isLetter(key.charAt(0))) {
            key = "p" + key;
        }
        return key.length() > 40 ? key.substring(0, 40) : key;
    }

    private static String kind(String value) {
        if (!KINDS.contains(value)) {
            throw new FieldValidationException("kind", "Chọn Phòng, nhà hoặc Khu vực, công trình");
        }
        return value;
    }

    @Override
    protected Specification<RoomType> extraFilters(ListParams params) {
        List<Specification<RoomType>> specs = new ArrayList<>();
        specs.add(CatalogSpecifications.referenceFilter(params, "educationLevel"));
        specs.add(CatalogSpecifications.referenceFilter(params, "group"));
        for (ListParams.Criterion c : params.filters()) {
            String value = c.value() == null ? "" : c.value().trim();
            switch (c.field()) {
                case "kind" -> specs.add((root, q, cb) -> cb.equal(root.get("kind"), value));
                case "standard" -> specs.add((root, q, cb) -> cb.equal(root.get("standard"), Boolean.parseBoolean(value)));
                case "level" -> specs.add((root, q, cb) -> cb.or(cb.isNull(root.get("levels")),
                        cb.like(cb.concat(cb.concat(",", root.get("levels")), ","), "%," + value + ",%")));
                case "schoolId" -> {
                    // Ô chọn loại ở form phòng: loại của Sở + loại riêng của đúng trường đó.
                    Long id = parseId(value);
                    specs.add((root, q, cb) -> id == null ? cb.isNull(root.get("schoolId"))
                            : cb.or(cb.isNull(root.get("schoolId")), cb.equal(root.get("schoolId"), id)));
                }
                default -> {
                }
            }
        }
        Set<Long> visible = visibleSchools.current();
        if (visible != null) {
            specs.add((root, q, cb) -> visible.isEmpty() ? cb.isNull(root.get("schoolId"))
                    : cb.or(cb.isNull(root.get("schoolId")), root.get("schoolId").in(visible)));
        }
        // Tài khoản của MỘT trường: loại của Sở chỉ hiện loại áp cho cấp học của trường (cột levels trống = mọi cấp);
        // loại ngoài danh mục của chính trường luôn hiện.
        String level = callerLevel.educationLevelCode();
        if (level != null) {
            specs.add((root, q, cb) -> cb.or(cb.isNotNull(root.get("schoolId")), cb.isNull(root.get("levels")),
                    cb.like(cb.concat(cb.concat(",", root.get("levels")), ","), "%," + level + ",%")));
        }
        return Specification.allOf(specs);
    }

    private static Long parseId(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "legalBasis");
    }
}
