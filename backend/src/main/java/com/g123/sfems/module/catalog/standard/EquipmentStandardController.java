package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
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
     * Lập bộ mới cho các thông tư Sở chọn (TT 37 / 38 / 39 — một, hai hay cả ba) theo cùng một văn bản: mỗi bộ một
     * bản nháp, tất cả hoặc không gì. Trả các bản nháp vừa lập.
     */
    @PostMapping("/revise")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public List<Object> reviseMany(@Valid @RequestBody StandardReviseRequest body) {
        return standards.reviseMany(body.standardIds(), body).stream().map(s -> respond(s, rowLevel)).toList();
    }

    /**
     * Lập bộ mới — chép bộ đang áp dụng thành bản NHÁP (văn bản + mọi dòng thiết bị), kèm CĂN CỨ của lần sửa: sửa đổi,
     * bổ sung theo văn bản nào, hay đính chính vì sao ({@link StandardReviseRequest}).
     */
    @PostMapping("/{id}/revise")
    @PreAuthorize("hasAuthority('equipment_standards:write')")
    public Object revise(@PathVariable Long id, @Valid @RequestBody StandardReviseRequest body) {
        return respond(standards.revise(id, body), rowLevel);
    }

    /**
     * Dòng phụ lục khác bộ trước: thêm / đổi / bỏ. Bộ đã áp dụng đọc danh sách ghi lúc áp dụng; bộ nháp tính ngay (xem
     * trước khi áp dụng).
     */
    @GetMapping("/{id}/changes")
    @PreAuthorize("hasAuthority('equipment_standards:read')")
    public List<StandardChange> changes(@PathVariable Long id) {
        return standards.changes(id);
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
