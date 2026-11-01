package com.g123.sfems.module.catalog.semester;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.catalog.semester.Semester;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class SemesterService extends CatalogService<Semester, SemesterRequest, SemesterPatchRequest> {

    private final SchoolYearService schoolYears;

    public SemesterService(SemesterRepository repository, RowLevelSecurity rowLevel, SchoolYearService schoolYears) {
        super(repository, rowLevel, Semester.class, Semester::new, "Học kỳ");
        this.schoolYears = schoolYears;
    }

    // Không bật kiểm trùng tên: năm học nào cũng có "Học kỳ I".

    @Override
    protected void applyCreate(Semester item, SemesterRequest request) {
        item.setSchoolYear(resolveSchoolYear(request.schoolYear()));
        item.setStartDate(request.startDate());
        item.setEndDate(request.endDate());
        requireValidDates(item);
    }

    @Override
    protected void applyUpdate(Semester item, SemesterPatchRequest request) {
        if (request.schoolYear() != null) {
            item.setSchoolYear(resolveSchoolYear(request.schoolYear()));
        }
        if (request.startDate() != null) {
            item.setStartDate(request.startDate());
        }
        if (request.endDate() != null) {
            item.setEndDate(request.endDate());
        }
        // Kiểm trên giá trị SAU khi sửa: đổi năm học hay một trong hai ngày đều có thể làm khoảng ngày sai.
        requireValidDates(item);
    }

    /** Lọc {@code schoolYear.id=3} — các học kỳ của một năm học. */
    @Override
    protected Specification<Semester> extraFilters(ListParams params) {
        return CatalogSpecifications.referenceFilter(params, "schoolYear");
    }

    /** Học kỳ bắt buộc thuộc một năm học; đi qua service của năm học để id lạ trả đúng lỗi 404. */
    private SchoolYear resolveSchoolYear(IdRef ref) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("schoolYear", "Chọn năm học");
        }
        return schoolYears.get(ref.id());
    }

    /** Ngày kết thúc sau ngày bắt đầu, và cả khoảng ngày nằm trong năm học đã chọn. */
    private static void requireValidDates(Semester item) {
        if (!item.getEndDate().isAfter(item.getStartDate())) {
            throw new FieldValidationException("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        }
        SchoolYear year = item.getSchoolYear();
        if (item.getStartDate().isBefore(year.getStartDate())) {
            throw new FieldValidationException("startDate",
                    "Ngày bắt đầu phải từ ngày bắt đầu của %s trở đi".formatted(year.getName()));
        }
        if (item.getEndDate().isAfter(year.getEndDate())) {
            throw new FieldValidationException("endDate",
                    "Ngày kết thúc không được sau ngày kết thúc của %s".formatted(year.getName()));
        }
    }
}
