package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.grade.Grade;
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
public class GradeService extends CatalogService<Grade, GradeRequest, GradePatchRequest> {

    private final EducationLevelService educationLevels;

    public GradeService(GradeRepository repository, RowLevelSecurity rowLevel, EducationLevelService educationLevels) {
        super(repository, rowLevel, Grade.class, Grade::new, "Khối lớp");
        this.educationLevels = educationLevels;
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    @Override
    protected void applyCreate(Grade item, GradeRequest request) {
        item.setEducationLevel(resolveEducationLevel(request.educationLevel()));
        item.setGradeNumber(request.gradeNumber());
    }

    @Override
    protected void applyUpdate(Grade item, GradePatchRequest request) {
        if (request.educationLevel() != null) {
            item.setEducationLevel(resolveEducationLevel(request.educationLevel()));
        }
        if (request.gradeNumber() != null) {
            item.setGradeNumber(request.gradeNumber());
        }
    }

    /** Lọc {@code educationLevel.id=4} — danh sách khối của một cấp học. */
    @Override
    protected Specification<Grade> extraFilters(ListParams params) {
        return CatalogSpecifications.referenceFilter(params, "educationLevel");
    }

    /**
     * Khối lớp bắt buộc thuộc một cấp học. Đi qua service của cấp học để id lạ trả đúng lỗi 404 của
     * cấp học, không tự đọc bảng của lát khác.
     */
    private EducationLevel resolveEducationLevel(IdRef ref) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("educationLevel", "Chọn cấp học");
        }
        return educationLevels.get(ref.id());
    }
}
