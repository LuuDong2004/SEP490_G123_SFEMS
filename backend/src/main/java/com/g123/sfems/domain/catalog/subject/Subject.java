package com.g123.sfems.domain.catalog.subject;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Môn học (DM-01): Toán, Vật lí, Hoá học… theo chương trình THPT 2018. */
@Entity
@Table(name = "subjects")
public class Subject extends CatalogEntity {

    /**
     * Mã môn ngắn — thành phần MH trong mã tài sản TT.TR.MH.LT.ST.NC (DR-08). Không trùng giữa các
     * môn (unique index không phân biệt hoa thường). Để trống thì thiết bị của môn này chưa cấp được
     * mã chuẩn (DR-09).
     */
    @Column(name = "short_code", length = 10)
    private String shortCode;

    public String getShortCode() {
        return shortCode;
    }

    public void setShortCode(String shortCode) {
        this.shortCode = shortCode;
    }
}
