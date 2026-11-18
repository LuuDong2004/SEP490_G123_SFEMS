package com.g123.sfems.domain.catalog.facilitygroup;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Khối CSVC theo danh mục của Sở (CSDL HCM): khối phụ trợ, khối phòng học tập, khu sân chơi – TDTT… Mỗi loại CSVC
 * ({@code room_types}) thuộc một khối. Danh mục dùng chung, toàn cục.
 */
@Entity
@Table(name = "facility_groups")
public class FacilityGroup extends CatalogEntity {

    /** Cấp áp dụng — mã cấp học cách nhau dấu phẩy; trống là mọi cấp. Xem {@link FacilityLevels}. */
    @Column(name = "levels", length = 40)
    private String levels;

    public String getLevels() {
        return levels;
    }

    public void setLevels(String levels) {
        this.levels = levels;
    }
}
