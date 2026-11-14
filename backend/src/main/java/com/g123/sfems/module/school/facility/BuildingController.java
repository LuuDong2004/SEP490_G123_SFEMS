package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Building;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/buildings} — khối nhà; mã quyền {@code buildings:*}, phạm vi dòng theo trường. */
@RestController
@RequestMapping("/api/buildings")
public class BuildingController extends CatalogController<Building, BuildingRequest, BuildingPatchRequest> {

    public BuildingController(BuildingService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "buildings";
    }

    @Override
    protected Object respond(Building item, RowLevelSecurity rowLevel) {
        return BuildingResponse.from(item, rowLevel);
    }
}
