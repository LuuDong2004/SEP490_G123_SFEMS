package com.g123.sfems.module.catalog.movementreason;

import com.g123.sfems.domain.catalog.movementreason.MovementReason;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/movement_reasons} — mã quyền {@code movement_reasons:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/movement_reasons")
public class MovementReasonController extends CatalogController<
        MovementReason, MovementReasonRequest, MovementReasonPatchRequest> {

    public MovementReasonController(MovementReasonService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "movement_reasons";
    }

    @Override
    protected Object respond(MovementReason item, RowLevelSecurity rowLevel) {
        return MovementReasonResponse.from(item, rowLevel);
    }
}
