package com.g123.sfems.module.catalog.equipmenttype;

import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.stereotype.Service;

/**
 * Loại thiết bị. Toàn bộ logic ở {@link CatalogService}; feature khác cần phân
 * giải một mục thì gọi {@code get(id)} của lớp này.
 */
@Service
public class EquipmentTypeService extends CatalogService<EquipmentType, CatalogRequest, CatalogPatchRequest> {

    @Override
    protected boolean codeLocked() {
        return true;
    }

    public EquipmentTypeService(EquipmentTypeRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, EquipmentType.class, EquipmentType::new, "Loại thiết bị");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    /**
     * Mã loại là đoạn LTB trong mã tài sản (vd. "HC" của hoá chất) — đúng 2 chữ cái in hoa. Kiểm ở móc tạo vì mã có
     * thể do quy tắc sinh mã cấp; mã khoá sau khi tạo nên sửa không cần kiểm lại.
     */
    @Override
    protected void applyCreate(EquipmentType item, CatalogRequest request) {
        if (item.getCode() != null && !item.getCode().isBlank() && !item.getCode().matches("^[A-Z]{2}$")) {
            throw new FieldValidationException("code", "Mã loại thiết bị gồm 2 chữ cái in hoa, vd. HC");
        }
    }
}
