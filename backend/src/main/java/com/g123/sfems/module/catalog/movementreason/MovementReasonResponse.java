package com.g123.sfems.module.catalog.movementreason;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.movementreason.MovementDirection;
import com.g123.sfems.domain.catalog.movementreason.MovementReason;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Lý do biến động trên đường truyền: các trường chung được trải phẳng, cộng chiều tăng/giảm. */
public record MovementReasonResponse(@JsonUnwrapped CatalogResponse base, MovementDirection direction) {

    public static MovementReasonResponse from(MovementReason item, RowLevelSecurity rowLevel) {
        return new MovementReasonResponse(CatalogResponse.from(item, rowLevel), item.getDirection());
    }
}
