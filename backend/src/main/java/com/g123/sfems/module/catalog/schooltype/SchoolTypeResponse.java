package com.g123.sfems.module.catalog.schooltype;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.schooltype.SchoolType;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Loại hình trường trên đường truyền: các trường chung được trải phẳng, cộng tên viết tắt. */
public record SchoolTypeResponse(@JsonUnwrapped CatalogResponse base, String shortName) {

    public static SchoolTypeResponse from(SchoolType item, RowLevelSecurity rowLevel) {
        return new SchoolTypeResponse(CatalogResponse.from(item, rowLevel), item.getShortName());
    }
}
