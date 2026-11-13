package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.Comparator;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class SchoolYearService extends CatalogService<SchoolYear, SchoolYearRequest, SchoolYearPatchRequest> {

    private final SchoolYearRepository repository;

    public SchoolYearService(SchoolYearRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, SchoolYear.class, SchoolYear::new, "Năm học");
        this.repository = repository;
    }

    /** Active school years for cross-feature summaries, with this feature's read scope applied. */
    public List<SchoolYear> activeForDashboard() {
        return listAllScoped(Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.asc("name"))).stream()
                .filter(year -> Boolean.TRUE.equals(year.getActive()))
                .sorted(Comparator.comparing(SchoolYear::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .toList();
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
        if (Boolean.TRUE.equals(request.current())) {
            makeCurrent(item);
        }
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
        if (Boolean.TRUE.equals(request.current())) {
            makeCurrent(item);
        } else if (Boolean.FALSE.equals(request.current())) {
            item.setCurrent(false);
        }
    }

    /** Đặt năm học này là hiện hành: bỏ cờ của năm học hiện hành cũ trước, rồi mới đặt cờ cho năm này. */
    private void makeCurrent(SchoolYear item) {
        repository.clearCurrentExcept(item.getId());
        item.setCurrent(true);
    }

    /** Báo vào ô ngày kết thúc thay vì để ràng buộc CHECK của DB trả một lỗi chung chung. */
    private static void requireEndAfterStart(SchoolYear item) {
        if (!item.getEndDate().isAfter(item.getStartDate())) {
            throw new FieldValidationException("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        }
    }
}
