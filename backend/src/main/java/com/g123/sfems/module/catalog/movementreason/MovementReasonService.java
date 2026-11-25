package com.g123.sfems.module.catalog.movementreason;

import com.g123.sfems.domain.catalog.movementreason.MovementReason;
import com.g123.sfems.domain.catalog.movementreason.ReasonType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Lý do biến động. Phần chung ở {@link CatalogService}; lớp này gán loại lý do
 * và lọc theo nó — bộ lọc phiếu ghi tăng dùng.
 */
@Service
public class MovementReasonService extends CatalogService<
        MovementReason, MovementReasonRequest, MovementReasonPatchRequest> {

    public MovementReasonService(MovementReasonRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, MovementReason.class, MovementReason::new, "Lý do biến động");
    }

    @Override
    protected void applyCreate(MovementReason item, MovementReasonRequest request) {
        item.setReasonType(request.reasonType() == null ? ReasonType.GHI_TANG : request.reasonType());
    }

    @Override
    protected void applyUpdate(MovementReason item, MovementReasonPatchRequest request) {
        if (request.reasonType() != null) {
            item.setReasonType(request.reasonType());
        }
    }

    /**
     * {@code reasonType=ghi_tang} (hoặc {@code reasonType_ne=...}). Giá trị lạ là
     * câu hỏi hợp lệ với câu trả lời rỗng, không phải request sai.
     */
    @Override
    protected Specification<MovementReason> extraFilters(ListParams params) {
        List<Specification<MovementReason>> specs = new ArrayList<>();
        for (ListParams.Criterion criterion : params.filters()) {
            if (!criterion.field().equals("reasonType")) {
                continue;
            }
            ReasonType type;
            try {
                type = ReasonType.from(criterion.value());
            } catch (IllegalArgumentException e) {
                specs.add((root, query, cb) -> cb.disjunction());
                continue;
            }
            if (type == null) {
                continue;
            }
            specs.add(criterion.operator() == ListParams.Operator.NE
                    ? (root, query, cb) -> cb.notEqual(root.get("reasonType"), type)
                    : (root, query, cb) -> cb.equal(root.get("reasonType"), type));
        }
        return Specification.allOf(specs);
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
