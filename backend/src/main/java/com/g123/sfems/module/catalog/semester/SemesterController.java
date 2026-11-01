package com.g123.sfems.module.catalog.semester;

import com.g123.sfems.domain.catalog.semester.Semester;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/semesters")
public class SemesterController extends CatalogController<Semester, CatalogRequest, CatalogPatchRequest> {

    public SemesterController(SemesterService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "semesters";
    }
}
