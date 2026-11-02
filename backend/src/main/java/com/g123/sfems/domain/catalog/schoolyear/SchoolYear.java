package com.g123.sfems.domain.catalog.schoolyear;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/** Năm học (DM-01), ví dụ 2026-2027: khoảng ngày dùng để lọc báo cáo và áp dụng bộ tiêu chuẩn. */
@Entity
@Table(name = "school_years")
public class SchoolYear extends CatalogEntity {

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** Luôn sau ngày bắt đầu — cơ sở dữ liệu có ràng buộc CHECK giữ điều này. */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /** Năm học đang diễn ra. Chỉ một năm học mang cờ này (unique index một phần trong DB). */
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
