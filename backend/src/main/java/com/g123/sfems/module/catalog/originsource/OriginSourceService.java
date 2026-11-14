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
 * Nguồn hình thành — danh mục CỐ ĐỊNH: sáu dòng mang mã của {@link OriginRule}, đặt bởi changelog
 * {@code 109}. Đọc như mọi danh mục; thêm - sửa - xoá bị từ chối, vì luật nghiệp vụ rẽ nhánh theo
 * từng giá trị (nguồn kinh phí nào đi kèm, có hình thức mua sắm không) và một dòng tự thêm sẽ không
 * có luật nào. Feature khác cần phân giải một mục thì gọi {@code get(id)} hoặc {@link #of(OriginRule)}.
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

    /** Dòng danh mục của một nguồn hình thành cố định — cho phiếu ghi tăng sinh từ phiếu nghiệp vụ khác. */
    public OriginSource of(OriginRule rule) {
        return repository.findByCodeIgnoreCase(rule.name())
                .orElseThrow(() -> new IllegalStateException("Thiếu nguồn hình thành " + rule.name() + " trong danh mục"));
    }

    @Override
    public OriginSource create(CatalogRequest request) {
        throw fixed();
    }

    @Override
    public OriginSource update(Long id, CatalogPatchRequest request) {
        throw fixed();
    }

    @Override
    public OriginSource delete(Long id) {
        throw fixed();
    }

    private static FieldValidationException fixed() {
        return new FieldValidationException("code",
                "Nguồn hình thành là danh mục cố định (sáu nguồn), không thêm, sửa hay xoá được");
    }
}
