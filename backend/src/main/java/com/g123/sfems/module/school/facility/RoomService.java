package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.catalog.base.CampusRule;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.persistence.criteria.JoinType;
import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.school.facility.Building;
import com.g123.sfems.module.school.equipment.EquipmentService;
import jakarta.persistence.FlushModeType;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.util.Objects;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import java.util.ArrayList;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.roomtype.RoomTypeService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.staff.StaffService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phòng. Quy tắc riêng:
 *
 * <ul>
 *   <li>khối nhà, cơ sở, cán bộ phụ trách phải cùng trường với phòng</li>
 *   <li>có khối nhà thì cơ sở LẤY THEO khối nhà (khối nhà đã thuộc một cơ sở)
 *       — chọn cơ sở khác đi là mâu thuẫn, trả 422 thay vì lưu dữ liệu sai</li>
 * </ul>
 */
@Service
public class RoomService extends SchoolOwnedService<Room, RoomRequest, RoomPatchRequest> {

    private final CampusService campuses;
    private final BuildingService buildings;
    private final RoomTypeService roomTypes;
    private final StaffService staff;
    private final SubjectService subjects;
    private final RoomRepository repository;
    private final RowLevelSecurity rowLevel;
    private final RowLevelPrincipalResolver principals;
    private final VisibleSchools visibleSchools;

    private final FacilityTodoService todo;

    public RoomService(
            RoomRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            CampusService campuses,
            BuildingService buildings,
            RoomTypeService roomTypes,
            StaffService staff,
            SubjectService subjects,
            VisibleSchools visibleSchools,
            FacilityTodoService todo) {
        super(repository, rowLevel, Room.class, Room::new, "Phòng", schools, principals);
        this.campuses = campuses;
        this.buildings = buildings;
        this.roomTypes = roomTypes;
        this.staff = staff;
        this.subjects = subjects;
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.principals = principals;
        this.visibleSchools = visibleSchools;
        this.todo = todo;
    }

    /** Tên phòng có chữ "kho" đứng riêng — cùng quy tắc với ô chọn kho trên form phiếu ghi tăng. */
    private static final Pattern STOREROOM_NAME = Pattern.compile("(^|\\s)kho(\\s|$)", Pattern.CASE_INSENSITIVE);

    /**
     * Kho thiết bị của một trường: phòng đang dùng mang loại {@code KHO}, không có thì phòng có tên chứa chữ
     * "kho"; trường chưa khai kho thì {@code null}. Hàng ghi tăng luôn về kho — form chọn sẵn kho
     * cho từng dòng, còn phiếu lập từ đề xuất mua sắm, từ kiểm kê hay qua API thì máy chủ dùng hàm này.
     * Đọc qua phạm vi dòng như mọi lần đọc phòng. Tài khoản bị giới hạn trong một cơ sở của trường đó: kho của cơ sở
     * mình (cơ sở chưa có kho thì {@code null}).
     */
    public Room storeroomOf(Long schoolId) {
        Long campus = campusScope.pinnedCampusIn(schoolId);
        Specification<Room> spec = rowLevel.<Room>scope(Room.class, Action.READ)
                .and(campus == null ? Specification.unrestricted() : campusRule().inCampus(campus))
                .and((root, q, cb) -> cb.equal(root.get("school").get("id"), schoolId))
                .and((root, q, cb) -> cb.isTrue(root.get("active")));
        List<Room> rooms = repository.findAll(spec, Sort.by("name"));
        return rooms.stream()
                .filter(r -> r.getRoomType() != null && "KHO".equals(r.getRoomType().getCode()))
                .findFirst()
                .or(() -> rooms.stream()
                        .filter(r -> r.getName() != null && STOREROOM_NAME.matcher(r.getName()).find())
                        .min(Comparator.comparing(Room::getName)))
                .orElse(null);
    }

    @Override
    protected void applyCreateOwned(Room item, RoomRequest request) {
        requireLengths(request);
        item.setCampus(present(request.campus())
                ? sameSchool(item, FacilityProfile.usable(campuses.get(request.campus().id()), null, "campus", "Cơ sở"),
                        "campus", "Cơ sở") : null);
        item.setBuilding(present(request.building())
                ? sameSchool(item, FacilityProfile.usable(buildings.get(request.building().id()), null, "building",
                        "Khối nhà"), "building", "Khối nhà") : null);
        item.setRoomType(present(request.roomType()) ? roomType(item, request.roomType().id(), null, "roomType") : null);
        item.setSubject(present(request.subject())
                ? FacilityProfile.usable(subjects.get(request.subject().id()), null, "subject", "Môn") : null);
        item.setLocation(blankToNull(request.location()));
        item.setFloor(blankToNull(request.floor()));
        item.setArea(request.area());
        item.setCapacity(request.capacity());
        item.setCondition(request.condition());
        item.setUsageStatus(request.usageStatus());
        item.setManagingStaff(present(request.managingStaff())
                ? sameSchool(item, FacilityProfile.usable(staff.get(request.managingStaff().id()), null,
                        "managingStaff", "Cán bộ"), "managingStaff", "Cán bộ")
                : null);
        item.setManagingUnit(blankToNull(request.managingUnit()));
        item.setLoanable(request.loanable() != null ? request.loanable() : defaultLoanable(item));
        // Kết cấu lấy theo khối nhà khi không khai riêng (chốt 12/11/2026) — cả form lẫn lô nhập thiếu cột kết cấu.
        item.setStructure(request.structure() != null ? request.structure()
                : item.getBuilding() != null ? item.getBuilding().getStructure() : null);
        item.setCombinedType(present(request.combinedType())
                ? roomType(item, request.combinedType().id(), null, "combinedType") : null);
        item.setParams(FacilityProfile.params(request.params(), item.getRoomType(), item.getCombinedType()));
        item.setOpenDays(OpeningHours.joinDays(request.openDays()));
        item.setOpenSessions(OpeningHours.joinSessions(request.openSessions()));
        requireArea(item, null, true);
        requireFloor(item);
        requirePositive(item.getArea(), item.getCapacity());
        reconcile(item);
        requireNameFree(item);
    }

    /**
     * Cho mượn mặc định theo cờ của loại CSVC (192): phòng bộ môn, phòng đa chức năng, nhà đa năng, hội
     * trường cho mượn; phòng học, kho, thư viện, sân, cổng… và phòng chưa phân loại thì không. Form đọc cùng cờ.
     */
    private static boolean defaultLoanable(Room item) {
        return item.getRoomType() != null && !isArea(item.getRoomType()) && item.getRoomType().isLoanable();
    }

    /** Loại CSVC của phòng: loại của Sở, hoặc loại ngoài danh mục của CHÍNH trường đó. */
    private RoomType roomType(Room item, Long id, RoomType current, String field) {
        RoomType type = roomTypes.get(id);
        if (type.getSchoolId() != null && !type.getSchoolId().equals(item.getSchool().getId())) {
            throw new FieldValidationException(field, "Loại này của trường khác");
        }
        return FacilityProfile.usable(type, current, field, "Loại");
    }

    private static boolean isArea(RoomType type) {
        return type != null && RoomType.AREA.equals(type.getKind());
    }

    /**
     * Trường thêm một loại CSVC ngoài danh mục ngay từ form phòng. Quyền {@code rooms:write} kiểm ở
     * controller; ở đây kiểm trường nằm trong phạm vi người dùng.
     */
    @Transactional
    public RoomType createCustomType(Long schoolId, String name, Long groupId, String kind) {
        Long school = schoolId != null ? schoolId
                : principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (school == null) {
            throw new FieldValidationException("school", "Chọn trường");
        }
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(school)) {
            throw new FieldValidationException("school", "Không thêm được loại cho trường này");
        }
        return roomTypes.createForSchool(school, name, groupId, kind);
    }

    @Override
    protected void applyUpdateOwned(Room item, RoomPatchRequest request) {
        Before old = Before.of(item);
        FacilityStructure oldBuildingStructure = item.getBuilding() == null ? null : item.getBuilding().getStructure();
        if (request.campus() != null) {
            item.setCampus(present(request.campus())
                    ? sameSchool(item, FacilityProfile.usable(campuses.get(request.campus().id()), item.getCampus(),
                            "campus", "Cơ sở"), "campus", "Cơ sở")
                    : null);
        }
        if (request.building() != null) {
            item.setBuilding(present(request.building())
                    ? sameSchool(item, FacilityProfile.usable(buildings.get(request.building().id()), item.getBuilding(),
                            "building", "Khối nhà"), "building", "Khối nhà")
                    : null);
        }
        if (request.roomType() != null) {
            item.setRoomType(present(request.roomType())
                    ? roomType(item, request.roomType().id(), item.getRoomType(), "roomType") : null);
        }
        if (request.subject() != null) {
            item.setSubject(present(request.subject())
                    ? FacilityProfile.usable(subjects.get(request.subject().id()), item.getSubject(), "subject", "Môn")
                    : null);
        }
        if (request.location() != null) {
            item.setLocation(blankToNull(request.location()));
        }
        if (request.floor() != null) {
            item.setFloor(blankToNull(request.floor()));
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
        if (request.managingStaff() != null) {
            item.setManagingStaff(present(request.managingStaff())
                    ? sameSchool(item, FacilityProfile.usable(staff.get(request.managingStaff().id()),
                            item.getManagingStaff(), "managingStaff", "Cán bộ"), "managingStaff", "Cán bộ")
                    : null);
        }
        if (request.managingUnit() != null) {
            item.setManagingUnit(blankToNull(request.managingUnit()));
        }
        if (request.loanable() != null) {
            item.setLoanable(request.loanable());
        }
        if (request.structure() != null) {
            item.setStructure(request.structure());
        } else if (item.getBuilding() != null && item.getBuilding().getStructure() != null
                && (item.getStructure() == null || item.getStructure() == oldBuildingStructure)) {
            // Không khai riêng: kết cấu theo khối nhà (đổi khối thì đổi theo); phòng khai khác khối cũ thì giữ.
            item.setStructure(item.getBuilding().getStructure());
        }
        if (request.combinedType() != null) {
            item.setCombinedType(present(request.combinedType())
                    ? roomType(item, request.combinedType().id(), item.getCombinedType(), "combinedType") : null);
        }
        if (request.openDays() != null) {
            item.setOpenDays(OpeningHours.joinDays(request.openDays()));
        }
        if (request.openSessions() != null) {
            item.setOpenSessions(OpeningHours.joinSessions(request.openSessions()));
        }
        // Vừa đổi sang Khu vực, công trình: sức chứa không xoá được qua PATCH (null = để nguyên) và ô cho mượn bị ẩn,
        // nên máy chủ tự bỏ hai ô này; khối nhà / tầng / môn thì người dùng phải bỏ (form tự bỏ khi chọn loại).
        if (isArea(item.getRoomType()) && !isArea(old.roomType())) {
            if (request.capacity() == null) {
                item.setCapacity(null);
            }
            if (request.loanable() == null) {
                item.setLoanable(false);
            }
        }
        // Đổi loại thì thông số của loại cũ không còn nghĩa: lọc lại theo loại mới dù không gửi thông số.
        item.setParams(FacilityProfile.params(request.params() != null ? request.params() : item.getParams(),
                item.getRoomType(), item.getCombinedType()));
        requireArea(item, old, false);
        if (!Objects.equals(old.building(), id(item.getBuilding()))
                || !Objects.equals(old.floor(), item.getFloor())) {
            requireFloor(item);
        }
        requirePositive(changed(old.area(), item.getArea()) ? item.getArea() : null,
                Objects.equals(old.capacity(), item.getCapacity()) ? null : item.getCapacity());
        reconcile(item);
        if (request.name() != null || !Objects.equals(old.building(), id(item.getBuilding()))
                || old.usage() == RoomUsageStatus.NGUNG_SU_DUNG) {
            requireNameFree(item);
        }
    }

    /** Lọc thêm: {@code campus.id}, {@code building.id}, {@code roomType.id}, {@code subject.id}. */
    @Override
    protected Specification<Room> ownedFilters(ListParams params) {
        return Specification.allOf(List.of(
                CatalogSpecifications.<Room>referenceFilter(params, "campus"),
                CatalogSpecifications.<Room>referenceFilter(params, "building"),
                CatalogSpecifications.<Room>referenceFilter(params, "roomType"),
                CatalogSpecifications.<Room>referenceFilter(params, "subject"),
                groupFilter(params),
                catalogFilter(params),
                todoFilter(params)));
    }

    /**
     * {@code todo=<khoá>} + {@code school.id=n}: các hạng mục của một việc trong "Cần hoàn thiện" (chưa khai kết cấu,
     * chưa có diện tích, trùng tên…) — cùng điều kiện với số đếm, nên bấm "Xem" ra đúng chừng ấy dòng.
     */
    private Specification<Room> todoFilter(ListParams params) {
        String key = null;
        Long schoolId = null;
        for (ListParams.Criterion c : params.filters()) {
            if (c.value() == null) {
                continue;
            }
            if ("todo".equals(c.field())) {
                key = c.value().trim();
            } else if ("school.id".equals(c.field())) {
                try {
                    schoolId = Long.valueOf(c.value().trim());
                } catch (NumberFormatException e) {
                    schoolId = null;
                }
            }
        }
        if (key == null || schoolId == null || !FacilityTodoService.isRoomKey(key)) {
            return Specification.unrestricted();
        }
        List<Long> ids = todo.roomIds(schoolId, key);
        return (root, q, cb) -> ids.isEmpty() ? cb.disjunction() : root.get("id").in(ids);
    }

    /**
     * {@code catalog=in}: hạng mục có loại thuộc danh mục của Sở; {@code catalog=out}: loại ngoài danh mục (trường tự
     * thêm). Hạng mục chưa có loại không thuộc bên nào.
     */
    private static Specification<Room> catalogFilter(ListParams params) {
        List<Specification<Room>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            if (!"catalog".equals(c.field()) || c.value() == null) {
                continue;
            }
            boolean out = "out".equals(c.value().trim());
            specs.add((root, q, cb) -> {
                var type = root.join("roomType", JoinType.INNER);
                return out ? cb.isNotNull(type.get("schoolId")) : cb.isNull(type.get("schoolId"));
            });
        }
        return Specification.allOf(specs);
    }

    /**
     * Lọc theo khối CSVC của loại phòng: {@code group.id=n}; {@code none} = chưa phân loại (không loại, hoặc loại chưa
     * thuộc khối nào). Màn khai báo CSVC chia hạng mục theo khối như phần mềm CSDL HCM.
     */
    private static Specification<Room> groupFilter(ListParams params) {
        List<Specification<Room>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            if (!"group.id".equals(c.field()) || c.value() == null) {
                continue;
            }
            String v = c.value().trim();
            if ("none".equals(v)) {
                specs.add((root, q, cb) -> {
                    var type = root.join("roomType", JoinType.LEFT);
                    return cb.or(cb.isNull(root.get("roomType")), cb.isNull(type.get("group")));
                });
                continue;
            }
            Long id;
            try {
                id = Long.valueOf(v);
            } catch (NumberFormatException e) {
                specs.add((root, q, cb) -> cb.disjunction());
                continue;
            }
            specs.add((root, q, cb) -> cb.equal(
                    root.join("roomType", JoinType.LEFT).join("group", JoinType.LEFT).get("id"), id));
        }
        return Specification.allOf(specs);
    }

    /**
     * Ghi kết quả kiểm kê hạng mục CSVC vào hồ sơ: kết cấu / hiện trạng thấy thực tế (trống = giữ nguyên).
     */
    @Transactional
    public Room applyInventory(Long id, FacilityStructure structure, FacilityCondition condition) {
        Room item = getWritable(id);
        if (structure != null) {
            item.setStructure(structure);
        }
        if (condition != null) {
            item.setCondition(condition);
        }
        return item;
    }

    // ---------------------------------------------------------------- luật ghi

    /** Giá trị trước khi sửa của những ô mà luật ghi so sánh. */
    private record Before(RoomType roomType, Long building, String floor, BigDecimal area, Integer capacity,
            Long subject, RoomUsageStatus usage, boolean loanable) {

        static Before of(Room r) {
            return new Before(r.getRoomType(), id(r.getBuilding()), r.getFloor(), r.getArea(), r.getCapacity(),
                    id(r.getSubject()), r.getUsageStatus(), r.isLoanable());
        }
    }

    private static Long id(CatalogEntity e) {
        return e == null ? null : e.getId();
    }

    private static boolean changed(BigDecimal a, BigDecimal b) {
        return a == null ? b != null : b == null || a.compareTo(b) != 0;
    }

    /**
     * Khu vực, công trình (sân, cổng, khu vệ sinh, khu để xe…) không nằm trong khối nhà, không có tầng, sức chứa, môn,
     * không cho mượn. Lúc tạo / vừa đổi sang loại khu vực thì kiểm cả bản ghi; còn lại chỉ kiểm ô vừa đổi — hạng mục cũ
     * lỡ có giá trị vẫn sửa được ô khác.
     */
    private static void requireArea(Room item, Before old, boolean create) {
        if (!isArea(item.getRoomType())) {
            return;
        }
        boolean all = create || !isArea(old.roomType());
        List<String> bad = new ArrayList<>();
        String field = null;
        if (item.getBuilding() != null && (all || !Objects.equals(old.building(), id(item.getBuilding())))) {
            bad.add("khối nhà");
            field = "building";
        }
        if (item.getFloor() != null && (all || !Objects.equals(old.floor(), item.getFloor()))) {
            bad.add("tầng");
            field = field == null ? "floor" : field;
        }
        if (item.getCapacity() != null && (all || !Objects.equals(old.capacity(), item.getCapacity()))) {
            bad.add("sức chứa");
            field = field == null ? "capacity" : field;
        }
        if (item.getSubject() != null && (all || !Objects.equals(old.subject(), id(item.getSubject())))) {
            bad.add("môn");
            field = field == null ? "subject" : field;
        }
        if (item.isLoanable() && (all || !old.loanable())) {
            bad.add("cho mượn");
            field = field == null ? "loanable" : field;
        }
        if (!bad.isEmpty()) {
            throw new FieldValidationException(field,
                    "Khu vực, công trình không gắn " + String.join(", ", bad) + " — bỏ trống các ô này");
        }
    }

    /** Tầng: số nguyên từ 1, phải có khối nhà, không vượt số tầng của khối nhà (form chọn Tầng 1…N). */
    private static void requireFloor(Room item) {
        String floor = item.getFloor();
        if (floor == null) {
            return;
        }
        if (item.getBuilding() == null) {
            throw new FieldValidationException("floor", "Chọn khối nhà trước khi chọn tầng");
        }
        if (!floor.matches("\\d{1,4}") || Integer.parseInt(floor) < 1) {
            throw new FieldValidationException("floor", "Tầng là số nguyên từ 1");
        }
        Integer floors = item.getBuilding().getFloorCount();
        if (floors != null && floors > 0 && Integer.parseInt(floor) > floors) {
            throw new FieldValidationException("floor", "Khối nhà này chỉ có " + floors + " tầng");
        }
    }

    /** Trần diện tích một phòng / hạng mục (trưởng nhóm chốt 12/11/2026) — quá thì thường là gõ nhầm đơn vị. */
    static final BigDecimal MAX_AREA = BigDecimal.valueOf(10_000);
    /** Trần sức chứa một phòng (chốt 12/11/2026). */
    static final int MAX_CAPACITY = 2_000;

    /**
     * Độ dài ô chữ của phòng (trưởng nhóm chốt 12/11/2026) — hẹp hơn trần chung của kiểu ô (mã 64, tên 255, ghi chú
     * 500). Kiểm ở đây chứ không ở {@code @Text} của request: chỉ chặn khi ô VỪA ĐỔI, để phòng nhà thầu đã đổ vào với
     * mã / tên dài vẫn sửa được ô khác (form gửi lại cả mã, tên cũ).
     */
    static final int MAX_CODE = 20;
    static final int MAX_NAME = 100;
    static final int MAX_LOCATION = 100;
    static final int MAX_UNIT = 100;
    static final int MAX_NOTE = 255;

    @Override
    @Transactional
    public Room update(Long id, RoomPatchRequest request) {
        Room current = get(id);
        requireLength("code", "Mã phòng", request.code(), current.getCode(), MAX_CODE);
        requireLength("name", "Tên phòng", request.name(), current.getName(), MAX_NAME);
        requireLength("note", "Ghi chú", request.note(), current.getNote(), MAX_NOTE);
        requireLength("location", "Vị trí", request.location(), current.getLocation(), MAX_LOCATION);
        requireLength("managingUnit", "Đơn vị quản lý", request.managingUnit(), current.getManagingUnit(), MAX_UNIT);
        return super.update(id, request);
    }

    private static void requireLengths(RoomRequest request) {
        requireLength("code", "Mã phòng", request.code(), null, MAX_CODE);
        requireLength("name", "Tên phòng", request.name(), null, MAX_NAME);
        requireLength("note", "Ghi chú", request.note(), null, MAX_NOTE);
        requireLength("location", "Vị trí", request.location(), null, MAX_LOCATION);
        requireLength("managingUnit", "Đơn vị quản lý", request.managingUnit(), null, MAX_UNIT);
    }

    /** {@code value} quá {@code max} ký tự và khác giá trị đang lưu → lỗi tại ô đó. */
    private static void requireLength(String field, String label, String value, String current, int max) {
        if (value == null) {
            return;
        }
        String v = value.trim();
        if (v.codePointCount(0, v.length()) > max && !v.equals(current)) {
            throw new FieldValidationException(field, label + " tối đa " + max + " ký tự");
        }
    }

    /**
     * Khối nhà, cơ sở, cán bộ phụ trách phải cùng trường với phòng. Tài khoản trường chỉ thấy dữ liệu trường mình nên
     * vốn không chọn chéo được; tài khoản Sở / quản trị và lô nhập thì có thể — chặn ở đây.
     */
    private static <E extends SchoolOwnedEntity> E sameSchool(Room item, E ref, String field, String label) {
        if (ref != null && item.getSchool() != null && ref.getSchool() != null
                && !Objects.equals(ref.getSchool().getId(), item.getSchool().getId())) {
            throw new FieldValidationException(field, label + " \"" + ref.getName() + "\" thuộc trường khác");
        }
        return ref;
    }

    /** Diện tích, sức chứa vừa khai: lớn hơn 0 và không quá trần ({@code null} = không kiểm). */
    private static void requirePositive(BigDecimal area, Integer capacity) {
        if (area != null && area.signum() <= 0) {
            throw new FieldValidationException("area", "Diện tích phải lớn hơn 0");
        }
        if (area != null && area.compareTo(MAX_AREA) > 0) {
            throw new FieldValidationException("area", "Diện tích tối đa 10.000 m² — kiểm tra lại đơn vị");
        }
        if (capacity != null && capacity <= 0) {
            throw new FieldValidationException("capacity", "Sức chứa phải lớn hơn 0");
        }
        if (capacity != null && capacity > MAX_CAPACITY) {
            throw new FieldValidationException("capacity", "Sức chứa tối đa 2.000 chỗ");
        }
    }

    /**
     * Tên không trùng (không phân biệt hoa thường) với hạng mục đang dùng khác trong cùng khối nhà, hoặc cùng trường
     * khi không gắn khối nhà. Truy vấn không đẩy bản ghi đang sửa xuống DB (luật "kiểm trùng trước khi sửa").
     */
    private void requireNameFree(Room item) {
        if (!Boolean.TRUE.equals(item.getActive()) || item.getName() == null) {
            return;
        }
        Building building = item.getBuilding();
        String jpql = "SELECT r.id FROM Room r WHERE r.school.id = :school AND r.active = true"
                + " AND lower(r.name) = lower(:name) AND r.id <> :self"
                + (building == null ? " AND r.building IS NULL" : " AND r.building.id = :building");
        TypedQuery<Long> q = entityManager().createQuery(jpql, Long.class)
                .setFlushMode(FlushModeType.COMMIT)
                .setParameter("school", item.getSchool().getId())
                .setParameter("name", item.getName())
                .setParameter("self", item.getId() == null ? -1L : item.getId())
                .setMaxResults(1);
        if (building != null) {
            q.setParameter("building", building.getId());
        }
        if (!q.getResultList().isEmpty()) {
            throw new FieldValidationException("name", building == null
                    ? "Đã có hạng mục tên \"" + item.getName() + "\" chưa gắn khối nhà"
                    : "Đã có hạng mục tên \"" + item.getName() + "\" trong khối nhà " + building.getName());
        }
    }

    /**
     * Không xoá hạng mục còn thiết bị trên sổ, còn lớp năm học này (khoá ngoại sẽ lặng lẽ bỏ
     * phòng của thiết bị / lớp); đã có trong phiếu kiểm kê thì giữ lại làm lịch sử.
     */
    @Override
    protected void beforeDelete(Room item) {
        long equipment = count("SELECT count(*) FROM equipment WHERE room_id = :id AND status NOT IN (:off)",
                item.getId(), EquipmentService.OFF_BOOK.stream().map(Enum::name).toList());
        long classes = count("""
                SELECT count(*) FROM school_classes k JOIN school_years y ON y.id = k.school_year_id AND y.is_current
                WHERE k.room_id = :id AND k.active""", item.getId(), null);
        List<String> parts = new ArrayList<>();
        if (equipment > 0) {
            parts.add(equipment + " thiết bị");
        }
        if (classes > 0) {
            parts.add(classes + " lớp");
        }
        if (!parts.isEmpty()) {
            throw new FieldValidationException("id",
                    "Hạng mục còn " + String.join(", ", parts) + " — chuyển đi trước khi xoá");
        }
        long inventories = count("SELECT count(DISTINCT session_id) FROM inventory_facility_lines WHERE room_id = :id",
                item.getId(), null);
        if (inventories > 0) {
            throw new FieldValidationException("id",
                    "Hạng mục đã có trong " + inventories + " phiếu kiểm kê — chuyển sang Ngừng sử dụng thay vì xoá");
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
        requireSameSchool(item, item.getCampus(), "campus");
        requireSameSchool(item, item.getBuilding(), "building");
        requireSameSchool(item, item.getManagingStaff(), "managingStaff");
        if (item.getCombinedType() != null && item.getRoomType() != null
                && item.getCombinedType().getId().equals(item.getRoomType().getId())) {
            throw new FieldValidationException("combinedType", "Loại dùng kết hợp phải khác loại CSVC chính");
        }
        // Không báo lỗi khi cơ sở gửi lên khác: form sửa gửi lại cơ sở CŨ cùng
        // khối nhà MỚI, và người dùng chỉ đổi khối nhà thì không nên vấp lỗi.
        if (item.getBuilding() != null && item.getBuilding().getCampus() != null) {
            item.setCampus(item.getBuilding().getCampus());
        }
    }

    private static boolean present(IdRef ref) {
        return ref != null && ref.id() != null;
    }

    private CampusScope campusScope;

    /** Tiêm qua setter — phạm vi cơ sở (270), xem {@link CampusScope}. */
    @Autowired
    void setCampusScope(CampusScope campusScope) {
        this.campusScope = campusScope;
    }

    @Override
    protected CampusRule<Room> campusRule() {
        return campusScope.rooms();
    }
}
