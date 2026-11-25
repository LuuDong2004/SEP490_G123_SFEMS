package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/campuses} — cơ sở; mã quyền {@code campuses:*}, phạm vi dòng theo trường. */
@RestController
@RequestMapping("/api/campuses")
public class CampusController extends CatalogController<Campus, CampusRequest, CampusPatchRequest> {

    public CampusController(CampusService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "campuses";
    }

    @Override
    protected Object respond(Campus item, RowLevelSecurity rowLevel) {
        return CampusResponse.from(item, rowLevel);
    }
}
