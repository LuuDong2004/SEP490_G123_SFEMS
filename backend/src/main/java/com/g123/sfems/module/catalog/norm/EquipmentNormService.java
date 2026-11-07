package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.equipmenttype.EquipmentTypeService;
import com.g123.sfems.module.catalog.grade.GradeService;
import com.g123.sfems.module.catalog.roomtype.RoomTypeService;
import com.g123.sfems.module.catalog.standard.EquipmentStandardService;
import com.g123.sfems.module.catalog.standard.StandardDocumentService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.catalog.unit.UnitService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EquipmentNormService extends CatalogService<
        EquipmentNorm, EquipmentNormRequest, EquipmentNormPatchRequest> {
    private final EquipmentStandardService standards;
    private final EquipmentCatalogService catalogs;
    private final EquipmentTypeService types;
    private final SubjectService subjects;
    private final GradeService grades;
    private final RoomTypeService rooms;
    private final UnitService units;
    private final StandardDocumentService documents;
    private final EquipmentNormRepository repository;

    public EquipmentNormService(EquipmentNormRepository repository, RowLevelSecurity rowLevel,
            EquipmentStandardService standards, EquipmentCatalogService catalogs,
            EquipmentTypeService types, SubjectService subjects, GradeService grades,
            RoomTypeService rooms, UnitService units, StandardDocumentService documents) {
        super(repository, rowLevel, EquipmentNorm.class, EquipmentNorm::new, "Dòng định mức");
        this.standards = standards;
        this.catalogs = catalogs;
        this.types = types;
        this.subjects = subjects;
        this.grades = grades;
        this.rooms = rooms;
        this.units = units;
        this.documents = documents;
        this.repository = repository;
    }

    @Override
    protected void applyCreate(EquipmentNorm item, EquipmentNormRequest request) {
        EquipmentStandard standard = ref(request.standard(), standards::get);
        if (standard == null) throw new FieldValidationException("standard", "Chọn bộ tiêu chuẩn");
        EquipmentStandardService.requireDraft(standard);
        item.setStandard(standard);
        item.setCatalog(ref(request.catalog(), catalogs::get));
        item.setSourceDocument(document(standard, request.sourceDocument()));
        item.setEquipmentType(ref(request.equipmentType(), types::get));
        item.setSubject(ref(request.subject(), subjects::get));
        item.setGrade(ref(request.grade(), grades::get));
        item.setRoomType(ref(request.roomType(), rooms::get));
        item.setMinQuantity(request.minQuantity());
        item.setBasisSize(request.basisSize());
        item.setQuantityText(blankToNull(request.quantityText()));
        item.setUnitText(blankToNull(request.unitText()));
        item.setUnit(ref(request.unit(), units::get));
        if (request.normBasis() != null) item.setNormBasis(request.normBasis());
        item.setItemNo(blankToNull(request.itemNo()));
        item.setGradeLevels(blankToNull(request.gradeLevels()));
        item.setSectionName(blankToNull(request.sectionName()));
        item.setTopic(blankToNull(request.topic()));
        item.setPurpose(blankToNull(request.purpose()));
        item.setDescription(blankToNull(request.description()));
        item.setForTeacher(Boolean.TRUE.equals(request.forTeacher()));
        item.setForStudent(Boolean.TRUE.equals(request.forStudent()));
        item.setOptional(Boolean.TRUE.equals(request.optional()));
        inheritCatalog(item);
        validate(item);
    }

    @Override
    @Transactional
    public EquipmentNorm update(Long id, EquipmentNormPatchRequest request) {
        EquipmentNorm item = getWritable(id);
        EquipmentStandardService.requireDraft(item.getStandard());
        return super.update(id, request);
    }

    @Override
    protected void applyUpdate(EquipmentNorm item, EquipmentNormPatchRequest request) {
        if (request.standard() != null && !item.getStandard().getId().equals(request.standard().id())) {
            throw new FieldValidationException("standard", "Không chuyển dòng sang bộ tiêu chuẩn khác");
        }
        if (request.catalog() != null) item.setCatalog(ref(request.catalog(), catalogs::get));
        if (request.sourceDocument() != null) item.setSourceDocument(document(item.getStandard(), request.sourceDocument()));
        if (request.equipmentType() != null) item.setEquipmentType(ref(request.equipmentType(), types::get));
        if (request.subject() != null) item.setSubject(ref(request.subject(), subjects::get));
        if (request.grade() != null) item.setGrade(ref(request.grade(), grades::get));
        if (request.roomType() != null) item.setRoomType(ref(request.roomType(), rooms::get));
        if (request.minQuantity() != null) item.setMinQuantity(request.minQuantity());
        if (request.basisSize() != null) item.setBasisSize(request.basisSize());
        if (request.quantityText() != null) item.setQuantityText(blankToNull(request.quantityText()));
        if (request.unitText() != null) item.setUnitText(blankToNull(request.unitText()));
        if (request.unit() != null) item.setUnit(ref(request.unit(), units::get));
        if (request.normBasis() != null) item.setNormBasis(request.normBasis());
        if (request.itemNo() != null) item.setItemNo(blankToNull(request.itemNo()));
        if (request.gradeLevels() != null) item.setGradeLevels(blankToNull(request.gradeLevels()));
        if (request.sectionName() != null) item.setSectionName(blankToNull(request.sectionName()));
        if (request.topic() != null) item.setTopic(blankToNull(request.topic()));
        if (request.purpose() != null) item.setPurpose(blankToNull(request.purpose()));
        if (request.description() != null) item.setDescription(blankToNull(request.description()));
        if (request.forTeacher() != null) item.setForTeacher(request.forTeacher());
        if (request.forStudent() != null) item.setForStudent(request.forStudent());
        if (request.optional() != null) item.setOptional(request.optional());
        inheritCatalog(item);
        validate(item);
    }

    @Override
    protected void beforeDelete(EquipmentNorm item) {
        EquipmentStandardService.requireDraft(item.getStandard());
    }

    @Override
    protected Specification<EquipmentNorm> extraFilters(ListParams params) {
        List<Specification<EquipmentNorm>> specs = new ArrayList<>(List.of(
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "standard"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "catalog"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "subject"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "grade"),
                CatalogSpecifications.<EquipmentNorm>referenceFilter(params, "equipmentType")));
        for (ListParams.Criterion criterion : params.filters()) {
            String value = criterion.value();
            switch (criterion.field()) {
                case "gradeLevel" -> {
                    if (value.matches("10|11|12")) specs.add((root, query, cb) -> cb.or(
                            cb.isNull(root.get("gradeLevels")),
                            cb.like(cb.concat(cb.concat(",", root.get("gradeLevels")), ","), "%," + value + ",%")));
                }
                case "target" -> {
                    if ("teacher".equals(value)) specs.add((root, query, cb) -> cb.isTrue(root.get("forTeacher")));
                    if ("student".equals(value)) specs.add((root, query, cb) -> cb.isTrue(root.get("forStudent")));
                }
                case "topic", "sectionName" -> specs.add((root, query, cb) -> cb.equal(root.get(criterion.field()), value));
                default -> { }
            }
        }
        return Specification.allOf(specs);
    }

    @Transactional(readOnly = true)
    public List<EquipmentNorm> listAll(ListParams params) {
        return repository.findAll(listSpecification(params), Sort.by("sortOrder", "id"));
    }

    @Transactional
    public int importRows(Long standardId, List<EquipmentNormRequest> rows) {
        EquipmentStandard standard = standards.get(standardId);
        EquipmentStandardService.requireDraft(standard);
        Integer max = entityManager().createQuery(
                "SELECT max(n.sortOrder) FROM EquipmentNorm n WHERE n.standard = :standard", Integer.class)
                .setParameter("standard", standard).getSingleResult();
        int order = max == null ? 0 : max;
        for (EquipmentNormRequest row : rows) create(row.withSortOrder(++order));
        return rows.size();
    }

    public record SubjectGroup(Long subjectId, String subjectCode, String subjectName, Long count, Long catalogs) { }
    public record TopicOption(Long subjectId, String subjectName, String kind, String value, Long count) { }

    @Transactional(readOnly = true)
    public List<SubjectGroup> groups(ListParams params) {
        var cb = entityManager().getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<EquipmentNorm> root = query.from(EquipmentNorm.class);
        Join<EquipmentNorm, Subject> subject = root.join("subject", JoinType.LEFT);
        var predicate = listSpecification(params).toPredicate(root, query, cb);
        query.select(cb.tuple(subject.get("id"), subject.get("code"), subject.get("name"),
                        cb.count(root), cb.countDistinct(root.get("catalog"))))
                .groupBy(subject.get("id"), subject.get("code"), subject.get("name"))
                .orderBy(cb.asc(cb.min(root.get("sortOrder"))));
        if (predicate != null) query.where(predicate);
        return entityManager().createQuery(query).getResultList().stream()
                .map(t -> new SubjectGroup(t.get(0, Long.class), t.get(1, String.class),
                        t.get(2, String.class), t.get(3, Long.class), t.get(4, Long.class)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TopicOption> topics(Long standardId) {
        standards.get(standardId);
        List<TopicOption> result = new ArrayList<>();
        for (String field : List.of("topic", "sectionName")) {
            List<Object[]> rows = entityManager().createQuery("""
                    SELECT s.id, s.name, n.%s, count(n), min(n.sortOrder)
                    FROM EquipmentNorm n LEFT JOIN n.subject s
                    WHERE n.standard.id = :standard AND n.%s IS NOT NULL AND n.active = true
                    GROUP BY s.id, s.name, n.%s
                    ORDER BY min(n.sortOrder)
                    """.formatted(field, field, field), Object[].class)
                    .setParameter("standard", standardId).getResultList();
            for (Object[] row : rows) result.add(new TopicOption((Long) row[0], (String) row[1],
                    field.equals("topic") ? "topic" : "section", (String) row[2], (Long) row[3]));
        }
        return result;
    }

    private void inheritCatalog(EquipmentNorm item) {
        if (item.getCatalog() == null) return;
        if (item.getCatalog().getOwnerSchool() != null) {
            throw new FieldValidationException("catalog", "Định mức chỉ dùng thiết bị trong danh mục chung của Sở");
        }
        if (item.getEquipmentType() == null) item.setEquipmentType(item.getCatalog().getEquipmentType());
        if (item.getSubject() == null) item.setSubject(item.getCatalog().getSubject());
        if (item.getUnit() == null) item.setUnit(item.getCatalog().getUnit());
    }

    private static void validate(EquipmentNorm item) {
        if (item.getMinQuantity() != null && item.getMinQuantity().compareTo(BigDecimal.ZERO) < 0) {
            throw new FieldValidationException("minQuantity", "Số lượng tối thiểu không được âm");
        }
        if (item.getBasisSize() != null && item.getBasisSize() < 1) {
            throw new FieldValidationException("basisSize", "Cỡ nhóm phải từ 1 trở lên");
        }
        if (item.getGrade() != null && (item.getGrade().getGradeNumber() == null
                || item.getGrade().getGradeNumber() < 10 || item.getGrade().getGradeNumber() > 12)) {
            throw new FieldValidationException("grade", "Chỉ chọn khối 10, 11 hoặc 12");
        }
        if (item.getGradeLevels() != null
                && !item.getGradeLevels().matches("(?:10|11|12)(?:,(?:10|11|12))*")) {
            throw new FieldValidationException("gradeLevels", "Chỉ nhập các khối 10, 11, 12, cách nhau bằng dấu phẩy");
        }
        if (item.getCatalog() != null && item.getCatalog().getEducationLevel() != null
                && !"THPT".equalsIgnoreCase(item.getCatalog().getEducationLevel().getCode())) {
            throw new FieldValidationException("catalog", "Thiết bị định mức phải thuộc cấp THPT");
        }
    }

    private static <T> T ref(IdRef ref, Function<Long, T> find) {
        return ref == null || ref.id() == null ? null : find.apply(ref.id());
    }

    private com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument document(
            EquipmentStandard standard, IdRef ref) {
        return ref == null || ref.id() == null ? null : documents.get(standard.getId(), ref.id());
    }
}
