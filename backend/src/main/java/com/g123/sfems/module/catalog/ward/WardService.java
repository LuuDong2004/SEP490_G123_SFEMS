package com.g123.sfems.module.catalog.ward;

import com.g123.sfems.domain.catalog.ward.Ward;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.stereotype.Service;

@Service
public class WardService extends CatalogService<Ward, CatalogRequest, CatalogPatchRequest> {

    @Override
    protected boolean codeLocked() {
        return true;
    }

    public WardService(WardRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Ward.class, Ward::new, "Phường/Xã");
    }

    /** Hai phường cùng tên thì ô chọn địa chỉ trường không phân biệt được (dữ liệu TP.HCM 2025 không trùng tên). */
    @Override
    protected boolean uniqueName() {
        return true;
    }

    /** Mã phường/xã theo danh mục hành chính quốc gia: 5 chữ số (vd. 26734). Tệp nhập đi lối riêng (WardImportService). */
    @Override
    protected void applyCreate(Ward item, CatalogRequest request) {
        if (item.getCode() != null && !item.getCode().isBlank() && !item.getCode().matches("^[0-9]{5}$")) {
            throw new FieldValidationException("code", "Mã phường/xã gồm 5 chữ số, vd. 26734");
        }
    }
}
