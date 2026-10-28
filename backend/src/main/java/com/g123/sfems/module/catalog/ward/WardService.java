package com.g123.sfems.module.catalog.ward;

import com.g123.sfems.domain.catalog.ward.Ward;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class WardService extends CatalogService<Ward, CatalogRequest, CatalogPatchRequest> {

    public WardService(WardRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Ward.class, Ward::new, "Phường/Xã");
    }
}
