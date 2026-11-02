package com.g123.sfems.module.catalog.originsource;

import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class OriginSourceService extends CatalogService<OriginSource, CatalogRequest, CatalogPatchRequest> {

    public OriginSourceService(OriginSourceRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, OriginSource.class, OriginSource::new, "Nguồn hình thành");
    }

    /** Danh mục lựa chọn: hai mục cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }
}
