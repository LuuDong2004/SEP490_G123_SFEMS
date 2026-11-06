package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
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
        long documentCount = entityManager().createQuery(
                "SELECT count(d) FROM EquipmentStandardDocument d WHERE d.standard = :standard", Long.class)
                .setParameter("standard", draft).getSingleResult();
        if (documentCount == 0) throw new FieldValidationException("documents", "Bộ nháp cần có văn bản căn cứ trước khi áp dụng");
        List<EquipmentStandard> active = entityManager().createQuery(
                "SELECT s FROM EquipmentStandard s WHERE s.status = :status AND s.educationLevel = :level", EquipmentStandard.class)
                .setParameter("status", StandardStatus.ACTIVE)
                .setParameter("level", draft.getEducationLevel()).getResultList();
        active.forEach(s -> s.setStatus(StandardStatus.RETIRED));
        entityManager().flush();
        draft.setStatus(StandardStatus.ACTIVE);
        entityManager().flush();
        List<EquipmentNorm> unlinked = entityManager().createQuery(
                "SELECT n FROM EquipmentNorm n WHERE n.standard = :standard AND n.catalog IS NULL", EquipmentNorm.class)
                .setParameter("standard", draft).getResultList();
        for (EquipmentNorm norm : unlinked) {
            EquipmentCatalog catalog = new EquipmentCatalog();
            catalog.setCode("THPT-NORM-" + norm.getId());
            catalog.setName(norm.getName());
            catalog.setEquipmentType(norm.getEquipmentType());
            catalog.setSubject(norm.getSubject());
            catalog.setEducationLevel(draft.getEducationLevel());
            catalog.setGrade(norm.getGrade());
            catalog.setUnit(norm.getUnit());
            catalog.setDescription(norm.getDescription());
            catalog.setLegalBasis(draft.getStandardVersion());
            catalog.setUsedByTeacher(norm.isForTeacher());
            catalog.setUsedByStudent(norm.isForStudent());
            entityManager().persist(catalog);
            norm.setCatalog(catalog);
        }
        entityManager().flush();
        entityManager().createNativeQuery("""
                UPDATE equipment_catalogs c SET minimum_required = EXISTS (
                    SELECT 1 FROM equipment_norms n JOIN equipment_standards s ON s.id = n.standard_id
                    WHERE n.catalog_id = c.id AND n.active AND s.status = 'ACTIVE')
                WHERE c.owner_school_id IS NULL
                """).executeUpdate();
        return draft;
    }

    @Transactional
    public EquipmentStandard revise(Long id, String standardVersion) {
        EquipmentStandard source = get(id);
        if (source.getStatus() != StandardStatus.ACTIVE) {
            throw new FieldValidationException("status", "Chỉ lập bản mới từ bộ đang áp dụng");
        }
        long existingDrafts = entityManager().createQuery("""
                SELECT count(s) FROM EquipmentStandard s
                WHERE s.previousStandard = :source AND s.status = :status
                """, Long.class)
                .setParameter("source", source).setParameter("status", StandardStatus.DRAFT)
                .getSingleResult();
        if (existingDrafts > 0) {
            throw new FieldValidationException("status", "Bộ này đã có bản nháp đang soạn");
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
        draft.setStandardVersion(standardVersion == null || standardVersion.isBlank()
                ? "Bản sửa đổi (nháp)" : standardVersion.trim());
        draft.setPreviousStandard(source);
        draft.setStatus(StandardStatus.DRAFT);
        entityManager().persist(draft);
        entityManager().flush();
        List<EquipmentStandardDocument> sourceDocuments = entityManager().createQuery(
                "SELECT d FROM EquipmentStandardDocument d WHERE d.standard = :source ORDER BY d.sortOrder, d.id",
                EquipmentStandardDocument.class).setParameter("source", source).getResultList();
        for (EquipmentStandardDocument original : sourceDocuments) {
            EquipmentStandardDocument copy = new EquipmentStandardDocument();
            copy.setStandard(draft);
            copy.setDocumentRole(original.getDocumentRole());
            copy.setDocumentNo(original.getDocumentNo());
            copy.setDocumentName(original.getDocumentName());
            copy.setIssuingAuthority(original.getIssuingAuthority());
            copy.setIssueDate(original.getIssueDate());
            copy.setEffectiveDate(original.getEffectiveDate());
            copy.setUrl(original.getUrl());
            copy.setSortOrder(original.getSortOrder());
            entityManager().persist(copy);
        }
        entityManager().flush();
        entityManager().createNativeQuery("""
                INSERT INTO equipment_norms (code, name, sort_order, active, note, standard_id,
                    catalog_id, equipment_type_id, subject_id, grade_id, room_type_id, min_quantity,
                    basis_size, quantity_text, unit_text, unit_id, norm_basis, item_no, grade_levels, section_name, topic,
                    purpose, description, for_teacher, for_student, optional, source_document_id, created_at)
                SELECT n.code || '-R' || :draftId, n.name, n.sort_order, n.active, n.note, :draftId,
                    n.catalog_id, n.equipment_type_id, n.subject_id, n.grade_id, n.room_type_id,
                    n.min_quantity, n.basis_size, n.quantity_text, n.unit_text, n.unit_id, n.norm_basis,
                    n.item_no, n.grade_levels, n.section_name, n.topic, n.purpose, n.description, n.for_teacher, n.for_student,
                    n.optional,
                    (SELECT nd.id FROM equipment_standard_documents od
                     JOIN equipment_standard_documents nd ON nd.standard_id = :draftId AND nd.document_no = od.document_no
                     WHERE od.id = n.source_document_id LIMIT 1), now()
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
