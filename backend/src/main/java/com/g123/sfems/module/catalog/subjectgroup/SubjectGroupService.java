package com.g123.sfems.module.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class SubjectGroupService extends CatalogService<SubjectGroup, CatalogRequest, CatalogPatchRequest> {

    public SubjectGroupService(SubjectGroupRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, SubjectGroup.class, SubjectGroup::new, "Tổ chuyên môn");
    }

    /** Danh mục lựa chọn: hai tổ cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }
}
