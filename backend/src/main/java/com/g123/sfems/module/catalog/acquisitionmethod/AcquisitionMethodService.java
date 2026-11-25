package com.g123.sfems.module.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

/**
 * Hình thức mua sắm. Toàn bộ logic ở {@link CatalogService}; feature khác cần phân
 * giải một mục thì gọi {@code get(id)} của lớp này.
 */
@Service
public class AcquisitionMethodService extends CatalogService<AcquisitionMethod, CatalogRequest, CatalogPatchRequest> {

    public AcquisitionMethodService(AcquisitionMethodRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, AcquisitionMethod.class, AcquisitionMethod::new, "Hình thức mua sắm");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
