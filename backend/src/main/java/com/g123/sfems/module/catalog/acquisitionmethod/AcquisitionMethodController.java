package com.g123.sfems.module.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/acquisition_methods")
public class AcquisitionMethodController extends CatalogController<AcquisitionMethod, CatalogRequest, CatalogPatchRequest> {

    public AcquisitionMethodController(AcquisitionMethodService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "acquisition_methods";
    }
}
