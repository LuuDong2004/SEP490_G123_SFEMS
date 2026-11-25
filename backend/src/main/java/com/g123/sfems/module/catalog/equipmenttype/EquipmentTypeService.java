package com.g123.sfems.module.catalog.equipmenttype;

import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.stereotype.Service;

/**
 * Loại thiết bị. Toàn bộ logic ở {@link CatalogService}; feature khác cần phân
 * giải một mục thì gọi {@code get(id)} của lớp này.
 */
@Service
public class EquipmentTypeService extends CatalogService<EquipmentType, CatalogRequest, CatalogPatchRequest> {

    public EquipmentTypeService(EquipmentTypeRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, EquipmentType.class, EquipmentType::new, "Loại thiết bị");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
