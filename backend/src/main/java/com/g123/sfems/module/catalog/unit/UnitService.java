package com.g123.sfems.module.catalog.unit;

import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Đơn vị tính. Phần chung ở {@link CatalogService}; lớp này gán cờ cho phép số lẻ. Feature
 * khác cần phân giải một mục thì gọi {@code get(id)} của lớp này.
 */
@Service
public class UnitService extends CatalogService<Unit, UnitRequest, UnitPatchRequest> {

    public UnitService(UnitRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, Unit.class, Unit::new, "Đơn vị tính");
    }

    @Override
    protected void applyCreate(Unit item, UnitRequest request) {
        item.setAllowsFraction(Boolean.TRUE.equals(request.allowsFraction()));
    }

    @Override
    protected void applyUpdate(Unit item, UnitPatchRequest request) {
        if (request.allowsFraction() != null) {
            item.setAllowsFraction(request.allowsFraction());
        }
    }

    /**
     * {@code allowsFraction=false} — chỉ đơn vị đếm nguyên (Lọ, Chai, Hộp…): ô "đơn vị bao bì" của quy cách hoá
     * chất (QLTB-501) chỉ đưa ra những đơn vị này, không đưa Lít, Gam vốn là đơn vị đo.
     */
    @Override
    protected Specification<Unit> extraFilters(ListParams params) {
        return params.filters().stream()
                .filter(c -> c.field().equals("allowsFraction") && c.operator() == ListParams.Operator.EQ)
                .findFirst()
                .<Specification<Unit>>map(c -> (root, q, cb) -> cb.equal(root.get("allowsFraction"), Boolean.parseBoolean(c.value())))
                .orElse(Specification.unrestricted());
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
