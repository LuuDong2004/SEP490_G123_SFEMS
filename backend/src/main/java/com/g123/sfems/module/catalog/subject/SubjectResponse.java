package com.g123.sfems.module.catalog.subject;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Môn học trên đường truyền: các trường chung được trải phẳng, cộng mã môn ngắn. */
public record SubjectResponse(@JsonUnwrapped CatalogResponse base, String shortCode) {

    public static SubjectResponse from(Subject item, RowLevelSecurity rowLevel) {
        return new SubjectResponse(CatalogResponse.from(item, rowLevel), item.getShortCode());
    }
}
