package com.g123.sfems.module.catalog.movementreason;

import com.g123.sfems.domain.catalog.movementreason.MovementDirection;
import com.g123.sfems.domain.catalog.movementreason.MovementReason;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class MovementReasonService
        extends CatalogService<MovementReason, MovementReasonRequest, MovementReasonPatchRequest> {

    public MovementReasonService(MovementReasonRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, MovementReason.class, MovementReason::new, "Lý do biến động");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    @Override
    protected void applyCreate(MovementReason item, MovementReasonRequest request) {
        item.setDirection(request.direction());
    }

    @Override
    protected void applyUpdate(MovementReason item, MovementReasonPatchRequest request) {
        if (request.direction() != null) {
            item.setDirection(request.direction());
        }
    }

    /**
     * Lọc {@code direction=increase|decrease}. Phiếu nhập chỉ cho chọn lý do TĂNG (DR-21), nên ô chọn
     * lý do ở phiếu nhập gọi danh sách kèm bộ lọc này.
     */
    @Override
    protected Specification<MovementReason> extraFilters(ListParams params) {
        Specification<MovementReason> spec = Specification.unrestricted();
        for (ListParams.Criterion criterion : params.filters()) {
            if (criterion.field().equals("direction")) {
                MovementDirection direction = MovementDirection.parse(criterion.value());
                spec = spec.and((root, query, cb) -> direction == null
                        ? cb.disjunction()
                        : cb.equal(root.get("direction"), direction));
            }
        }
        return spec;
    }
}
