package com.g123.sfems.domain.catalog.movementreason;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Lý do biến động tài sản — "Mua sắm mới", "Điều chuyển đi đơn vị khác",
 * "Thanh lý"... Các phiếu ghi tăng/ghi giảm thiết bị sau này chọn lý do từ đây.
 *
 * <p>Bắt buộc có loại: một phiếu ghi tăng chỉ được chọn lý do loại ghi tăng, và
 * một lý do không có loại thì không lọc vào đâu được.
 */
@Entity
@Table(name = "movement_reasons")
public class MovementReason extends CatalogEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_type", nullable = false, length = 32)
    private ReasonType reasonType;

    public ReasonType getReasonType() {
        return reasonType;
    }

    public void setReasonType(ReasonType reasonType) {
        this.reasonType = reasonType;
    }
}
