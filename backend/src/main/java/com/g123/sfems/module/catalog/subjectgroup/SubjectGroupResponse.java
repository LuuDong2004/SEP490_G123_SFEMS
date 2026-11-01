package com.g123.sfems.module.catalog.subjectgroup;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;

/** Tổ chuyên môn trên đường truyền: các trường chung được trải phẳng, cộng cấp học và số môn. */
public record SubjectGroupResponse(
        @JsonUnwrapped CatalogResponse base,
        RefSummary educationLevel,
        Long subjectCount) {

    public static SubjectGroupResponse from(SubjectGroup item, RowLevelSecurity rowLevel) {
        return new SubjectGroupResponse(
                CatalogResponse.from(item, rowLevel),
                RefSummary.of(item.getEducationLevel()),
                item.getSubjectCount() == null ? 0L : item.getSubjectCount());
    }
}
