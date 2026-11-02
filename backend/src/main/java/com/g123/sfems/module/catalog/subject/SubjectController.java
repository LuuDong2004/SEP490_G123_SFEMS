package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController extends CatalogController<Subject, SubjectRequest, SubjectPatchRequest> {

    public SubjectController(SubjectService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "subjects";
    }

    @Override
    protected Object respond(Subject item, RowLevelSecurity rowLevel) {
        return SubjectResponse.from(item, rowLevel);
    }
}
