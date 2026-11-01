package com.g123.sfems.module.catalog.semester;

import com.g123.sfems.domain.catalog.semester.Semester;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class SemesterService extends CatalogService<Semester, CatalogRequest, CatalogPatchRequest> {

    public SemesterService(SemesterRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Semester.class, Semester::new, "Học kỳ");
    }

    /** Danh mục lựa chọn: hai học kỳ cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }
}
