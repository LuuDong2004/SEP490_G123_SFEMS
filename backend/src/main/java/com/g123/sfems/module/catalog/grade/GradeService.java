package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;

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

/**
 * Khối lớp. Phần chung ở {@link CatalogService}; lớp này gán {@code teachingCode} và
 * cấp học.
 *
 * <p>Cấp học phân giải qua {@link EducationLevelService} chứ không qua
 * repository của nó — id lạ sinh ra đúng lỗi 404 của resource cấp học, thay vì
 * một lỗi ràng buộc lúc flush.
 */
@Service
public class GradeService extends CatalogService<Grade, GradeRequest, GradePatchRequest> {

    @Override
    protected boolean codeLocked() {
        return true;
    }

    private final EducationLevelService educationLevels;
    private final CallerSchoolLevel callerLevel;
    private final GradeRepository grades;

    public GradeService(
            GradeRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, Grade.class, Grade::new, "Khối lớp");
        this.educationLevels = educationLevels;
        this.callerLevel = callerLevel;
        this.grades = repository;
    }

    @Override
    protected void applyCreate(Grade item, GradeRequest request) {
        item.setTeachingCode(blankToNull(request.teachingCode()));
        IdRef level = request.educationLevel();
        // Khối lớp không cấp học thì không trường nào thấy (lọc theo cấp của trường) — vô dụng ngay từ lúc tạo.
        if (level == null || level.id() == null) {
            throw new FieldValidationException("educationLevel", "Chọn cấp học");
        }
        item.setEducationLevel(educationLevels.get(level.id()));
        requireNameFreeInLevel(item, null);
    }

    @Override
    protected void applyUpdate(Grade item, GradePatchRequest request) {
        if (request.teachingCode() != null) {
            item.setTeachingCode(blankToNull(request.teachingCode()));
        }
        // Ba trạng thái: vắng mặt là để nguyên, id null là xoá, id n là gán.
        IdRef level = request.educationLevel();
        if (level != null) {
            if (level.id() == null) {
                throw new FieldValidationException("educationLevel", "Chọn cấp học");
            }
            item.setEducationLevel(educationLevels.get(level.id()));
        }
        if (request.name() != null || level != null) {
            requireNameFreeInLevel(item, item.getId());
        }
    }

    /** Hai "Lớp 10" trong cùng một cấp học là hai lựa chọn không ai phân biệt được; khác cấp thì không sao. */
    private void requireNameFreeInLevel(Grade item, Long selfId) {
        if (item.getEducationLevel() == null || item.getName() == null) {
            return;
        }
        if (grades.existsByEducationLevelIdAndNameIgnoreCaseAndIdNot(
                item.getEducationLevel().getId(), item.getName(), selfId == null ? -1L : selfId)) {
            throw new FieldValidationException("name",
                    "Khối lớp \"%s\" đã có trong cấp học này".formatted(item.getName()));
        }
    }

    @Override
    protected Specification<Grade> extraFilters(ListParams params) {
        Specification<Grade> byParam = CatalogSpecifications.referenceFilter(params, "educationLevel");
        // Tài khoản của một trường chỉ thấy khối lớp của CẤP HỌC trường mình (xem `CallerSchoolLevel`).
        Long levelId = callerLevel.educationLevelId();
        return levelId == null ? byParam
                : byParam.and((root, q, cb) -> cb.equal(root.get("educationLevel").get("id"), levelId));
    }
}
