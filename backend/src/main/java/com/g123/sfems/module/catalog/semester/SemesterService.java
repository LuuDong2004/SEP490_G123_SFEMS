package com.g123.sfems.module.catalog.semester;

import com.g123.sfems.domain.catalog.semester.Semester;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

/**
 * Học kỳ. Toàn bộ logic ở {@link CatalogService}; feature khác cần phân
 * giải một mục thì gọi {@code get(id)} của lớp này.
 */
@Service
public class SemesterService extends CatalogService<Semester, CatalogRequest, CatalogPatchRequest> {

    public SemesterService(SemesterRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Semester.class, Semester::new, "Học kỳ");
    }
}
