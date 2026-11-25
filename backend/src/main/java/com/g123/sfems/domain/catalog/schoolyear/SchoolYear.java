package com.g123.sfems.domain.catalog.schoolyear;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Năm học — ví dụ "Năm học 2025-2026", từ 05/09/2025 tới 31/05/2026.
 *
 * <p>Năm trường chung ở {@link CatalogEntity}; lớp này thêm khoảng ngày và cờ
 * "hiện hành".
 *
 * <h2>Chỉ MỘT năm học hiện hành, và database giữ điều đó</h2>
 *
 * <p>Nhiều màn nghiệp vụ sau này (phiếu ghi tăng, kế hoạch mua sắm, báo cáo) mặc
 * định lấy năm học hiện hành. Hai năm cùng hiện hành thì câu "năm học nào" có
 * hai câu trả lời, và cái nào thắng phụ thuộc thứ tự database trả dòng về.
 *
 * <p>Nên bất biến này được giữ ở HAI tầng: một unique index có điều kiện
 * ({@code WHERE is_current}) để database từ chối cứng, và service tự bỏ cờ của
 * năm cũ khi một năm mới được đánh dấu — để người dùng không phải tự bỏ trước
 * rồi mới đánh dấu được.
 */
@Entity
@Table(name = "school_years")
public class SchoolYear extends CatalogEntity {

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /** Tên cột là {@code is_current} như bản Jmix: {@code current} là từ khoá SQL. */
    @Column(name = "is_current", nullable = false)
    private Boolean current = Boolean.FALSE;

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public Boolean getCurrent() {
        return current;
    }

    public void setCurrent(Boolean current) {
        this.current = current == null ? Boolean.FALSE : current;
    }
}
