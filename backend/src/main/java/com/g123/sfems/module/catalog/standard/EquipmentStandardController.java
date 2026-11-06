package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_standards")
public class EquipmentStandardController extends CatalogController<
        EquipmentStandard, EquipmentStandardRequest, EquipmentStandardPatchRequest> {
    private final EquipmentStandardService service;
    private final RowLevelSecurity rowLevel;

    public EquipmentStandardController(EquipmentStandardService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.service = service;
        this.rowLevel = rowLevel;
    }

    @Override protected String resource() { return "equipment_standards"; }
    @Override protected Object respond(EquipmentStandard item, RowLevelSecurity security) {
        return EquipmentStandardResponse.from(item, security);
    }

    @PostMapping("/{id}/apply")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object apply(@PathVariable Long id) {
        return respond(service.apply(id), rowLevel);
    }

    @PostMapping("/{id}/revise")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object revise(@PathVariable Long id) {
        return respond(service.revise(id), rowLevel);
    }
}
