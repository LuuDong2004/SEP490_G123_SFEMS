package com.g123.sfems.module.catalog.unit;

import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class UnitService extends CatalogService<Unit, UnitRequest, UnitPatchRequest> {

    public UnitService(UnitRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Unit.class, Unit::new, "Đơn vị tính");
    }

    /** Danh mục lựa chọn: hai mục cùng tên thì không phân biệt được trong ô chọn. */
    @Override
    protected boolean uniqueName() {
        return true;
    }

    @Override
    protected void applyCreate(Unit item, UnitRequest request) {
        item.setAllowsFraction(request.allowsFraction());
    }

    @Override
    protected void applyUpdate(Unit item, UnitPatchRequest request) {
        if (request.allowsFraction() != null) {
            item.setAllowsFraction(request.allowsFraction());
        }
    }

    /** Lọc {@code allowsFraction=true|false}: ô chọn đơn vị đếm (lọ, chai, hộp) chỉ lấy đơn vị không chia được. */
    @Override
    protected Specification<Unit> extraFilters(ListParams params) {
        Specification<Unit> spec = Specification.unrestricted();
        for (ListParams.Criterion criterion : params.filters()) {
            if (criterion.field().equals("allowsFraction")) {
                boolean allowsFraction = Boolean.parseBoolean(criterion.value().trim());
                spec = spec.and((root, query, cb) -> cb.equal(root.get("allowsFraction"), allowsFraction));
            }
        }
        return spec;
    }
}
