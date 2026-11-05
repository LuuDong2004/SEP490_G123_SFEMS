package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Hồ sơ thiết bị: năm endpoint chung của {@link CatalogController} (mã quyền {@code equipment:*}) cộng
 * lịch sử của một tài sản.
 */
@RestController
@RequestMapping("/api/equipment")
public class EquipmentController extends CatalogController<Equipment, EquipmentRequest, EquipmentPatchRequest> {

    private final EquipmentService equipment;

    public EquipmentController(EquipmentService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.equipment = service;
    }

    @Override
    protected String resource() {
        return "equipment";
    }

    @Override
    protected Object respond(Equipment item, RowLevelSecurity rowLevel) {
        return EquipmentResponse.from(item, rowLevel);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public List<EquipmentHistoryResponse> history(@PathVariable Long id) {
        return equipment.history(id).stream().map(EquipmentHistoryResponse::from).toList();
    }
}
