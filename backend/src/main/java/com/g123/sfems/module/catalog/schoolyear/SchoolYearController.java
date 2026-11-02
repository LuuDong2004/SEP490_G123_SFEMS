package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/school_years")
public class SchoolYearController extends CatalogController<SchoolYear, SchoolYearRequest, SchoolYearPatchRequest> {

    public SchoolYearController(SchoolYearService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "school_years";
    }

    @Override
    protected Object respond(SchoolYear item, RowLevelSecurity rowLevel) {
        return SchoolYearResponse.from(item, rowLevel);
    }
}
