package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_norms")
public class EquipmentNormController extends CatalogController<
        EquipmentNorm, EquipmentNormRequest, EquipmentNormPatchRequest> {
    public EquipmentNormController(EquipmentNormService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }
    @Override protected String resource() { return "equipment_norms"; }
    @Override protected Object respond(EquipmentNorm item, RowLevelSecurity rowLevel) {
        return EquipmentNormResponse.from(item, rowLevel);
    }
}
