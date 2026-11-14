package com.g123.sfems.module.school.facility;

import org.springframework.web.bind.annotation.PathVariable;
import java.util.List;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotEmpty;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.catalog.roomtype.RoomTypeResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/rooms} — phòng; mã quyền {@code rooms:*}, phạm vi dòng theo trường. */
@RestController
@RequestMapping("/api/rooms")
public class RoomController extends CatalogController<Room, RoomRequest, RoomPatchRequest> {

    private final RoomService rooms;
    private final RowLevelSecurity rowLevel;

    public RoomController(RoomService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.rooms = service;
        this.rowLevel = rowLevel;
    }

    /** Loại CSVC ngoài danh mục do trường thêm (QLTB-629). */
    public record CustomTypeRequest(
            Long schoolId,
            @NotBlank(message = "Tên là bắt buộc")
            @Text(value = FieldRule.NAME, label = "Tên")
            String name,
            Long groupId,
            String kind) {
    }

    @PostMapping("/custom-types")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('rooms:write')")
    public RoomTypeResponse createCustomType(@Valid @RequestBody CustomTypeRequest request) {
        return RoomTypeResponse.from(
                rooms.createCustomType(request.schoolId(), request.name(), request.groupId(), request.kind()), null);
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
