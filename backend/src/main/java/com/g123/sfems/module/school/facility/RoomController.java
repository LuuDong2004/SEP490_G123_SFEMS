package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/rooms} — phòng (TC-02); mã quyền {@code rooms:*}, phạm vi dòng theo trường đã seed ở changelog
 * 010 và 013. Năm endpoint chung (danh sách, xem, thêm, sửa, xoá) lấy từ {@link CatalogController}.
 *
 * <p>Các màn khác đọc đường này: ô chọn phòng trên phiếu ghi tăng và phiếu kiểm kê, ô "Phòng" của hồ sơ tài
 * sản, và danh sách phòng trong khối chứng từ dùng chung.
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomController extends CatalogController<Room, RoomRequest, RoomPatchRequest> {

    public RoomController(RoomService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "rooms";
    }

    @Override
    protected Object respond(Room item, RowLevelSecurity rowLevel) {
        return RoomResponse.from(item, rowLevel);
    }
}
