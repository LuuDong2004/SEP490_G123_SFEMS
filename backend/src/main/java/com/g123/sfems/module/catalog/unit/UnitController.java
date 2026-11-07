package com.g123.sfems.module.catalog.unit;

import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/units")
public class UnitController extends CatalogController<Unit, UnitRequest, UnitPatchRequest> {

    public UnitController(UnitService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "units";
    }

    @Override
    protected Object respond(Unit item, RowLevelSecurity rowLevel) {
        return UnitResponse.from(item, rowLevel);
    }
}
