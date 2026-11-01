package com.g123.sfems.module.catalog.schoolyear;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.time.LocalDate;

/** Năm học trên đường truyền: các trường chung được trải phẳng, cộng khoảng ngày và cờ hiện hành. */
public record SchoolYearResponse(
        @JsonUnwrapped CatalogResponse base,
        LocalDate startDate,
        LocalDate endDate,
        Boolean current) {

    public static SchoolYearResponse from(SchoolYear item, RowLevelSecurity rowLevel) {
        return new SchoolYearResponse(
                CatalogResponse.from(item, rowLevel),
                item.getStartDate(),
                item.getEndDate(),
                item.getCurrent());
    }
}
