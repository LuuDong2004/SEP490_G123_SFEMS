package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_catalogs")
public class EquipmentCatalogController extends CatalogController<
        EquipmentCatalog, EquipmentCatalogRequest, EquipmentCatalogPatchRequest> {

    private final EquipmentCatalogService service;
    private final RowLevelSecurity rowLevel;

    public EquipmentCatalogController(EquipmentCatalogService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.service = service;
        this.rowLevel = rowLevel;
    }

    @Override protected String resource() { return "equipment_catalogs"; }

    @Override
    protected Object respond(EquipmentCatalog item, RowLevelSecurity rowLevel) {
        return EquipmentCatalogResponse.from(item, rowLevel);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public Object get(@PathVariable Long id) {
        return respond(service.getVisible(id), rowLevel);
    }
}
