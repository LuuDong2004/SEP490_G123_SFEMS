package com.g123.sfems.domain.catalog.movementreason;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Lý do biến động tài sản (DM-01): mua mới, được cấp, tài sản thừa khi kiểm kê… Mỗi dòng phiếu nhập
 * phải có một lý do TĂNG (DR-21).
 */
@Entity
@Table(name = "movement_reasons")
public class MovementReason extends CatalogEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MovementDirection direction = MovementDirection.INCREASE;

    public MovementDirection getDirection() {
        return direction;
    }

    public void setDirection(MovementDirection direction) {
        this.direction = direction;
    }
}
