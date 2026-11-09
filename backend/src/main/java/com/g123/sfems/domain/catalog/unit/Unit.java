package com.g123.sfems.domain.catalog.unit;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Đơn vị tính (DM-01): cái, bộ, chiếc, hộp, kg, lít… */
@Entity
@Table(name = "units")
public class Unit extends CatalogEntity {

    /**
     * Cho phép số lẻ: kg, g, lít, ml, mét chia được (0,25 kg hoá chất), còn cái, bộ, chai thì chỉ đếm
     * số nguyên (không có 0,5 cái máy tính).
     */
    @Column(name = "allows_fraction", nullable = false)
    private Boolean allowsFraction = Boolean.FALSE;

    public Boolean getAllowsFraction() {
        return allowsFraction;
    }

    public void setAllowsFraction(Boolean allowsFraction) {
        this.allowsFraction = allowsFraction == null ? Boolean.FALSE : allowsFraction;
    }
}
