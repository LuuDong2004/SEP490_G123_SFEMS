package com.g123.sfems.module.catalog.semester;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.semester.Semester;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.time.LocalDate;

/** Học kỳ trên đường truyền: các trường chung được trải phẳng, cộng năm học rút gọn và khoảng ngày. */
public record SemesterResponse(
        @JsonUnwrapped CatalogResponse base,
        RefSummary schoolYear,
        LocalDate startDate,
        LocalDate endDate) {

    public static SemesterResponse from(Semester item, RowLevelSecurity rowLevel) {
        return new SemesterResponse(
                CatalogResponse.from(item, rowLevel),
                RefSummary.of(item.getSchoolYear()),
                item.getStartDate(),
                item.getEndDate());
    }
}
