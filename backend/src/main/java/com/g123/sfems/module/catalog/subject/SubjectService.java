package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.subjectgroup.SubjectGroupService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class SubjectService extends CatalogService<Subject, SubjectRequest, SubjectPatchRequest> {

    private final SubjectRepository repository;
    private final EducationLevelService educationLevels;
    private final SubjectGroupService subjectGroups;

    public SubjectService(
            SubjectRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            SubjectGroupService subjectGroups) {
        super(repository, rowLevel, Subject.class, Subject::new, "Môn học");
        this.repository = repository;
        this.educationLevels = educationLevels;
        this.subjectGroups = subjectGroups;
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    /** Ô tìm nhanh dò cả mã môn ngắn, để gõ "TO" ra được môn Toán. */
    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "shortCode");
    }

    @Override
    protected void applyCreate(Subject item, SubjectRequest request) {
        item.setShortCode(normalizeShortCode(request.shortCode(), null));
        item.setEducationLevel(resolveEducationLevel(request.educationLevel()));
        item.setSubjectGroup(resolveSubjectGroup(request.subjectGroup()));
    }

    @Override
    protected void applyUpdate(Subject item, SubjectPatchRequest request) {
        if (request.shortCode() != null) {
            item.setShortCode(normalizeShortCode(request.shortCode(), item.getId()));
        }
        if (request.educationLevel() != null) {
            item.setEducationLevel(resolveEducationLevel(request.educationLevel()));
        }
        if (request.subjectGroup() != null) {
            item.setSubjectGroup(resolveSubjectGroup(request.subjectGroup()));
        }
    }

    /** Lọc {@code educationLevel.id=1} và {@code subjectGroup.id=2}. */
    @Override
    protected Specification<Subject> extraFilters(ListParams params) {
        return CatalogSpecifications.<Subject>referenceFilter(params, "educationLevel")
                .and(CatalogSpecifications.referenceFilter(params, "subjectGroup"));
    }

    /**
     * Viết hoa, rỗng thành {@code null}, và từ chối mã đã thuộc môn khác. Mã môn là một phần của mã
     * tài sản (DR-08), nên hai môn trùng mã sẽ sinh ra hai tài sản trùng mã.
     */
    private String normalizeShortCode(String raw, Long selfId) {
        String shortCode = blankToNull(raw);
        if (shortCode == null) {
            return null;
        }
        shortCode = shortCode.toUpperCase();
        repository.findByShortCodeIgnoreCase(shortCode)
                .filter(other -> !other.getId().equals(selfId))
                .ifPresent(other -> {
                    throw new FieldValidationException("shortCode",
                            "Mã môn %s đã dùng cho môn %s".formatted(other.getShortCode(), other.getName()));
                });
        return shortCode;
    }

    /** Cấp học giảng dạy là bắt buộc; đi qua service của cấp học để id lạ trả đúng lỗi 404. */
    private EducationLevel resolveEducationLevel(IdRef ref) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("educationLevel", "Chọn cấp học giảng dạy");
        }
        return educationLevels.get(ref.id());
    }

    /** Tổ chuyên môn không bắt buộc: vắng hoặc id rỗng là môn chưa xếp tổ. */
    private SubjectGroup resolveSubjectGroup(IdRef ref) {
        return ref == null || ref.id() == null ? null : subjectGroups.get(ref.id());
    }
}
