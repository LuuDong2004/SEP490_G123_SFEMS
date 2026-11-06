package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
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
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
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
        item.setUsefulLifeYears(request.usefulLifeYears());
        item.setStatisticalCode(blankToNull(request.statisticalCode()));
        item.setLegalBasis(blankToNull(request.legalBasis()));
        item.setDescription(blankToNull(request.description()));
        item.setUsedByTeacher(request.usedByTeacher());
        item.setUsedByStudent(request.usedByStudent());
        item.setMinimumRequired(false);
        validate(item);
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
        if (request.usefulLifeYears() != null) item.setUsefulLifeYears(request.usefulLifeYears());
        if (request.statisticalCode() != null) item.setStatisticalCode(blankToNull(request.statisticalCode()));
        if (request.legalBasis() != null) item.setLegalBasis(blankToNull(request.legalBasis()));
        if (request.description() != null) item.setDescription(blankToNull(request.description()));
        if (request.usedByTeacher() != null) item.setUsedByTeacher(request.usedByTeacher());
        if (request.usedByStudent() != null) item.setUsedByStudent(request.usedByStudent());
        validate(item);
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
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "subject"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "educationLevel"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "grade"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "unit"),
                CatalogSpecifications.<EquipmentCatalog>referenceFilter(params, "ownerSchool"),
                trackingFilter(params), minimumFilter(params)));
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
        if (item.getGrade() != null && (item.getGrade().getGradeNumber() == null
                || item.getGrade().getGradeNumber() < 10 || item.getGrade().getGradeNumber() > 12)) {
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
}
