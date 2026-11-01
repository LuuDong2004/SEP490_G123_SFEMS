package com.g123.sfems.domain.catalog.schooltype;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Loại hình trường (DM-01): công lập, dân lập, tư thục. */
@Entity
@Table(name = "school_types")
public class SchoolType extends CatalogEntity {

    /** Tên viết tắt dùng ở chỗ hẹp như cột bảng: CL, DL, TT. */
    @Column(name = "short_name", length = 64)
    private String shortName;

    public String getShortName() {
        return shortName;
    }

    public void setShortName(String shortName) {
        this.shortName = shortName;
    }
}
