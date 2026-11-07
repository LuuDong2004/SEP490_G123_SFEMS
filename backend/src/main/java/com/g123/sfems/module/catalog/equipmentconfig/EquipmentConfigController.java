package com.g123.sfems.module.catalog.equipmentconfig;

import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfig;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_configs")
public class EquipmentConfigController extends CatalogController<EquipmentConfig, EquipmentConfigRequest, EquipmentConfigPatchRequest> {

    public EquipmentConfigController(EquipmentConfigService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "equipment_configs";
    }

    @Override
    protected Object respond(EquipmentConfig item, RowLevelSecurity rowLevel) {
        return EquipmentConfigResponse.from(item, rowLevel);
    }
}
