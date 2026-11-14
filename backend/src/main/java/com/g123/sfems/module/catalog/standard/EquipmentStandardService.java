package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.EquipmentStandardDocument;
import com.g123.sfems.domain.catalog.standard.StandardStatus;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bộ tiêu chuẩn thiết bị. Phần chung ở {@link CatalogService}; lớp này giữ:
 *
 * <ul>
 *   <li>năm học kết thúc không được trước năm học bắt đầu</li>
 *   <li>bộ không thay thế chính nó</li>
 *   <li>đồng bộ danh sách văn bản căn cứ theo id — sửa văn bản cũ tại chỗ để
 *       các dòng định mức trỏ vào nó không mất liên kết</li>
 * </ul>
 */
@Service
public class EquipmentStandardService extends CatalogService<
        EquipmentStandard, EquipmentStandardRequest, EquipmentStandardPatchRequest> {

    private final EducationLevelService educationLevels;
    private final SchoolYearService schoolYears;
    private final CallerSchoolLevel callerLevel;
    private final EquipmentCatalogService catalogs;

    public EquipmentStandardService(
            EquipmentStandardRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            SchoolYearService schoolYears,
            CallerSchoolLevel callerLevel,
            EquipmentCatalogService catalogs) {
        super(repository, rowLevel, EquipmentStandard.class, EquipmentStandard::new,
                "Bộ tiêu chuẩn");
        this.catalogs = catalogs;
        this.educationLevels = educationLevels;
        this.schoolYears = schoolYears;
        this.callerLevel = callerLevel;
    }

    /** Bộ mới tạo tay luôn là NHÁP: áp dụng là một hành động riêng ({@link #apply}). */
    @Override
    protected void applyCreate(EquipmentStandard item, EquipmentStandardRequest request) {
        item.setStatus(StandardStatus.DRAFT);
        item.setStandardVersion(blankToNull(request.standardVersion()));
        if (present(request.educationLevel())) {
            item.setEducationLevel(educationLevels.get(request.educationLevel().id()));
        }
        if (present(request.startSchoolYear())) {
            item.setStartSchoolYear(schoolYears.get(request.startSchoolYear().id()));
        }
        if (present(request.endSchoolYear())) {
            item.setEndSchoolYear(schoolYears.get(request.endSchoolYear().id()));
        }
        if (present(request.previousStandard())) {
            item.setPreviousStandard(get(request.previousStandard().id()));
        }
        requireYearRange(item);
        if (request.documents() != null) {
            syncDocuments(item, request.documents());
        }
    }

    @Override
    protected void applyUpdate(EquipmentStandard item, EquipmentStandardPatchRequest request) {
        if (request.standardVersion() != null) {
            item.setStandardVersion(blankToNull(request.standardVersion()));
        }
        // Ba trạng thái: vắng mặt là để nguyên, id null là xoá, id n là gán.
        if (request.educationLevel() != null) {
            item.setEducationLevel(request.educationLevel().id() == null
                    ? null : educationLevels.get(request.educationLevel().id()));
        }
        if (request.startSchoolYear() != null) {
            item.setStartSchoolYear(yearOf(request.startSchoolYear()));
        }
        if (request.endSchoolYear() != null) {
            item.setEndSchoolYear(yearOf(request.endSchoolYear()));
        }
        if (request.previousStandard() != null) {
            Long previousId = request.previousStandard().id();
            if (previousId != null && previousId.equals(item.getId())) {
                throw new FieldValidationException(
                        "previousStandard", "Bộ tiêu chuẩn không thể thay thế chính nó");
            }
            item.setPreviousStandard(previousId == null ? null : get(previousId));
        }
        requireYearRange(item);
        if (request.documents() != null) {
            syncDocuments(item, request.documents());
        }
        // Cờ "Đang hoạt động" của form không đổi được trạng thái: chỉ Áp dụng / Lập bộ mới đổi nó.
        item.setActive(item.getStatus() == StandardStatus.ACTIVE);
    }

    /** Bộ đã áp dụng (đang hay đã hết hiệu lực) là lịch sử — không xoá; bộ nháp xoá cùng thiết bị của nó. */
    @Override
    protected void beforeDelete(EquipmentStandard item) {
        if (item.getStatus() != StandardStatus.DRAFT) {
            throw new FieldValidationException("status",
                    "Bộ đã áp dụng không xoá được — đó là căn cứ của dữ liệu đã có. Chỉ bộ nháp xoá được.");
        }
        entityManager().createQuery("DELETE FROM EquipmentNorm n WHERE n.standard = :s")
                .setParameter("s", item).executeUpdate();
    }

    /**
     * Lập bộ mới theo văn bản mới: chép bộ {@code id} (văn bản căn cứ và TOÀN BỘ dòng thiết bị) thành
     * một bộ NHÁP, trỏ {@code previousStandard} về bộ cũ. Sửa thiết bị và văn bản trong bản nháp rồi
     * {@link #apply} — bộ cũ không bị đụng tới cho tới lúc đó.
     */
    @Transactional
    public EquipmentStandard revise(Long id, String standardVersion) {
        EquipmentStandard source = get(id);
        if (source.getStatus() == StandardStatus.DRAFT) {
            throw new FieldValidationException("status", "Đây đã là bộ nháp — sửa thẳng trên bộ này.");
        }
        if (source.getStatus() == StandardStatus.RETIRED) {
            throw new FieldValidationException("status", "Bộ đã hết hiệu lực — lập bộ mới từ bộ đang áp dụng.");
        }
        boolean hasDraft = !entityManager().createQuery(
                "SELECT s.id FROM EquipmentStandard s WHERE s.previousStandard = :p AND s.status = :d", Long.class)
                .setParameter("p", source).setParameter("d", StandardStatus.DRAFT)
                .getResultList().isEmpty();
        if (hasDraft) {
            throw new FieldValidationException("status", "Bộ này đã có một bản nháp đang soạn — mở bản nháp đó.");
        }

        EquipmentStandard draft = new EquipmentStandard();
        draft.setCode(nextRevisionCode(source.getCode()));
        draft.setName(source.getName());
        draft.setSortOrder(source.getSortOrder());
        draft.setNote(source.getNote());
        draft.setEducationLevel(source.getEducationLevel());
        draft.setStandardVersion(standardVersion == null || standardVersion.isBlank()
                ? "Bản sửa đổi (nháp)" : standardVersion.trim());
        draft.setPreviousStandard(source);
        draft.setStatus(StandardStatus.DRAFT);
        int order = 1;
        for (EquipmentStandardDocument d : source.getDocuments()) {
            EquipmentStandardDocument copy = new EquipmentStandardDocument(draft);
            copy.setDocumentRole(d.getDocumentRole());
            copy.setDocumentNo(d.getDocumentNo());
            copy.setDocumentName(d.getDocumentName());
            copy.setIssuingAuthority(d.getIssuingAuthority());
            copy.setIssueDate(d.getIssueDate());
            copy.setEffectiveDate(d.getEffectiveDate());
            copy.setUrl(d.getUrl());
            copy.setSortOrder(order++);
            draft.getDocuments().add(copy);
        }
        entityManager().persist(draft);
        entityManager().flush();

        // Chép mọi dòng thiết bị, giữ nguyên mã (mã chỉ duy nhất trong một bộ); văn bản nguồn của dòng
        // trỏ sang bản chép của đúng văn bản ấy (khớp theo số hiệu).
        entityManager().createNativeQuery("""
                INSERT INTO equipment_norms (code, name, sort_order, active, note, standard_id, equipment_type_id,
                    subject_id, grade_id, room_type_id, min_quantity, unit_id, norm_basis, source_document_id,
                    created_at, catalog_id, basis_size, quantity_text, unit_text, grade_levels, item_no,
                    section_name, topic, purpose, description, for_teacher, for_student, optional)
                SELECT n.code, n.name, n.sort_order, n.active, n.note, :draft, n.equipment_type_id,
                    n.subject_id, n.grade_id, n.room_type_id, n.min_quantity, n.unit_id, n.norm_basis,
                    (SELECT nd.id FROM equipment_standard_documents od
                     JOIN equipment_standard_documents nd ON nd.standard_id = :draft AND nd.document_no = od.document_no
                     WHERE od.id = n.source_document_id LIMIT 1),
                    now(), n.catalog_id, n.basis_size, n.quantity_text, n.unit_text, n.grade_levels, n.item_no,
                    n.section_name, n.topic, n.purpose, n.description, n.for_teacher, n.for_student, n.optional
                FROM equipment_norms n WHERE n.standard_id = :source""")
                .setParameter("draft", draft.getId())
                .setParameter("source", source.getId())
                .executeUpdate();
        return draft;
    }

    /**
     * Áp dụng bộ nháp: bộ đang áp dụng của cùng cấp học chuyển HẾT HIỆU LỰC, bộ này thành ĐANG ÁP DỤNG,
     * và cờ "thuộc danh mục tối thiểu" của danh mục thiết bị tính lại theo các bộ đang áp dụng.
     */
    @Transactional
    public EquipmentStandard apply(Long id) {
        EquipmentStandard draft = get(id);
        if (draft.getStatus() != StandardStatus.DRAFT) {
            throw new FieldValidationException("status", "Chỉ bộ nháp mới áp dụng được.");
        }
        if (draft.getDocuments().isEmpty()) {
            throw new FieldValidationException("documents", "Bộ chưa có văn bản căn cứ — khai văn bản trước khi áp dụng.");
        }
        Long norms = entityManager().createQuery(
                "SELECT count(n) FROM EquipmentNorm n WHERE n.standard = :s", Long.class)
                .setParameter("s", draft).getSingleResult();
        if (norms == 0) {
            throw new FieldValidationException("status", "Bộ chưa có thiết bị nào.");
        }
        for (EquipmentStandard current : entityManager().createQuery(
                "SELECT s FROM EquipmentStandard s WHERE s.educationLevel = :lv AND s.status = :a", EquipmentStandard.class)
                .setParameter("lv", draft.getEducationLevel()).setParameter("a", StandardStatus.ACTIVE)
                .getResultList()) {
            current.setStatus(StandardStatus.RETIRED);
        }
        // Đẩy "hết hiệu lực" xuống trước: chỉ mục duy nhất "mỗi cấp một bộ đang áp dụng".
        entityManager().flush();
        draft.setStatus(StandardStatus.ACTIVE);
        entityManager().flush();
        // Dòng chưa gắn thiết bị (thêm tay trong bản nháp, hoặc nhập từ Excel mà danh mục chưa có) sinh ra
        // thiết bị CHUẨN ngay lúc áp dụng — danh mục thiết bị chỉ thêm thiết bị của thông tư bằng lối này.
        String legalBasis = draft.getDocuments().stream().map(EquipmentStandardDocument::getDocumentNo)
                .filter(no -> no != null && !no.isBlank()).collect(Collectors.joining(", "));
        for (EquipmentNorm norm : entityManager().createQuery(
                "SELECT n FROM EquipmentNorm n WHERE n.standard = :s AND n.catalog IS NULL ORDER BY n.id", EquipmentNorm.class)
                .setParameter("s", draft).getResultList()) {
            norm.setCatalog(catalogs.ensureForStandard(draft.getEducationLevel(), norm.getSubject(), norm.getName(),
                    norm.getEquipmentType(), norm.getUnit(), norm.getDescription(), norm.isForTeacher(), norm.isForStudent(),
                    legalBasis));
        }
        entityManager().flush();
        entityManager().createNativeQuery("""
                UPDATE equipment_catalogs c SET minimum_required = EXISTS (
                    SELECT 1 FROM equipment_norms n JOIN equipment_standards s ON s.id = n.standard_id
                    WHERE n.catalog_id = c.id AND n.active AND s.status = 'ACTIVE')
                WHERE c.owner_school_id IS NULL""").executeUpdate();
        return draft;
    }

    /** {@code STD-TH} → {@code STD-TH-2}, {@code STD-TH-2} → {@code STD-TH-3}: số nhỏ nhất còn trống. */
    private String nextRevisionCode(String code) {
        String base = code.replaceFirst("-\\d+$", "");
        for (int n = 2; ; n++) {
            String candidate = base + "-" + n;
            Long taken = entityManager().createQuery(
                    "SELECT count(s) FROM EquipmentStandard s WHERE lower(s.code) = lower(:c)", Long.class)
                    .setParameter("c", candidate).getSingleResult();
            if (taken == 0) {
                return candidate;
            }
        }
    }

    /** Lọc theo cấp học: {@code educationLevel.id=n}. */
    @Override
    protected Specification<EquipmentStandard> extraFilters(ListParams params) {
        Specification<EquipmentStandard> byParam = CatalogSpecifications.referenceFilter(params, "educationLevel");
        // Tài khoản của một trường chỉ thấy bộ tiêu chuẩn của CẤP HỌC trường mình — cùng luật với danh
        // mục thiết bị (`EquipmentCatalogService.levelScope`). Ghép AND nên tham số lọc không nới được.
        Long levelId = callerLevel.educationLevelId();
        if (levelId == null) {
            return byParam;
        }
        return byParam.and((root, q, cb) -> cb.equal(root.get("educationLevel").get("id"), levelId));
    }

    private SchoolYear yearOf(IdRef ref) {
        return ref.id() == null ? null : schoolYears.get(ref.id());
    }

    private static boolean present(IdRef ref) {
        return ref != null && ref.id() != null;
    }

    private static void requireYearRange(EquipmentStandard item) {
        SchoolYear start = item.getStartSchoolYear();
        SchoolYear end = item.getEndSchoolYear();
        if (start != null && end != null && end.getStartDate().isBefore(start.getStartDate())) {
            throw new FieldValidationException(
                    "endSchoolYear", "Năm học kết thúc phải từ năm học bắt đầu trở đi");
        }
    }

    private void syncDocuments(EquipmentStandard item, List<StandardDocumentInput> inputs) {
        Map<Long, EquipmentStandardDocument> existing = new HashMap<>();
        for (EquipmentStandardDocument doc : item.getDocuments()) {
            existing.put(doc.getId(), doc);
        }

        List<EquipmentStandardDocument> keep = new ArrayList<>();
        int order = 1;
        for (StandardDocumentInput input : inputs) {
            EquipmentStandardDocument doc = input.id() == null ? null : existing.get(input.id());
            if (doc == null) {
                doc = new EquipmentStandardDocument(item);
                item.getDocuments().add(doc);
            }
            doc.setDocumentRole(input.documentRole());
            doc.setDocumentNo(input.documentNo().trim());
            doc.setDocumentName(blankToNull(input.documentName()));
            doc.setIssuingAuthority(blankToNull(input.issuingAuthority()));
            doc.setIssueDate(input.issueDate());
            doc.setEffectiveDate(input.effectiveDate());
            doc.setUrl(blankToNull(input.url()));
            doc.setSortOrder(order++);
            keep.add(doc);
        }
        // Sửa trên CHÍNH tập Hibernate đang theo dõi, không gán tập mới.
        item.getDocuments().retainAll(keep);
    }
}
