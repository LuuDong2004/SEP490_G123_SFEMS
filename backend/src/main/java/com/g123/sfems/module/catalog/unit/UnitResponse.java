package com.g123.sfems.module.catalog.unit;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Đơn vị tính trên đường truyền: các trường chung được trải phẳng, cộng cờ "cho phép số lẻ". */
public record UnitResponse(@JsonUnwrapped CatalogResponse base, Boolean allowsFraction) {

    public static UnitResponse from(Unit item, RowLevelSecurity rowLevel) {
        return new UnitResponse(CatalogResponse.from(item, rowLevel), item.getAllowsFraction());
    }
}
