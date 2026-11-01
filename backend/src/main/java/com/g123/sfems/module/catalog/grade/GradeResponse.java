package com.g123.sfems.module.catalog.grade;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Khối lớp trên đường truyền: các trường chung được trải phẳng, cộng cấp học rút gọn và số khối. */
public record GradeResponse(@JsonUnwrapped CatalogResponse base, RefSummary educationLevel, Integer gradeNumber) {

    public static GradeResponse from(Grade item, RowLevelSecurity rowLevel) {
        return new GradeResponse(
                CatalogResponse.from(item, rowLevel),
                RefSummary.of(item.getEducationLevel()),
                item.getGradeNumber());
    }
}
