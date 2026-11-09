package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.CatalogOrigin;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.equipmenttype.EquipmentTypeService;
import com.g123.sfems.module.catalog.grade.GradeService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.catalog.unit.UnitService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Function;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Danh mục thiết bị của Sở, dùng chung cho trường THPT và các dòng định mức. */
@Service
public class EquipmentCatalogService extends CatalogService<
        EquipmentCatalog, EquipmentCatalogRequest, EquipmentCatalogPatchRequest> {

    private final EquipmentCatalogRepository repository;
    private final EquipmentTypeService types;
    private final SubjectService subjects;
    private final EducationLevelService levels;
    private final GradeService grades;
    private final UnitService units;
    private final RowLevelPrincipalResolver principals;

    public EquipmentCatalogService(EquipmentCatalogRepository repository, RowLevelSecurity rowLevel,
            EquipmentTypeService types, SubjectService subjects, EducationLevelService levels,
            GradeService grades, UnitService units, RowLevelPrincipalResolver principals) {
        super(repository, rowLevel, EquipmentCatalog.class, EquipmentCatalog::new, "Danh mục thiết bị");
        this.repository = repository;
        this.types = types;
        this.subjects = subjects;
        this.levels = levels;
        this.grades = grades;
        this.units = units;
        this.principals = principals;
    }

    @Override
    protected void applyCreate(EquipmentCatalog item, EquipmentCatalogRequest request) {
        item.setTeachingCode(blankToNull(request.teachingCode()));
        item.setParent(ref(request.parent(), this::get));
        item.setEquipmentType(ref(request.equipmentType(), types::get));
        item.setSubject(ref(request.subject(), subjects::get));
        item.setEducationLevel(ref(request.educationLevel(), levels::get));
        item.setGrade(ref(request.grade(), grades::get));
        item.setUnit(ref(request.unit(), units::get));
        item.setModel(blankToNull(request.model()));
        item.setManufacturer(blankToNull(request.manufacturer()));
        item.setTrackingType(request.trackingType());
        item.setAssetCategory(request.assetCategory());
        item.setPhysicalOrDigital(request.physicalOrDigital());
        item.setDepreciationMethod(request.depreciationMethod());
        item.setUsefulLifeYears(request.usefulLifeYears());
        item.setStatisticalCode(blankToNull(request.statisticalCode()));
        item.setLegalBasis(blankToNull(request.legalBasis()));
        item.setDescription(blankToNull(request.description()));
        item.setUsedByTeacher(request.usedByTeacher());
        item.setUsedByStudent(request.usedByStudent());
        item.setSelfMade(request.selfMade());
        // Thêm tay luôn là thiết bị ngoài thông tư; cờ "thuộc danh mục tối thiểu" do việc áp dụng bộ tiêu chuẩn đặt.
        item.setMinimumRequired(false);
        applyMany(item, request.subjects(), request.grades());
        validate(item);
    }

    /**
     * Môn học, khối lớp chọn NHIỀU: mục đầu là cái CHÍNH (cột chính — phần MH của mã tài sản, bộ lọc và
     * báo cáo đọc nó), các mục sau vào bảng nối. Danh sách {@code null} là không đụng tới; rỗng là bỏ hết.
     */
    private void applyMany(EquipmentCatalog item, List<IdRef> subjectRefs, List<IdRef> gradeRefs) {
        if (subjectRefs != null) {
            List<Long> ids = ids(subjectRefs);
            item.setSubject(ids.isEmpty() ? null : subjects.get(ids.get(0)));
            item.getExtraSubjects().clear();
            ids.stream().skip(1).forEach(id -> item.getExtraSubjects().add(subjects.get(id)));
        }
        if (gradeRefs != null) {
            List<Long> ids = ids(gradeRefs);
            item.setGrade(ids.isEmpty() ? null : grades.get(ids.get(0)));
            item.getExtraGrades().clear();
            ids.stream().skip(1).forEach(id -> item.getExtraGrades().add(grades.get(id)));
        }
    }

    private static List<Long> ids(List<IdRef> refs) {
        return refs.stream().filter(ref -> ref != null && ref.id() != null).map(IdRef::id).distinct().toList();
    }

    @Override
    protected void applyUpdate(EquipmentCatalog item, EquipmentCatalogPatchRequest request) {
        // Mã, tên và môn trong thông tư chỉ thay đổi qua phiên bản bộ định mức.
        if (Boolean.TRUE.equals(item.getMinimumRequired()) && item.getOwnerSchool() == null) {
            unchanged("code", request.code(), item.getCode());
            unchanged("name", request.name(), item.getName());
            if (request.subject() != null && !Objects.equals(request.subject().id(),
                    item.getSubject() == null ? null : item.getSubject().getId())) {
                throw new FieldValidationException("subject", "Môn của thiết bị tối thiểu chỉ đổi qua bộ định mức mới");
            }
        }
        if (request.teachingCode() != null) item.setTeachingCode(blankToNull(request.teachingCode()));
        if (request.parent() != null) {
            EquipmentCatalog parent = ref(request.parent(), this::get);
            if (parent != null && repository.subtreeIds(item.getId()).contains(parent.getId())) {
                throw new FieldValidationException("parent", "Nhóm cha không được là chính nhóm này hoặc nhóm con của nó");
            }
            item.setParent(parent);
        }
        if (request.equipmentType() != null) item.setEquipmentType(ref(request.equipmentType(), types::get));
        if (request.subject() != null) item.setSubject(ref(request.subject(), subjects::get));
        if (request.educationLevel() != null) item.setEducationLevel(ref(request.educationLevel(), levels::get));
        if (request.grade() != null) item.setGrade(ref(request.grade(), grades::get));
        if (request.unit() != null) item.setUnit(ref(request.unit(), units::get));
        if (request.model() != null) item.setModel(blankToNull(request.model()));
        if (request.manufacturer() != null) item.setManufacturer(blankToNull(request.manufacturer()));
        if (request.trackingType() != null && request.trackingType() != item.getTrackingType()) {
            long assetCount = entityManager().createQuery(
                    "SELECT count(e) FROM Equipment e WHERE e.catalog.id = :id", Long.class)
                    .setParameter("id", item.getId())
                    .getSingleResult();
            if (assetCount > 0) {
                throw new FieldValidationException("trackingType",
                        "Đã có tài sản thuộc danh mục này nên không thể đổi cách quản lý");
            }
            item.setTrackingType(request.trackingType());
        }
        if (request.assetCategory() != null) item.setAssetCategory(request.assetCategory());
        if (request.physicalOrDigital() != null) item.setPhysicalOrDigital(request.physicalOrDigital());
        if (request.depreciationMethod() != null) item.setDepreciationMethod(request.depreciationMethod());
        if (request.usefulLifeYears() != null) item.setUsefulLifeYears(request.usefulLifeYears());
        if (request.statisticalCode() != null) item.setStatisticalCode(blankToNull(request.statisticalCode()));
        if (request.legalBasis() != null) item.setLegalBasis(blankToNull(request.legalBasis()));
        if (request.description() != null) item.setDescription(blankToNull(request.description()));
        if (request.usedByTeacher() != null) item.setUsedByTeacher(request.usedByTeacher());
        if (request.usedByStudent() != null) item.setUsedByStudent(request.usedByStudent());
        if (request.selfMade() != null) item.setSelfMade(request.selfMade());
        // Thiết bị của thông tư giữ môn theo thông tư — danh sách môn bỏ qua; khối lớp vẫn sửa được.
        boolean byCircular = Boolean.TRUE.equals(item.getMinimumRequired()) && item.getOwnerSchool() == null;
        applyMany(item, byCircular ? null : request.subjects(), request.grades());
        validate(item);
    }

    /**
     * Trường thêm một thiết bị NGOÀI danh mục của Sở, ngay lúc ghi tăng. Mã do hệ thống cấp
     * ({@code NDM-<mã trường>-<số>}), thiết bị thuộc riêng trường đó.
     *
     * <p>Trùng tên với một thiết bị trong danh mục của Sở thì từ chối và nêu tên — thứ Sở đã có thì chọn
     * cái của Sở, để báo cáo theo từng thiết bị cộng được. Trùng tên một thiết bị ngoài danh mục trường
     * đã thêm cũng từ chối: chọn lại cái cũ.
     */
    @Transactional
    public EquipmentCatalog createForSchool(SchoolItemRequest request, Long schoolId) {
        if (schoolId == null) {
            throw new FieldValidationException("school", "Chỉ tài khoản của một trường mới thêm được thiết bị ngoài danh mục");
        }
        School school = entityManager().find(School.class, schoolId);
        if (school == null) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        String name = request.name().trim();
        repository.findFirstByNameIgnoreCaseAndOwnerSchoolIsNull(name).ifPresent(existing -> {
            throw new ConflictException("Danh mục của Sở đã có thiết bị \"%s\" (mã %s) — chọn thiết bị đó"
                    .formatted(existing.getName(), existing.getCode()));
        });
        repository.findFirstByNameIgnoreCaseAndOwnerSchool_Id(name, schoolId).ifPresent(existing -> {
            throw new ConflictException("Trường đã thêm thiết bị ngoài danh mục \"%s\" (mã %s) — chọn thiết bị đó"
                    .formatted(existing.getName(), existing.getCode()));
        });

        EquipmentCatalog item = new EquipmentCatalog();
        item.setCode(nextSchoolCode(school));
        item.setActive(true);
        item.setOwnerSchool(school);
        applySchoolItem(item, request, name);
        return repository.persist(item);
    }

    /**
     * Trường sửa thiết bị ngoài danh mục CỦA CHÍNH MÌNH — cùng các ô như lúc thêm. Thiết bị của Sở hay của
     * trường khác thì như không có (404). Đổi cách quản lý khi đã có tài sản thì từ chối — tài sản đã cấp
     * mã theo cách cũ.
     */
    @Transactional
    public EquipmentCatalog updateForSchool(Long id, SchoolItemRequest request, Long schoolId) {
        EquipmentCatalog item = get(id);
        if (schoolId == null || item.getOwnerSchool() == null || !schoolId.equals(item.getOwnerSchool().getId())) {
            throw new ResourceNotFoundException("EquipmentCatalog", id);
        }
        String name = request.name().trim();
        repository.findFirstByNameIgnoreCaseAndOwnerSchoolIsNull(name).ifPresent(existing -> {
            throw new ConflictException("Danh mục của Sở đã có thiết bị \"%s\" (mã %s) — đặt tên khác"
                    .formatted(existing.getName(), existing.getCode()));
        });
        repository.findFirstByNameIgnoreCaseAndOwnerSchool_Id(name, schoolId)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ConflictException("Trường đã có thiết bị ngoài danh mục \"%s\" (mã %s) — đặt tên khác"
                            .formatted(existing.getName(), existing.getCode()));
                });
        TrackingType wanted = request.trackingType() == null ? item.getTrackingType() : request.trackingType();
        if (wanted != item.getTrackingType() && assetCount(id) > 0) {
            throw new FieldValidationException("trackingType", "Đã có tài sản của thiết bị này nên không đổi được cách quản lý");
        }
        item.getExtraSubjects().clear();
        applySchoolItem(item, request, name);
        return item;
    }

    /** Các ô của thiết bị ngoài danh mục — chung cho thêm và sửa. */
    private void applySchoolItem(EquipmentCatalog item, SchoolItemRequest request, String name) {
        item.setName(name);
        item.setNote(blankToNull(request.note()));
        item.setModel(blankToNull(request.model()));
        item.setEquipmentType(types.get(request.equipmentType().id()));
        // Nhiều môn: môn đầu là môn chính, các môn sau vào bảng nối. Không chọn môn nào là dùng chung.
        List<Long> subjectIds = request.subjects() == null ? List.of() : ids(request.subjects());
        if (subjectIds.isEmpty()) {
            item.setSubject(ref(request.subject(), subjects::get));
        } else {
            item.setSubject(subjects.get(subjectIds.get(0)));
            subjectIds.stream().skip(1).forEach(subjectId -> item.getExtraSubjects().add(subjects.get(subjectId)));
        }
        item.setUnit(units.get(request.unit().id()));
        item.setAssetCategory(request.assetCategory());
        if (request.trackingType() != null) {
            item.setTrackingType(request.trackingType());
        }
        item.setPhysicalOrDigital(request.physicalOrDigital() == null
                ? PhysicalDigitalType.PHYSICAL : request.physicalOrDigital());
        item.setOrigin(request.origin());
        item.setSelfMade(request.origin() == CatalogOrigin.SELF_MADE);
        validate(item);
    }

    /** Số tài sản đang mang thiết bị này. */
    private long assetCount(Long catalogId) {
        return entityManager().createQuery("SELECT count(e) FROM Equipment e WHERE e.catalog.id = :id", Long.class)
                .setParameter("id", catalogId).getSingleResult();
    }

    /** {@code NDM-<mã trường>-001}, số kế tiếp chưa ai dùng — mã duy nhất trên cả bảng. */
    private String nextSchoolCode(School school) {
        String tag = school.getShortCode() == null ? ""
                : school.getShortCode().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        String prefix = "NDM-" + (tag.isEmpty() ? "S" + school.getId() : tag) + "-";
        long next = repository.countByOwnerSchool_Id(school.getId()) + 1;
        while (repository.findByCodeIgnoreCase(prefix + "%03d".formatted(next)).isPresent()) {
            next++;
        }
        return prefix + "%03d".formatted(next);
    }

    @Override
    @Transactional
    public EquipmentCatalog update(Long id, EquipmentCatalogPatchRequest request) {
        EquipmentCatalog current = getWritable(id);
        requireOfficial(current);
        if (Boolean.TRUE.equals(current.getMinimumRequired()) && current.getOwnerSchool() == null) {
            unchanged("code", request.code(), current.getCode());
            unchanged("name", request.name(), current.getName());
        }
        return super.update(id, request);
    }

    @Override
    protected void beforeDelete(EquipmentCatalog item) {
        requireOfficial(item);
        if (Boolean.TRUE.equals(item.getMinimumRequired())) {
            throw new FieldValidationException("id", "Thiết bị thuộc danh mục tối thiểu không được xoá trực tiếp");
        }
    }

    @Override
    protected Specification<EquipmentCatalog> extraFilters(ListParams params) {
        Specification<EquipmentCatalog> scope = principals.current().map(p -> {
            Long schoolId = p.schoolId();
            return schoolId == null ? Specification.<EquipmentCatalog>unrestricted()
                    : (Specification<EquipmentCatalog>) (root, query, cb) -> cb.or(
                            cb.isNull(root.get("ownerSchool")), cb.equal(root.get("ownerSchool").get("id"), schoolId));
        }).orElse(Specification.unrestricted());
        return Specification.allOf(List.of(scope,
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "parent"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "equipmentType"),
                primaryOrExtraFilter(params, "subject", "extraSubjects"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "educationLevel"),
                primaryOrExtraFilter(params, "grade", "extraGrades"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "unit"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "ownerSchool"),
                ownershipFilter(params), trackingFilter(params), minimumFilter(params)));
    }

    public EquipmentCatalog getVisible(Long id) {
        EquipmentCatalog item = get(id);
        Long schoolId = principals.current().map(p -> p.schoolId()).orElse(null);
        if (schoolId != null && item.getOwnerSchool() != null
                && !schoolId.equals(item.getOwnerSchool().getId())) {
            throw new ResourceNotFoundException("EquipmentCatalog", id);
        }
        return item;
    }

    @Override
    public List<EquipmentCatalog> getMany(List<Long> ids) {
        Long schoolId = principals.current().map(p -> p.schoolId()).orElse(null);
        return super.getMany(ids).stream().filter(item -> schoolId == null || item.getOwnerSchool() == null
                || schoolId.equals(item.getOwnerSchool().getId())).toList();
    }

    private static <T> T ref(IdRef ref, Function<Long, T> find) {
        return ref == null || ref.id() == null ? null : find.apply(ref.id());
    }

    private static void unchanged(String field, String requested, String existing) {
        if (requested != null && !requested.trim().equalsIgnoreCase(existing)) {
            throw new FieldValidationException(field, "Thiết bị tối thiểu chỉ đổi thông tin theo bộ định mức mới");
        }
    }

    private static void requireOfficial(EquipmentCatalog item) {
        if (item.getOwnerSchool() != null) {
            throw new FieldValidationException("id",
                    "Thiết bị ngoài danh mục của trường không được sửa hoặc xoá qua danh mục dùng chung");
        }
    }

    /** {@code ownership=official}: chỉ danh mục của Sở; {@code school}: chỉ thiết bị ngoài danh mục do trường thêm. */
    private static Specification<EquipmentCatalog> ownershipFilter(ListParams params) {
        return params.filters().stream()
                .filter(filter -> filter.field().equals("ownership") && filter.value() != null)
                .map(filter -> (Specification<EquipmentCatalog>) (root, query, cb) -> switch (filter.value()) {
                    case "official" -> cb.isNull(root.get("ownerSchool"));
                    case "school" -> cb.isNotNull(root.get("ownerSchool"));
                    default -> cb.conjunction();
                })
                .reduce(Specification.unrestricted(), Specification::and);
    }

    private static Specification<EquipmentCatalog> trackingFilter(ListParams params) {
        return params.filters().stream()
                .filter(filter -> filter.field().equals("trackingType"))
                .map(filter -> {
                    TrackingType wanted;
                    try {
                        wanted = TrackingType.valueOf(filter.value().trim().toUpperCase(java.util.Locale.ROOT));
                    } catch (IllegalArgumentException exception) {
                        return (Specification<EquipmentCatalog>) (root, query, cb) -> cb.disjunction();
                    }
                    return (Specification<EquipmentCatalog>) (root, query, cb) ->
                            filter.operator() == ListParams.Operator.NE
                                    ? cb.notEqual(root.get("trackingType"), wanted)
                                    : cb.equal(root.get("trackingType"), wanted);
                })
                .reduce(Specification.unrestricted(), Specification::and);
    }

    private static Specification<EquipmentCatalog> minimumFilter(ListParams params) {
        return params.filters().stream()
                .filter(filter -> filter.field().equals("minimumRequired"))
                .map(filter -> {
                    if (!filter.value().equalsIgnoreCase("true") && !filter.value().equalsIgnoreCase("false")) {
                        return (Specification<EquipmentCatalog>) (root, query, cb) -> cb.disjunction();
                    }
                    boolean wanted = Boolean.parseBoolean(filter.value());
                    return (Specification<EquipmentCatalog>) (root, query, cb) ->
                            filter.operator() == ListParams.Operator.NE
                                    ? cb.notEqual(root.get("minimumRequired"), wanted)
                                    : cb.equal(root.get("minimumRequired"), wanted);
                })
                .reduce(Specification.unrestricted(), Specification::and);
    }

    private static void validate(EquipmentCatalog item) {
        if (item.getParent() != null && item.getParent().getOwnerSchool() != null) {
            throw new FieldValidationException("parent", "Nhóm cha phải thuộc danh mục dùng chung của Sở");
        }
        if (item.getEducationLevel() != null && !"THPT".equalsIgnoreCase(item.getEducationLevel().getCode())) {
            throw new FieldValidationException("educationLevel", "Danh mục này chỉ áp dụng cho cấp THPT");
        }
        if (!isHighSchoolGrade(item.getGrade()) || !item.getExtraGrades().stream().allMatch(EquipmentCatalogService::isHighSchoolGrade)) {
            throw new FieldValidationException("grade", "Chỉ chọn khối 10, 11 hoặc 12");
        }
        if (item.getTrackingType() == TrackingType.BULK
                && item.getAssetCategory() != AssetCategory.SUPPLY
                && item.getAssetCategory() != AssetCategory.CHEMICAL) {
            throw new FieldValidationException("trackingType", "Chỉ vật tư và hoá chất được quản lý theo số lượng");
        }
        if (item.getGrade() != null && item.getEducationLevel() != null
                && item.getGrade().getEducationLevel() != null
                && !item.getEducationLevel().getId().equals(item.getGrade().getEducationLevel().getId())) {
            throw new FieldValidationException("grade", "Khối lớp phải thuộc cấp học của thiết bị");
        }
    }

    /** Không chọn khối, hoặc khối 10 – 12 của THPT. */
    private static boolean isHighSchoolGrade(Grade grade) {
        return grade == null || (grade.getGradeNumber() != null && grade.getGradeNumber() >= 10 && grade.getGradeNumber() <= 12);
    }

    /**
     * Lọc {@code <field>.id=<id>}: khớp cái CHÍNH hoặc một cái thêm — thiết bị dùng cho cả Vật lí lẫn Công
     * nghệ phải hiện khi lọc theo môn nào trong hai. Các dạng lọc khác vẫn do bộ lọc tham chiếu chung xử lý.
     */
    private static Specification<EquipmentCatalog> primaryOrExtraFilter(ListParams params, String field, String collection) {
        Specification<EquipmentCatalog> primary = CatalogSpecifications.referenceFilter(params, field);
        Long id = params.filters().stream()
                .filter(filter -> filter.field().equals(field + ".id") && filter.value() != null && filter.value().matches("\\d+"))
                .map(filter -> Long.valueOf(filter.value()))
                .findFirst().orElse(null);
        if (id == null) {
            return primary;
        }
        return primary.or((root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<EquipmentCatalog> other = sub.from(EquipmentCatalog.class);
            sub.select(other.get("id")).where(cb.equal(other.get("id"), root.get("id")),
                    cb.equal(other.join(collection).get("id"), id));
            return cb.exists(sub);
        });
    }
}
