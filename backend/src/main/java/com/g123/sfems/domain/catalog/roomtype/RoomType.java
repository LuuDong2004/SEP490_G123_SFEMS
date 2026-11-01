package com.g123.sfems.domain.catalog.roomtype;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Loại phòng (DM-01): phòng học, phòng bộ môn, phòng thí nghiệm, kho… */
@Entity
@Table(name = "room_types")
public class RoomType extends CatalogEntity {

    /**
     * Phòng thuộc loại này là kho. Báo cáo 3: "Phòng có loại Kho được coi là kho" — thiết bị nhập
     * về phòng kho mang trạng thái Trong kho, nhập về phòng khác là Đang sử dụng.
     */
    @Column(nullable = false)
    private Boolean warehouse = Boolean.FALSE;

    public Boolean getWarehouse() {
        return warehouse;
    }

    public void setWarehouse(Boolean warehouse) {
        this.warehouse = warehouse == null ? Boolean.FALSE : warehouse;
    }
}
