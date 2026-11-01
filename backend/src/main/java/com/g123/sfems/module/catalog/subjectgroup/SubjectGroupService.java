package com.g123.sfems.module.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class SubjectGroupService extends CatalogService<SubjectGroup, SubjectGroupRequest, SubjectGroupPatchRequest> {

    private final EducationLevelService educationLevels;

    public SubjectGroupService(
            SubjectGroupRepository repository, RowLevelSecurity rowLevel, EducationLevelService educationLevels) {
        super(repository, rowLevel, SubjectGroup.class, SubjectGroup::new, "Tổ chuyên môn");
        this.educationLevels = educationLevels;
    }

    /** Danh mục lựa chọn: hai tổ cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }

    @Override
    protected void applyCreate(SubjectGroup item, SubjectGroupRequest request) {
        item.setEducationLevel(resolveEducationLevel(request.educationLevel()));
    }

    @Override
    protected void applyUpdate(SubjectGroup item, SubjectGroupPatchRequest request) {
        if (request.educationLevel() != null) {
            item.setEducationLevel(resolveEducationLevel(request.educationLevel()));
        }
    }

    /** Lọc {@code educationLevel.id=1} — các tổ của một cấp học. */
    @Override
    protected Specification<SubjectGroup> extraFilters(ListParams params) {
        return CatalogSpecifications.referenceFilter(params, "educationLevel");
    }

    /** Tổ chuyên môn bắt buộc thuộc một cấp học; đi qua service của cấp học để id lạ trả đúng lỗi 404. */
    private EducationLevel resolveEducationLevel(IdRef ref) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("educationLevel", "Chọn cấp học");
        }
        return educationLevels.get(ref.id());
    }
}
