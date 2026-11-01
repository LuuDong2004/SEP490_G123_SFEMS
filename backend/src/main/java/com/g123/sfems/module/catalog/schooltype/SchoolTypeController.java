package com.g123.sfems.module.catalog.schooltype;

import com.g123.sfems.domain.catalog.schooltype.SchoolType;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/school_types")
public class SchoolTypeController extends CatalogController<SchoolType, SchoolTypeRequest, SchoolTypePatchRequest> {

    public SchoolTypeController(SchoolTypeService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "school_types";
    }

    @Override
    protected Object respond(SchoolType item, RowLevelSecurity rowLevel) {
        return SchoolTypeResponse.from(item, rowLevel);
    }
}
