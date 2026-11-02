package com.g123.sfems.module.catalog.roomtype;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Loại phòng trên đường truyền: các trường chung được trải phẳng, cộng cờ "là kho". */
public record RoomTypeResponse(@JsonUnwrapped CatalogResponse base, Boolean warehouse) {

    public static RoomTypeResponse from(RoomType item, RowLevelSecurity rowLevel) {
        return new RoomTypeResponse(CatalogResponse.from(item, rowLevel), item.getWarehouse());
    }
}
