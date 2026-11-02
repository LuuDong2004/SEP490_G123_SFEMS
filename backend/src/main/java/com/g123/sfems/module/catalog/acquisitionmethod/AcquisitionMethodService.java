package com.g123.sfems.module.catalog.acquisitionmethod;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class AcquisitionMethodService extends CatalogService<AcquisitionMethod, CatalogRequest, CatalogPatchRequest> {

    public AcquisitionMethodService(AcquisitionMethodRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, AcquisitionMethod.class, AcquisitionMethod::new, "Phương thức hình thành");
    }

    /** Danh mục lựa chọn: hai mục cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }
}
