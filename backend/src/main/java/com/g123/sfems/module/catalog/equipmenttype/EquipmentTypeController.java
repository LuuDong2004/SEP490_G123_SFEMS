package com.g123.sfems.module.catalog.equipmenttype;

import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_types")
public class EquipmentTypeController extends CatalogController<EquipmentType, CatalogRequest, CatalogPatchRequest> {

    public EquipmentTypeController(EquipmentTypeService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "equipment_types";
    }
}
