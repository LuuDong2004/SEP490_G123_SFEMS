package com.g123.sfems.module.catalog.facilitygroup;

import com.g123.sfems.domain.catalog.facilitygroup.FacilityGroup;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/facility_groups} — mã quyền {@code facility_groups:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/facility_groups")
public class FacilityGroupController
        extends CatalogController<FacilityGroup, FacilityGroupRequest, FacilityGroupPatchRequest> {

    public FacilityGroupController(FacilityGroupService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "facility_groups";
    }

    @Override
    protected Object respond(FacilityGroup item, RowLevelSecurity rowLevel) {
        return FacilityGroupResponse.from(item, rowLevel);
    }
}
