package com.g123.sfems.module.catalog.equipmenttype;

import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

@Service
public class EquipmentTypeService extends CatalogService<EquipmentType, CatalogRequest, CatalogPatchRequest> {

    public EquipmentTypeService(EquipmentTypeRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, EquipmentType.class, EquipmentType::new, "Loại thiết bị");
    }

    /** Danh mục lựa chọn: hai mục cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }
}
