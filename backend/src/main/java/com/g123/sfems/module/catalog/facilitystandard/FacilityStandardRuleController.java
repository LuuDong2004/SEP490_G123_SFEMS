package com.g123.sfems.module.catalog.facilitystandard;

import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/facility_standard_rules} — mã quyền {@code facility_standard_rules:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/facility_standard_rules")
public class FacilityStandardRuleController extends CatalogController<
        FacilityStandardRule, FacilityStandardRuleRequest, FacilityStandardRulePatchRequest> {

    public FacilityStandardRuleController(FacilityStandardRuleService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
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
