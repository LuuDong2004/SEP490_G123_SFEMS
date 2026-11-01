package com.g123.sfems.module.catalog.roomtype;

import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class RoomTypeService extends CatalogService<RoomType, RoomTypeRequest, RoomTypePatchRequest> {

    public RoomTypeService(RoomTypeRepository repository, RowLevelSecurity rowLevel) {
        super(repository, rowLevel, RoomType.class, RoomType::new, "Loại phòng");
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }

    @Override
    protected void applyCreate(RoomType item, RoomTypeRequest request) {
        item.setWarehouse(request.warehouse());
    }

    @Override
    protected void applyUpdate(RoomType item, RoomTypePatchRequest request) {
        if (request.warehouse() != null) {
            item.setWarehouse(request.warehouse());
        }
    }

    /** Lọc {@code warehouse=true|false} — màn Phòng dùng để tìm các phòng kho. */
    @Override
    protected Specification<RoomType> extraFilters(ListParams params) {
        Specification<RoomType> spec = Specification.unrestricted();
        for (ListParams.Criterion criterion : params.filters()) {
            if (criterion.field().equals("warehouse")) {
                boolean warehouse = Boolean.parseBoolean(criterion.value().trim());
                spec = spec.and((root, query, cb) -> cb.equal(root.get("warehouse"), warehouse));
            }
        }
        return spec;
    }
}
