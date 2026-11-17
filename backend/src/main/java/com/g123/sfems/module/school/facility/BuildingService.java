package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.catalog.base.CampusRule;
import org.springframework.beans.factory.annotation.Autowired;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.ArrayList;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.Building;
import com.g123.sfems.domain.school.facility.Room;
import jakarta.persistence.FlushModeType;
import java.math.BigDecimal;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.staff.StaffService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/** Khối nhà. Cơ sở và cán bộ phụ trách phải cùng trường với khối nhà. */
@Service
public class BuildingService extends SchoolOwnedService<Building, BuildingRequest, BuildingPatchRequest> {

    private final CampusService campuses;
    private final StaffService staff;

    public BuildingService(
            BuildingRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            CampusService campuses,
            StaffService staff) {
        super(repository, rowLevel, Building.class, Building::new, "Khối nhà", schools, principals);
        this.campuses = campuses;
        this.staff = staff;
    }

    @Override
    protected void applyCreateOwned(Building item, BuildingRequest request) {
        item.setCampus(present(request.campus())
                ? FacilityProfile.usable(campuses.get(request.campus().id()), null, "campus", "Cơ sở") : null);
        item.setFloorCount(request.floorCount());
        item.setBuiltYear(request.builtYear());
        item.setFloorArea(request.floorArea());
        item.setCondition(request.condition());
        item.setManagingStaff(present(request.managingStaff())
                ? FacilityProfile.usable(staff.get(request.managingStaff().id()), null, "managingStaff", "Cán bộ")
                : null);
        item.setStructure(request.structure());
        requireSameSchool(item, item.getCampus(), "campus");
        requireSameSchool(item, item.getManagingStaff(), "managingStaff");
    }

    @Override
    protected void applyUpdateOwned(Building item, BuildingPatchRequest request) {
        Profile before = Profile.of(item);
        if (request.campus() != null) {
            item.setCampus(present(request.campus())
                    ? FacilityProfile.usable(campuses.get(request.campus().id()), item.getCampus(), "campus", "Cơ sở")
                    : null);
        }
        if (request.floorCount() != null) {
            if (!request.floorCount().equals(item.getFloorCount())) {
                requireFloorsFit(item, request.floorCount());
            }
            item.setFloorCount(request.floorCount());
        }
        if (request.builtYear() != null) {
            item.setBuiltYear(request.builtYear());
        }
        if (request.floorArea() != null) {
            item.setFloorArea(request.floorArea());
        }
        if (request.condition() != null) {
            item.setCondition(request.condition());
        }
        if (request.managingStaff() != null) {
            item.setManagingStaff(present(request.managingStaff())
                    ? FacilityProfile.usable(staff.get(request.managingStaff().id()), item.getManagingStaff(),
                            "managingStaff", "Cán bộ")
                    : null);
        }
        if (request.structure() != null) {
            item.setStructure(request.structure());
        }
        requireSameSchool(item, item.getCampus(), "campus");
        requireSameSchool(item, item.getManagingStaff(), "managingStaff");
        Profile after = Profile.of(item);
        if (after.campus() != null && !after.campus().equals(before.campus())) {
            moveRooms(item);
        }
        cascadeStructure(item, before.structure());
    }

    /** Các ô hiện trạng của khối nhà — so trước / sau khi sửa (đổi cơ sở, đổi kết cấu). */
    private record Profile(FacilityStructure structure, FacilityCondition condition, Integer floorCount,
            BigDecimal floorArea, Integer builtYear, Long campus) {

        static Profile of(Building b) {
            return new Profile(b.getStructure(), b.getCondition(), b.getFloorCount(),
                    b.getFloorArea() == null ? null : b.getFloorArea().stripTrailingZeros(), b.getBuiltYear(),
                    b.getCampus() == null ? null : b.getCampus().getId());
        }
    }

    /** Giảm số tầng: không còn hạng mục đang dùng nào ở tầng cao hơn (tầng 0 / trống = không giới hạn). */
    private void requireFloorsFit(Building item, int floors) {
        if (floors <= 0 || item.getId() == null) {
            return;
        }
        Object[] row = (Object[]) entityManager().createNativeQuery("""
                SELECT count(*), min(f), max(f) FROM (
                    SELECT CASE WHEN floor ~ '^[0-9]{1,4}$' THEN CAST(floor AS INTEGER) END AS f
                    FROM rooms WHERE building_id = :id AND active) x
                WHERE f > :floors""")
                .setFlushMode(FlushModeType.COMMIT)
                .setParameter("id", item.getId())
                .setParameter("floors", floors)
                .getSingleResult();
        long n = ((Number) row[0]).longValue();
        if (n == 0) {
            return;
        }
        int low = ((Number) row[1]).intValue();
        int high = ((Number) row[2]).intValue();
        throw new FieldValidationException("floorCount", "Còn " + n + " hạng mục ở tầng "
                + (low == high ? String.valueOf(low) : low + "–" + high) + " — chuyển trước khi giảm số tầng");
    }

    /** Khối nhà sang cơ sở khác: các hạng mục trong khối đi theo (cơ sở của phòng lấy theo khối nhà). */
    /**
     * Kết cấu của phòng lấy theo khối nhà (trưởng nhóm, 12/11/2026): khối đổi kết cấu thì phòng của khối đang trống
     * hoặc đang trùng kết cấu CŨ của khối đổi theo; phòng khai riêng (tầng cơi nới, phần thuê…) giữ nguyên.
     */
    private void cascadeStructure(Building item, FacilityStructure old) {
        FacilityStructure now = item.getStructure();
        if (now == null || now == old) {
            return;
        }
        List<Room> rooms = entityManager()
                .createQuery("SELECT r FROM Room r WHERE r.building.id = :id", Room.class)
                .setParameter("id", item.getId())
                .getResultList();
        for (Room room : rooms) {
            if (room.getStructure() == null || room.getStructure() == old) {
                room.setStructure(now);
            }
        }
    }

    private void moveRooms(Building item) {
        List<Room> rooms = entityManager()
                .createQuery("SELECT r FROM Room r WHERE r.building.id = :id", Room.class)
                .setParameter("id", item.getId())
                .getResultList();
        for (Room room : rooms) {
            room.setCampus(item.getCampus());
        }
    }

    /**
     * Không xoá khối nhà còn hạng mục, còn kế hoạch bảo trì; đã có trong phiếu kiểm kê thì giữ lại làm lịch sử.
     */
    @Override
    protected void beforeDelete(Building item) {
        long rooms = count("SELECT count(*) FROM rooms WHERE building_id = :id", item.getId());
        long plans = count("SELECT count(*) FROM maintenance_plans WHERE building_id = :id", item.getId());
        List<String> parts = new ArrayList<>();
        if (rooms > 0) {
            parts.add(rooms + " hạng mục");
        }
        if (plans > 0) {
            parts.add(plans + " kế hoạch bảo trì");
        }
        if (!parts.isEmpty()) {
            throw new FieldValidationException("id",
                    "Khối nhà còn " + String.join(", ", parts) + " — chuyển đi trước khi xoá");
        }
        long inventories = count(
                "SELECT count(DISTINCT session_id) FROM inventory_facility_lines WHERE building_id = :id", item.getId());
        if (inventories > 0) {
            throw new FieldValidationException("id",
                    "Khối nhà đã có trong " + inventories + " phiếu kiểm kê — không xoá được");
        }
    }

    private long count(String sql, Long id) {
        return ((Number) entityManager().createNativeQuery(sql).setParameter("id", id).getSingleResult()).longValue();
    }

    /** Lọc thêm: {@code campus.id}. */
    @Override
    protected Specification<Building> ownedFilters(ListParams params) {
        return CatalogSpecifications.<Building>referenceFilter(params, "campus");
    }

    /**
     * Ghi kết quả kiểm kê hạng mục CSVC vào hồ sơ: kết cấu / hiện trạng thấy thực tế (trống = giữ nguyên).
     */
    @Transactional
    public Building applyInventory(Long id, FacilityStructure structure, FacilityCondition condition) {
        Building item = getWritable(id);
        Profile before = Profile.of(item);
        if (structure != null) {
            item.setStructure(structure);
        }
        if (condition != null) {
            item.setCondition(condition);
        }
        cascadeStructure(item, before.structure());
        return item;
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
    protected CampusRule<Building> campusRule() {
        return campusScope.buildings();
    }
}
