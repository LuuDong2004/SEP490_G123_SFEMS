package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/equipment_standards} — mã quyền {@code equipment_standards:*}. */
@RestController
@RequestMapping("/api/equipment_standards")
public class EquipmentStandardController extends CatalogController<
        EquipmentStandard, EquipmentStandardRequest, EquipmentStandardPatchRequest> {

    public EquipmentStandardController(
            EquipmentStandardService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.standards = service;
        this.rowLevel = rowLevel;
    }

    private final EquipmentStandardService standards;
    private final RowLevelSecurity rowLevel;

    /**
     * Lập bộ mới theo văn bản mới — chép bộ này thành bản NHÁP (văn bản + mọi dòng thiết bị).
     * Thân yêu cầu tuỳ chọn: {@code {"standardVersion": "2026"}}.
     */
    @PostMapping("/{id}/revise")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object revise(@PathVariable Long id, @Valid @RequestBody(required = false) StandardReviseRequest body) {
        return respond(standards.revise(id, body == null ? null : body.standardVersion()), rowLevel);
    }

    /** Áp dụng bộ nháp: bộ đang áp dụng cùng cấp học chuyển hết hiệu lực. */
    @PostMapping("/{id}/apply")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object apply(@PathVariable Long id) {
        return respond(standards.apply(id), rowLevel);
    }

    @Override
    protected String resource() {
        return "equipment_standards";
    }

    @Override
    protected Object respond(EquipmentStandard item, RowLevelSecurity rowLevel) {
        return EquipmentStandardResponse.from(item, rowLevel);
    }
}
