package com.g123.sfems.module.catalog.originsource;

import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.dto.CatalogPatchRequest;
import com.g123.sfems.module.catalog.base.dto.CatalogRequest;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.stereotype.Service;

/**
 * Nguồn hình thành: danh mục cố định sáu dòng. Đọc như mọi danh mục; thêm, sửa, xoá bị từ chối vì
 * mỗi dòng gắn với một luật trong {@link OriginRule}, dòng tự thêm sẽ không có luật nào.
 */
@Service
public class OriginSourceService extends CatalogService<OriginSource, CatalogRequest, CatalogPatchRequest> {

    private final OriginSourceRepository repository;

    public OriginSourceService(OriginSourceRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, OriginSource.class, OriginSource::new, "Nguồn hình thành");
        this.repository = repository;
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    /** Dòng danh mục của một nguồn cố định, cho nghiệp vụ tự gán nguồn (ví dụ tài sản thừa khi kiểm kê). */
    public OriginSource of(OriginRule rule) {
        return repository.findByCodeIgnoreCase(rule.name())
                .orElseThrow(() -> new IllegalStateException("Thiếu nguồn hình thành " + rule.name() + " trong danh mục"));
    }

    @Override
    public OriginSource create(CatalogRequest request) {
        throw fixedCatalog();
    }

    @Override
    public OriginSource update(Long id, CatalogPatchRequest request) {
        throw fixedCatalog();
    }

    @Override
    public OriginSource delete(Long id) {
        throw fixedCatalog();
    }

    private static FieldValidationException fixedCatalog() {
        return new FieldValidationException("code",
                "Nguồn hình thành là danh mục cố định (sáu nguồn), không thêm, sửa hay xoá được");
    }
}
