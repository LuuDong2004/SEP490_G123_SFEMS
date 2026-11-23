package com.g123.sfems.module.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/subject_groups} — mã quyền {@code subject_groups:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/subject_groups")
public class SubjectGroupController
        extends CatalogController<SubjectGroup, SubjectGroupRequest, SubjectGroupPatchRequest> {

    public SubjectGroupController(SubjectGroupService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "subject_groups";
    }

    @Override
    protected Object respond(SubjectGroup item, RowLevelSecurity rowLevel) {
        return SubjectGroupResponse.from(item, rowLevel);
    }
}
