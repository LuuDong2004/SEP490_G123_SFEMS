package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/facility_info/{schoolId}} — thông tin chung CSVC của một trường: diện tích đất, diện tích xây
 * dựng, học sinh, lớp, cơ sở (trường chính / phân hiệu / điểm trường), số chỗ nhà ăn / nội trú / thư viện, số mục chưa
 * khai kết cấu. Tài khoản của trường không có {@code schools:write} nên hai số diện tích sửa ở đây, dưới
 * quyền sửa CSVC ({@code rooms:write}) và phạm vi ghi hạng mục CSVC của trường đó.
 *
 * <p>Mọi số theo {@link FacilityCounting}: hạng mục được tính = còn dùng và đã xác nhận; học sinh / lớp = lớp năm học
 * hiện hành. Hạng mục tính theo LOẠI CHÍNH một lần — phòng kết hợp không đếm thêm ở loại kết hợp (khác chấm mức độ
 * chuẩn, nơi dùng kết hợp cũng làm đạt chuẩn loại đó).
 */
@RestController
@RequestMapping("/api/facility_info")
public class FacilityInfoController {

    private final JdbcTemplate jdbc;
    private final SchoolService schools;
    private final VisibleSchools visibleSchools;
    private final RowLevelSecurity rowLevel;
    private final CampusScope campusScope;

    public FacilityInfoController(JdbcTemplate jdbc, SchoolService schools, VisibleSchools visibleSchools,
            RowLevelSecurity rowLevel, CampusScope campusScope) {
        this.jdbc = jdbc;
        this.schools = schools;
        this.visibleSchools = visibleSchools;
        this.rowLevel = rowLevel;
        this.campusScope = campusScope;
    }

    /** Một cơ sở; học sinh / lớp chia từ lớp năm nay theo phòng học của lớp (xem {@link FacilityCounting}). */
    public record CampusInfo(Long id, String code, String name, String kind, Integer studentCount, Integer classCount) {
    }

    /** Số hạng mục theo khối CSVC — cột trái màn khai báo. {@code id} null = chưa phân loại. */
    public record GroupCount(Long id, String code, String name, long count, BigDecimal area) {
    }

    /** Số hạng mục và diện tích theo kết cấu; {@code key} null = chưa khai kết cấu. */
    public record StructureCount(String key, long count, BigDecimal area) {
    }

    /**
     * {@code studentCount} / {@code classCount} null = chưa có lớp năm học hiện hành; {@code classesMissingSize} = số
     * lớp năm nay chưa có sĩ số (trống hoặc 0) — học sinh chỉ cộng các lớp đã có sĩ số.
     */
    public record FacilityInfo(
            Long schoolId,
            BigDecimal landArea,
            BigDecimal constructionArea,
            Integer studentCount,
            Integer classCount,
            int classesMissingSize,
            BigDecimal landPerStudent,
            List<CampusInfo> campuses,
            long rooms,
            long areas,
            long buildings,
            long noStructure,
            long diningSeats,
            long boardingSeats,
            long librarySeats,
            List<GroupCount> groups,
            List<StructureCount> structures,
            BigDecimal totalArea) {
    }

    /**
     * Ngữ nghĩa sửa từng phần: ô VẮNG trong body là để nguyên, ô gửi {@code null} là xoá. Record không phân biệt được
     * hai trường hợp đó nên dùng setter ghi lại ô đã gửi.
     */
    public static final class FacilityInfoRequest {

        @Num(value = NumberRule.AREA, label = "Diện tích đất")
        private BigDecimal landArea;

        @Num(value = NumberRule.AREA, label = "Diện tích xây dựng")
        private BigDecimal constructionArea;

        private boolean landAreaSent;
        private boolean constructionAreaSent;

        public BigDecimal getLandArea() {
            return landArea;
        }

        public void setLandArea(BigDecimal landArea) {
            this.landArea = landArea;
            this.landAreaSent = true;
        }

        public BigDecimal getConstructionArea() {
            return constructionArea;
        }

        public void setConstructionArea(BigDecimal constructionArea) {
            this.constructionArea = constructionArea;
            this.constructionAreaSent = true;
        }
    }

    @GetMapping("/{schoolId}")
    @PreAuthorize("hasAuthority('rooms:read')")
    public FacilityInfo get(@PathVariable Long schoolId) {
        requireVisible(schoolId);
        return info(schools.get(schoolId));
    }

    @RequestMapping(path = "/{schoolId}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    @PreAuthorize("hasAuthority('rooms:write')")
    @Transactional
    public FacilityInfo update(@PathVariable Long schoolId, @Valid @RequestBody FacilityInfoRequest request) {
        requireVisible(schoolId);
        // Đọc qua phạm vi (404 nếu ngoài phạm vi), rồi kiểm phạm vi GHI hạng mục CSVC của trường này (vế WITH CHECK
        // của `rooms`) — ai sửa được CSVC trường nào thì sửa được diện tích trường đó, không cần quyền sửa hồ sơ
        // trường. Số học sinh, số lớp KHÔNG nhập ở đây: tính từ danh sách lớp (xem `info`).
        School school = schools.get(schoolId);
        Room probe = new Room();
        probe.setSchool(school);
        rowLevel.checkWritable(probe);
        if (request.landAreaSent || request.constructionAreaSent) {
            SchoolService.requireAreasFit(request.landAreaSent ? request.landArea : school.getLandArea(),
                    request.constructionAreaSent ? request.constructionArea : school.getConstructionArea());
        }
        if (request.landAreaSent) {
            jdbc.update("UPDATE schools SET land_area = ?, updated_at = now() WHERE id = ?", request.landArea,
                    schoolId);
        }
        if (request.constructionAreaSent) {
            jdbc.update("UPDATE schools SET construction_area = ?, updated_at = now() WHERE id = ?",
                    request.constructionArea, schoolId);
        }
        return info(schoolId);
    }

    private void requireVisible(Long schoolId) {
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("School", schoolId);
        }
    }

    /** Sau khi ghi bằng JDBC: đọc lại hai số diện tích từ bảng, không từ thực thể đã nạp trước đó. */
    private FacilityInfo info(Long schoolId) {
        Map<String, Object> areas = jdbc.queryForMap(
                "SELECT land_area, construction_area FROM schools WHERE id = ?", schoolId);
        return info(schoolId, (BigDecimal) areas.get("land_area"), (BigDecimal) areas.get("construction_area"));
    }

    private FacilityInfo info(School school) {
        return info(school.getId(), school.getLandArea(), school.getConstructionArea());
    }

    private FacilityInfo info(long id, BigDecimal landArea, BigDecimal constructionArea) {
        // Tài khoản một cơ sở (271): chỉ số của cơ sở mình — lớp, cơ sở, khối nhà, phòng. Diện tích đất / xây dựng
        // là của cả trường, giữ nguyên.
        Long pinned = campusScope.pinnedCampusIn(id);
        String pinRoom = pinned == null ? " "
                : FacilityCounting.roomInCampusSql("r.id", "r.school_id", String.valueOf(pinned.longValue()));
        String pinCampus = pinned == null ? " " : " AND c.id = " + pinned.longValue() + " ";
        String pinBuilding = pinned == null ? " "
                : FacilityCounting.ownCampusInSql("bb.campus_id", "bb.school_id", String.valueOf(pinned.longValue()));
        // Học sinh / lớp: một nguồn — lớp đang dùng của năm học hiện hành. Không có lớp = null, không mượn số khác.
        List<Map<String, Object>> cls = jdbc.queryForList(
                "SELECT classes, students, missing_size FROM ("
                        + (pinned == null ? FacilityCounting.CLASS_COUNTS : FacilityCounting.classCountsOf(pinned))
                        + ") cl WHERE cl.school_id = ?", id);
        Integer classCount = cls.isEmpty() ? null : (int) n(cls.getFirst().get("classes"));
        Integer studentCount = cls.isEmpty() || cls.getFirst().get("students") == null ? null
                : (int) n(cls.getFirst().get("students"));
        int missingSize = cls.isEmpty() ? 0 : (int) n(cls.getFirst().get("missing_size"));
        boolean hasClasses = classCount != null;
        List<CampusInfo> campuses = jdbc.query("""
                SELECT c.id, c.code, c.name, c.is_primary, c.branch, x.classes, x.students FROM campuses c
                LEFT JOIN (%s) x ON x.campus_id = c.id
                WHERE c.school_id = ? AND c.active%s ORDER BY c.is_primary DESC, c.branch DESC, c.sort_order NULLS LAST, c.name
                """.formatted(FacilityCounting.CLASS_COUNTS_BY_CAMPUS, pinCampus),
                (rs, i) -> {
                    // Integer.valueOf: để `int` trần thì cả biểu thức `? :` thành int, nhánh null bị unbox → NPE.
                    Integer classes = rs.getObject("classes") == null ? (hasClasses ? 0 : null)
                            : Integer.valueOf(rs.getInt("classes"));
                    Integer students = rs.getObject("students") == null
                            ? (hasClasses && classes == 0 ? 0 : null)
                            : Integer.valueOf(rs.getInt("students"));
                    return new CampusInfo(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                            rs.getBoolean("is_primary") ? "MAIN" : rs.getBoolean("branch") ? "BRANCH" : "POINT",
                            students, classes);
                }, id);
        String counted = FacilityCounting.COUNTED_ROOM + pinRoom;
        Map<String, Object> c = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE %1$s AND t.kind IS DISTINCT FROM 'AREA') AS rooms,
                       count(*) FILTER (WHERE %1$s AND t.kind = 'AREA') AS areas,
                       count(*) FILTER (WHERE %1$s AND r.structure IS NULL) AS no_structure,
                       coalesce(sum(r.capacity) FILTER (WHERE %1$s AND t.system_key = 'NHA_AN'), 0) AS dining,
                       coalesce(sum(CASE WHEN r.params ->> 'beds' ~ '^[0-9]+([.][0-9]+)?$'
                                         THEN (r.params ->> 'beds')::numeric ELSE r.capacity END)
                           FILTER (WHERE %1$s AND t.system_key = 'NHA_O_NOI_TRU'), 0) AS boarding,
                       coalesce(sum(r.capacity) FILTER (WHERE %1$s AND t.system_key = 'THU_VIEN'), 0) AS library
                FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
                WHERE r.school_id = ? AND r.active
                """.formatted(counted), id);
        Map<String, Object> b = jdbc.queryForMap("""
                SELECT count(*) AS buildings
                FROM buildings bb WHERE bb.school_id = ? AND bb.active%s
                """.formatted(pinBuilding), id);
        List<GroupCount> groups = new ArrayList<>(jdbc.query("""
                SELECT g.id, g.code, g.name, count(r.id) AS n, coalesce(sum(r.area), 0) AS area
                FROM facility_groups g
                LEFT JOIN room_types t ON t.group_id = g.id
                LEFT JOIN rooms r ON r.room_type_id = t.id AND r.school_id = ? AND %s
                WHERE g.active
                GROUP BY g.id, g.code, g.name, g.sort_order
                ORDER BY g.sort_order NULLS LAST, g.name
                """.formatted(counted), (rs, i) -> new GroupCount(rs.getLong("id"), rs.getString("code"),
                rs.getString("name"), rs.getLong("n"), rs.getBigDecimal("area")), id));
        Long ungrouped = jdbc.queryForObject("""
                SELECT count(*) FROM rooms r LEFT JOIN room_types t ON t.id = r.room_type_id
                WHERE r.school_id = ? AND %s AND (r.room_type_id IS NULL OR t.group_id IS NULL)
                """.formatted(counted), Long.class, id);
        if (ungrouped != null && ungrouped > 0) {
            groups.add(new GroupCount(null, null, "Chưa phân loại", ungrouped, null));
        }
        List<StructureCount> structures = jdbc.query("""
                SELECT r.structure, count(*) AS n, coalesce(sum(r.area), 0) AS area FROM rooms r
                WHERE r.school_id = ? AND %s GROUP BY r.structure
                ORDER BY CASE r.structure WHEN 'KIEN_CO' THEN 1 WHEN 'BAN_KIEN_CO' THEN 2 WHEN 'TAM' THEN 3
                                          WHEN 'NHO_MUON_THUE' THEN 4 ELSE 5 END
                """.formatted(counted), (rs, i) -> new StructureCount(rs.getString("structure"), rs.getLong("n"),
                rs.getBigDecimal("area")), id);
        BigDecimal totalArea = structures.stream().map(StructureCount::area).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal perStudent = landArea == null || studentCount == null || studentCount == 0 ? null
                : landArea.divide(BigDecimal.valueOf(studentCount), 2, RoundingMode.HALF_UP);
        return new FacilityInfo(id, landArea, constructionArea, studentCount, classCount, missingSize, perStudent,
                campuses, n(c.get("rooms")), n(c.get("areas")), n(b.get("buildings")), n(c.get("no_structure")),
                n(c.get("dining")), n(c.get("boarding")), n(c.get("library")), groups, structures, totalArea);
    }

    private static long n(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }
}
