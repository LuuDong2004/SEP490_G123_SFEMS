package com.g123.sfems.module.catalog.roomtype;

import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/room_types} — mã quyền {@code room_types:*} suy ra từ {@link #resource()}. */
@RestController
@RequestMapping("/api/room_types")
public class RoomTypeController extends CatalogController<RoomType, RoomTypeRequest, RoomTypePatchRequest> {

    public RoomTypeController(RoomTypeService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "room_types";
    }

    @Override
    protected Object respond(RoomType item, RowLevelSecurity rowLevel) {
        return RoomTypeResponse.from(item, rowLevel);
    }
}
