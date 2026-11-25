package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/facility_standard_rules} — mã quyền {@code facility_standard_rules:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/facility_standard_rules")
public class FacilityStandardRuleController extends CatalogController<
        FacilityStandardRule, FacilityStandardRuleRequest, FacilityStandardRulePatchRequest> {

    private final FacilityStandardRuleService rules;
    private final RowLevelSecurity security;

    public FacilityStandardRuleController(FacilityStandardRuleService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.rules = service;
        this.security = rowLevel;
    }

    /** Lưu chuẩn của một loại CSVC, đủ ba mức một lần (291). */
    @PutMapping("/types/{roomTypeId}")
    @PreAuthorize("hasAuthority('facility_standard_rules:write')")
    public List<Object> saveType(@PathVariable Long roomTypeId, @Valid @RequestBody FacilityStandardTypeRequest request) {
        return rules.saveType(roomTypeId, request, CurrentUser.has("facility_standard_rules:delete")).stream()
                .map(r -> respond(r, security)).toList();
    }

    @Override
    protected String resource() {
        return "facility_standard_rules";
    }

    @Override
    protected Object respond(FacilityStandardRule item, RowLevelSecurity rowLevel) {
        return FacilityStandardRuleResponse.from(item, rowLevel);
    }
}
