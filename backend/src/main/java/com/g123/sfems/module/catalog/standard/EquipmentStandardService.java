package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.StandardStatus;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EquipmentStandardService extends CatalogService<
        EquipmentStandard, EquipmentStandardRequest, EquipmentStandardPatchRequest> {
    private final EducationLevelService levels;
    private final SchoolYearService years;

    public EquipmentStandardService(EquipmentStandardRepository repository, RowLevelSecurity rowLevel,
            EducationLevelService levels, SchoolYearService years) {
        super(repository, rowLevel, EquipmentStandard.class, EquipmentStandard::new, "Bộ tiêu chuẩn");
        this.levels = levels;
        this.years = years;
    }

    @Override
    protected void applyCreate(EquipmentStandard item, EquipmentStandardRequest request) {
        item.setStatus(StandardStatus.DRAFT);
        item.setEducationLevel(request.educationLevel() == null || request.educationLevel().id() == null
                ? null : levels.get(request.educationLevel().id()));
        item.setStartSchoolYear(year(request.startSchoolYear()));
        item.setEndSchoolYear(year(request.endSchoolYear()));
        item.setStandardVersion(blankToNull(request.standardVersion()));
        validate(item);
    }

    @Override
    @Transactional
    public EquipmentStandard update(Long id, EquipmentStandardPatchRequest request) {
        requireDraft(getWritable(id));
        return super.update(id, request);
    }

    @Override
    protected void applyUpdate(EquipmentStandard item, EquipmentStandardPatchRequest request) {
        if (request.educationLevel() != null) {
            item.setEducationLevel(request.educationLevel().id() == null
                    ? null : levels.get(request.educationLevel().id()));
        }
        if (request.startSchoolYear() != null) item.setStartSchoolYear(year(request.startSchoolYear()));
        if (request.endSchoolYear() != null) item.setEndSchoolYear(year(request.endSchoolYear()));
        if (request.standardVersion() != null) item.setStandardVersion(blankToNull(request.standardVersion()));
        item.setActive(false);
        validate(item);
    }

    @Override
    protected void beforeDelete(EquipmentStandard item) {
        requireDraft(item);
    }

    @Override
    protected Specification<EquipmentStandard> extraFilters(ListParams params) {
        return Specification.allOf(List.of(
                CatalogSpecifications.<EquipmentStandard>referenceFilter(params, "educationLevel"),
                CatalogSpecifications.<EquipmentStandard>referenceFilter(params, "startSchoolYear"),
                params.filters().stream().filter(f -> f.field().equals("status")).map(f -> {
                    StandardStatus status;
                    try { status = StandardStatus.valueOf(f.value().toUpperCase(java.util.Locale.ROOT)); }
                    catch (IllegalArgumentException ex) {
                        return (Specification<EquipmentStandard>) (root, query, cb) -> cb.disjunction();
                    }
                    return (Specification<EquipmentStandard>) (root, query, cb) -> cb.equal(root.get("status"), status);
                }).reduce(Specification.unrestricted(), Specification::and)));
    }

    @Transactional
    public EquipmentStandard apply(Long id) {
        EquipmentStandard draft = getWritable(id);
        requireDraft(draft);
        long count = entityManager().createQuery(
                "SELECT count(n) FROM EquipmentNorm n WHERE n.standard = :standard", Long.class)
                .setParameter("standard", draft).getSingleResult();
        if (count == 0) throw new FieldValidationException("status", "Bộ nháp cần có ít nhất một dòng định mức");
        List<EquipmentStandard> active = entityManager().createQuery(
                "SELECT s FROM EquipmentStandard s WHERE s.status = :status", EquipmentStandard.class)
                .setParameter("status", StandardStatus.ACTIVE).getResultList();
        active.forEach(s -> s.setStatus(StandardStatus.RETIRED));
        draft.setStatus(StandardStatus.ACTIVE);
        return draft;
    }

    @Transactional
    public EquipmentStandard revise(Long id) {
        EquipmentStandard source = get(id);
        if (source.getStatus() != StandardStatus.ACTIVE) {
            throw new FieldValidationException("status", "Chỉ lập bản mới từ bộ đang áp dụng");
        }
        EquipmentStandard draft = new EquipmentStandard();
        draft.setCode(source.getCode() + "-R" + System.currentTimeMillis());
        if (draft.getCode().length() > 64) throw new FieldValidationException("code", "Mã bộ quá dài để lập bản mới");
        draft.setName(source.getName());
        draft.setSortOrder(source.getSortOrder());
        draft.setNote(source.getNote());
        draft.setEducationLevel(source.getEducationLevel());
        draft.setStartSchoolYear(source.getStartSchoolYear());
        draft.setEndSchoolYear(source.getEndSchoolYear());
        draft.setStandardVersion(source.getStandardVersion());
        draft.setStatus(StandardStatus.DRAFT);
        entityManager().persist(draft);
        entityManager().flush();
        entityManager().createNativeQuery("""
                INSERT INTO equipment_norms (code, name, sort_order, active, note, standard_id,
                    catalog_id, equipment_type_id, subject_id, grade_id, room_type_id, min_quantity,
                    basis_size, quantity_text, unit_text, unit_id, norm_basis, item_no, topic,
                    purpose, description, for_teacher, for_student, optional, created_at)
                SELECT n.code || '-R' || :draftId, n.name, n.sort_order, n.active, n.note, :draftId,
                    n.catalog_id, n.equipment_type_id, n.subject_id, n.grade_id, n.room_type_id,
                    n.min_quantity, n.basis_size, n.quantity_text, n.unit_text, n.unit_id, n.norm_basis,
                    n.item_no, n.topic, n.purpose, n.description, n.for_teacher, n.for_student,
                    n.optional, now()
                FROM equipment_norms n WHERE n.standard_id = :sourceId
                """).setParameter("draftId", draft.getId()).setParameter("sourceId", id).executeUpdate();
        return draft;
    }

    public static void requireDraft(EquipmentStandard item) {
        if (item.getStatus() != StandardStatus.DRAFT) {
            throw new FieldValidationException("status", "Chỉ sửa hoặc xoá bộ tiêu chuẩn đang là bản nháp");
        }
    }

    private com.g123.sfems.domain.catalog.schoolyear.SchoolYear year(IdRef ref) {
        return ref == null || ref.id() == null ? null : years.get(ref.id());
    }

    private static void validate(EquipmentStandard item) {
        if (item.getEducationLevel() == null || !"THPT".equalsIgnoreCase(item.getEducationLevel().getCode())) {
            throw new FieldValidationException("educationLevel", "Bộ tiêu chuẩn phải thuộc cấp THPT");
        }
        if (item.getStartSchoolYear() != null && item.getEndSchoolYear() != null
                && item.getEndSchoolYear().getStartDate().isBefore(item.getStartSchoolYear().getStartDate())) {
            throw new FieldValidationException("endSchoolYear", "Năm học kết thúc phải từ năm bắt đầu trở đi");
        }
    }
}
