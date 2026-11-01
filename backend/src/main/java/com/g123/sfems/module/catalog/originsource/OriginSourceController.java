package com.g123.sfems.module.catalog.originsource;

import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/origin_sources")
public class OriginSourceController extends CatalogController<OriginSource, CatalogRequest, CatalogPatchRequest> {

    public OriginSourceController(OriginSourceService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "origin_sources";
    }
}
