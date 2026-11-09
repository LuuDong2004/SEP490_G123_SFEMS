package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/equipment_catalogs")
public class EquipmentCatalogController extends CatalogController<
        EquipmentCatalog, EquipmentCatalogRequest, EquipmentCatalogPatchRequest> {

    private final EquipmentCatalogService service;
    private final RowLevelSecurity rowLevel;
    private final RowLevelPrincipalResolver principals;

    public EquipmentCatalogController(EquipmentCatalogService service, RowLevelSecurity rowLevel,
            RowLevelPrincipalResolver principals) {
        super(service, rowLevel);
        this.service = service;
        this.rowLevel = rowLevel;
        this.principals = principals;
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

    /**
     * Trường thêm thiết bị NGOÀI danh mục của Sở lúc ghi tăng. Gác bằng quyền lập phiếu nhập (hoặc sửa
     * thiết bị), không bằng {@code equipment_catalogs:write} — danh mục của Sở vẫn chỉ Sở ghi; cái được
     * thêm ở đây chỉ thuộc trường của người gọi.
     */
    @PostMapping("/school-items")
    @PreAuthorize("hasAnyAuthority('equipment_intakes:write', 'equipment:write')")
    public Object createSchoolItem(@Valid @RequestBody SchoolItemRequest request) {
        return respond(service.createForSchool(request, callerSchoolId()), rowLevel);
    }

    /** Trường sửa thiết bị ngoài danh mục của chính mình — cùng quyền với lúc thêm. */
    @PatchMapping("/school-items/{id}")
    @PreAuthorize("hasAnyAuthority('equipment_intakes:write', 'equipment:write')")
    public Object updateSchoolItem(@PathVariable Long id, @Valid @RequestBody SchoolItemRequest request) {
        return respond(service.updateForSchool(id, request, callerSchoolId()), rowLevel);
    }

    private Long callerSchoolId() {
        return principals.current().map(principal -> principal.schoolId()).orElse(null);
    }
}
