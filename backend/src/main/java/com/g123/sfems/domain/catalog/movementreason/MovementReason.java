package com.g123.sfems.domain.catalog.movementreason;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Lý do biến động — "Mua sắm mới", "Được cấp phát, bàn giao"... Phiếu ghi tăng chọn lý do từ đây, nên loại lý do luôn là
 * {@link ReasonType#GHI_TANG}.
 */
@Entity
@Table(name = "movement_reasons")
public class MovementReason extends CatalogEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_type", nullable = false, length = 32)
    private ReasonType reasonType = ReasonType.GHI_TANG;

    public ReasonType getReasonType() {
        return reasonType;
    }

    public void setReasonType(ReasonType reasonType) {
        this.reasonType = reasonType;
    }
}
