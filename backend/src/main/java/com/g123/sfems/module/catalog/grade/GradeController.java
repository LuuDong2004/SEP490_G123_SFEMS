package com.g123.sfems.module.catalog.grade;

import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/grades")
public class GradeController extends CatalogController<Grade, GradeRequest, GradePatchRequest> {

    public GradeController(GradeService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "grades";
    }

    @Override
    protected Object respond(Grade item, RowLevelSecurity rowLevel) {
        return GradeResponse.from(item, rowLevel);
    }
}
