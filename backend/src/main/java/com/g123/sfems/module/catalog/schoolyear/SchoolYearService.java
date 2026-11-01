package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.stereotype.Service;

@Service
public class SchoolYearService extends CatalogService<SchoolYear, SchoolYearRequest, SchoolYearPatchRequest> {

    public SchoolYearService(SchoolYearRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, SchoolYear.class, SchoolYear::new, "Năm học");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    @Override
    protected void applyCreate(SchoolYear item, SchoolYearRequest request) {
        item.setStartDate(request.startDate());
        item.setEndDate(request.endDate());
        requireEndAfterStart(item);
    }

    @Override
    protected void applyUpdate(SchoolYear item, SchoolYearPatchRequest request) {
        if (request.startDate() != null) {
            item.setStartDate(request.startDate());
        }
        if (request.endDate() != null) {
            item.setEndDate(request.endDate());
        }
        // Kiểm trên giá trị SAU khi sửa: chỉ đổi một trong hai ngày vẫn có thể làm khoảng ngày sai.
        requireEndAfterStart(item);
    }

    /** Báo vào ô ngày kết thúc thay vì để ràng buộc CHECK của DB trả một lỗi chung chung. */
    private static void requireEndAfterStart(SchoolYear item) {
        if (!item.getEndDate().isAfter(item.getStartDate())) {
            throw new FieldValidationException("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        }
    }
}
