package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.roomtype.RoomTypeService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Phòng (TC-02). Quy tắc riêng:
 *
 * <ul>
 *   <li>cờ hoạt động SUY từ tình trạng sử dụng: ngừng sử dụng thì không còn hiện trong các ô chọn;</li>
 *   <li>mã để trống thì cấp theo quy tắc mã của trường ({@link RoomCodeService});</li>
 *   <li>không xoá phòng còn thiết bị hay còn dòng phiếu ghi tăng.</li>
 * </ul>
 *
 * <p>Khối nhà và tầng là hai ô chữ chứ không phải bảng, nên không có luật "cơ sở lấy theo khối nhà" như ở
 * bản gốc — xem javadoc của {@link Room}.
 */
@Service
public class RoomService extends SchoolOwnedService<Room, RoomRequest, RoomPatchRequest> {

    private final RoomTypeService roomTypes;
    private final SubjectService subjects;
    private final RoomCodeService codes;

    public RoomService(
            RoomRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            RoomTypeService roomTypes,
            SubjectService subjects,
            RoomCodeService codes) {
        super(repository, rowLevel, Room.class, Room::new, "Phòng", schools, principals);
        this.roomTypes = roomTypes;
        this.subjects = subjects;
        this.codes = codes;
    }

    @Override
    protected void applyCreateOwned(Room item, RoomRequest request) {
        item.setRoomType(present(request.roomType()) ? roomTypes.get(request.roomType().id()) : null);
        item.setSubject(present(request.subject()) ? subjects.get(request.subject().id()) : null);
        item.setBuilding(blankToNull(request.building()));
        item.setFloor(blankToNull(request.floor()));
        item.setLocation(blankToNull(request.location()));
        item.setArea(request.area());
        item.setCapacity(request.capacity());
        item.setCondition(request.condition());
        item.setUsageStatus(request.usageStatus());
        item.setManagingUnit(blankToNull(request.managingUnit()));
        reconcile(item);
    }

    @Override
    protected void applyUpdateOwned(Room item, RoomPatchRequest request) {
        if (request.roomType() != null) {
            item.setRoomType(present(request.roomType()) ? roomTypes.get(request.roomType().id()) : null);
        }
        if (request.subject() != null) {
            item.setSubject(present(request.subject()) ? subjects.get(request.subject().id()) : null);
        }
        if (request.building() != null) {
            item.setBuilding(blankToNull(request.building()));
        }
        if (request.floor() != null) {
            item.setFloor(blankToNull(request.floor()));
        }
        if (request.location() != null) {
            item.setLocation(blankToNull(request.location()));
        }
        if (request.area() != null) {
            item.setArea(request.area());
        }
        if (request.capacity() != null) {
            item.setCapacity(request.capacity());
        }
        if (request.condition() != null) {
            item.setCondition(request.condition());
        }
        if (request.usageStatus() != null) {
            item.setUsageStatus(request.usageStatus());
        }
        if (request.managingUnit() != null) {
            item.setManagingUnit(blankToNull(request.managingUnit()));
        }
        reconcile(item);
    }

    /**
     * Mã để trống thì máy cấp theo quy tắc mã của trường. Phòng gõ mã tay vẫn được, và vẫn qua kiểm trùng —
     * {@link RoomCodeService#resolveOnCreate} báo trùng kèm mã kế tiếp còn trống.
     */
    @Override
    protected String resolveCode(Room item, String code) {
        if (code != null && !code.isBlank()) {
            return code;
        }
        if (item.getSchool() == null) {
            return code;
        }
        return codes.resolveOnCreate(item, code);
    }

    /** Lọc thêm: {@code roomType.id}, {@code subject.id}. */
    @Override
    protected Specification<Room> ownedFilters(ListParams params) {
        return Specification.allOf(List.of(
                CatalogSpecifications.<Room>referenceFilter(params, "roomType"),
                CatalogSpecifications.<Room>referenceFilter(params, "subject")));
    }

    /**
     * Không xoá phòng còn thiết bị trên sổ hay còn dòng phiếu ghi tăng (khoá ngoại {@code RESTRICT} của
     * changelog 013 sẽ chặn, nhưng nói thẳng còn hơn để người dùng đọc một lỗi ràng buộc). Dòng kiểm kê
     * trỏ {@code SET NULL} nên giữ được làm lịch sử, không chặn.
     */
    @Override
    protected void beforeDelete(Room item) {
        long equipment = count(
                "SELECT count(*) FROM equipment WHERE room_id = :id AND status NOT IN (:off)",
                item.getId(),
                EquipmentService.OFF_BOOK.stream().map(Enum::name).toList());
        long intakes = count(
                "SELECT count(*) FROM equipment_intake_lines WHERE room_id = :id", item.getId(), null);
        List<String> parts = new ArrayList<>();
        if (equipment > 0) {
            parts.add(equipment + " thiết bị");
        }
        if (intakes > 0) {
            parts.add(intakes + " dòng phiếu ghi tăng");
        }
        if (!parts.isEmpty()) {
            throw new FieldValidationException("id",
                    "Phòng còn " + String.join(", ", parts) + " — chuyển đi trước khi xoá");
        }
    }

    private long count(String sql, Long id, List<String> off) {
        var q = entityManager().createNativeQuery(sql).setParameter("id", id);
        if (off != null) {
            q.setParameter("off", off);
        }
        return ((Number) q.getSingleResult()).longValue();
    }

    private static void reconcile(Room item) {
        // Phòng có trạng thái nghiệp vụ riêng (Tình trạng sử dụng); cờ hoạt động chung của danh mục
        // không có ô trên form mà SUY từ nó: ngừng sử dụng thì không còn hiện trong các ô chọn.
        item.setActive(item.getUsageStatus() != RoomUsageStatus.NGUNG_SU_DUNG);
        // Loại phòng và môn học là danh mục TOÀN NGÀNH ở bản này, không thuộc một trường nào, nên không có
        // kiểm "cùng trường" như ở bản gốc (nơi hai loại đó có trường sở hữu).
    }

    private static boolean present(IdRef ref) {
        return ref != null && ref.id() != null;
    }
}
