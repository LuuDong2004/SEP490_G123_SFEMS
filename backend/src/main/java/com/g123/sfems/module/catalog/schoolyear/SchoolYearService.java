package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Năm học. Phần chung ở {@link CatalogService}; lớp này giữ hai quy tắc.
 *
 * <p><b>Ngày kết thúc phải sau ngày bắt đầu</b> — kiểm trên giá trị SAU KHI
 * GỘP với bản ghi đã lưu, vì một PATCH có thể chỉ gửi một trong hai ngày.
 * Vi phạm là 422 gắn vào đúng ô {@code endDate}, để form hiện lỗi dưới ô đó.
 *
 * <p><b>Chỉ một năm hiện hành.</b> Đánh dấu một năm là hiện hành thì bỏ cờ của
 * năm cũ trong CÙNG transaction. Thứ tự quan trọng: phải bỏ cờ năm cũ TRƯỚC
 * khi đặt cờ năm mới — lệnh cập nhật hàng loạt làm Hibernate đẩy các thay đổi
 * đang chờ xuống database trước, và nếu năm mới đã mang cờ lúc đó thì unique
 * index sẽ thấy hai năm hiện hành và từ chối.
 */
@Service
public class SchoolYearService
        extends CatalogService<SchoolYear, SchoolYearRequest, SchoolYearPatchRequest> {

    /** Id không bao giờ tồn tại — "bỏ cờ của TẤT CẢ" khi năm mới chưa có id. */
    private static final long NO_ID = -1L;

    private final SchoolYearRepository repository;

    public SchoolYearService(SchoolYearRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, SchoolYear.class, SchoolYear::new, "Năm học");
        this.repository = repository;
    }

    @Override
    protected void applyCreate(SchoolYear item, SchoolYearRequest request) {
        requireRange(request.startDate(), request.endDate());
        item.setStartDate(request.startDate());
        item.setEndDate(request.endDate());
        if (Boolean.TRUE.equals(request.current())) {
            repository.clearCurrentExcept(NO_ID);
            item.setCurrent(true);
        }
    }

    @Override
    protected void applyUpdate(SchoolYear item, SchoolYearPatchRequest request) {
        LocalDate start = request.startDate() != null ? request.startDate() : item.getStartDate();
        LocalDate end = request.endDate() != null ? request.endDate() : item.getEndDate();
        requireRange(start, end);
        item.setStartDate(start);
        item.setEndDate(end);

        if (request.current() != null) {
            if (request.current() && !Boolean.TRUE.equals(item.getCurrent())) {
                repository.clearCurrentExcept(item.getId());
            }
            item.setCurrent(request.current());
        }
    }

    /**
     * Năm học của một ngày: năm học chứa ngày đó, ngày rơi ngoài mọi năm học đã khai thì năm học hiện
     * hành, chưa khai năm học nào thì {@code null}. Dùng để điền sẵn năm học cho chứng từ.
     */
    public SchoolYear forDate(LocalDate day) {
        if (day != null) {
            List<SchoolYear> found = repository.containing(day);
            if (!found.isEmpty()) {
                return found.get(0);
            }
        }
        return repository.currentYears().stream().findFirst().orElse(null);
    }

    private static void requireRange(LocalDate start, LocalDate end) {
        if (start != null && end != null && !end.isAfter(start)) {
            throw new FieldValidationException("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        }
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
