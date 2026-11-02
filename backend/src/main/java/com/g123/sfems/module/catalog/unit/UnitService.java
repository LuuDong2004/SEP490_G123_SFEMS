package com.g123.sfems.module.catalog.unit;

import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class UnitService extends CatalogService<Unit, CatalogRequest, CatalogPatchRequest> {

    public UnitService(UnitRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Unit.class, Unit::new, "Đơn vị tính");
    }

    /** Danh mục lựa chọn: hai mục cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }
}
