package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/equipment_catalogs} — mã quyền {@code equipment_catalogs:*}. */
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

    /**
     * Trường thêm thiết bị NGOÀI danh mục của Sở lúc ghi tăng. Gác bằng quyền lập phiếu nhập (hoặc
     * sửa thiết bị), không bằng {@code equipment_catalogs:write} — danh mục của Sở vẫn chỉ Sở ghi;
     * cái được thêm ở đây chỉ thuộc trường của người gọi.
     */
    @PostMapping("/school-items")
    @PreAuthorize("hasAnyAuthority('equipment_intakes:write', 'equipment:write')")
    public Object createSchoolItem(@Valid @RequestBody SchoolItemRequest request) {
        Long schoolId = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        return respond(service.createForSchool(request, schoolId), rowLevel);
    }

    /** Kết quả kiểm tên: thiết bị trùng (hoặc {@code null}) và tối đa ba thiết bị gần giống. */
    public record NameCheckResponse(Object same, List<Object> similar) {
    }

    /**
     * Kiểm tên lúc đang gõ trong hộp "Thêm thiết bị ngoài danh mục" — cùng luật so theo từ với lúc lưu
     * ({@link EquipmentCatalogService#checkSchoolItemName}). {@code excludeId}: thiết bị đang sửa.
     */
    @GetMapping("/school-items/name-check")
    @PreAuthorize("hasAnyAuthority('equipment_intakes:write', 'equipment:write')")
    public NameCheckResponse checkSchoolItemName(@RequestParam String name,
            @RequestParam(required = false) Long excludeId) {
        Long schoolId = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        var found = service.checkSchoolItemName(name, schoolId, excludeId);
        return new NameCheckResponse(found.same() == null ? null : respond(found.same(), rowLevel),
                found.similar().stream().map(c -> respond(c, rowLevel)).toList());
    }

    /** Trường sửa thiết bị ngoài danh mục của chính mình — cùng quyền với lúc thêm. */
    @PatchMapping("/school-items/{id}")
    @PreAuthorize("hasAnyAuthority('equipment_intakes:write', 'equipment:write')")
    public Object updateSchoolItem(@PathVariable Long id, @Valid @RequestBody SchoolItemRequest request) {
        Long schoolId = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        return respond(service.updateForSchool(id, request, schoolId), rowLevel);
    }

    /** Như đọc chung, cộng phạm vi trường của thiết bị ngoài danh mục — xem {@link EquipmentCatalogService#getVisible}. */
    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public Object get(@PathVariable Long id) {
        return respond(service.getVisible(id), rowLevel);
    }

    @Override
    protected String resource() {
        return "equipment_catalogs";
    }

    @Override
    protected Object respond(EquipmentCatalog item, RowLevelSecurity rowLevel) {
        return EquipmentCatalogResponse.from(item, rowLevel);
    }
}
