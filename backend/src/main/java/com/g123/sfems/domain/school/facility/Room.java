package com.g123.sfems.domain.school.facility;

import java.util.Map;
import java.util.LinkedHashMap;
import org.hibernate.type.SqlTypes;
import org.hibernate.annotations.JdbcTypeCode;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * Phòng — phòng học, phòng bộ môn, phòng chức năng. Thuộc một khối nhà (tuỳ
 * chọn); cơ sở suy từ khối nhà khi có, để hai thứ không mâu thuẫn.
 */
@RowLevelResource("rooms")
@Entity
@Table(name = "rooms")
public class Room extends SchoolOwnedEntity {

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "campus_id")
    private Campus campus;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "building_id")
    private Building building;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    /**
     * Phòng bộ môn / thí nghiệm / máy tính là của môn nào (100). Trống với phòng học thường, kho, thư
     * viện. Định mức "tính cho 01 phòng học bộ môn" nhân theo số phòng của môn này.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @Column(length = 255)
    private String location;

    @Column(length = 50)
    private String floor;

    /** Diện tích (m²). */
    @Column(precision = 10, scale = 2)
    private BigDecimal area;

    /** Sức chứa (người). */
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", length = 30)
    private FacilityCondition condition;

    @Enumerated(EnumType.STRING)
    @Column(name = "usage_status", length = 30)
    private RoomUsageStatus usageStatus;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "managing_staff_id")
    private Staff managingStaff;

    /** Đơn vị / tổ quản lý phòng, nhập tự do: "Tổ Vật lý", "Thư viện". */
    @Column(name = "managing_unit", length = 255)
    private String managingUnit;

    /** Kết cấu (Kiên cố / Bán kiên cố / Tạm / Nhờ, mượn, thuê) — 201. */
    @Enumerated(EnumType.STRING)
    @Column(name = "structure", length = 20)
    private FacilityStructure structure;
    /** Lịch mở cửa: thứ ISO (1 = Thứ 2 … 7 = Chủ nhật) cách dấu phẩy; trống = mọi ngày — 206. */
    @Column(name = "open_days", length = 20)
    private String openDays;

    /** Buổi mở cửa: SANG, CHIEU, TOI cách dấu phẩy; trống = mọi buổi — 206. */
    @Column(name = "open_sessions", length = 20)
    private String openSessions;


    /** Loại CSVC thứ hai mà phòng dùng kết hợp (phòng học kết hợp nghỉ trưa…) — 201. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "combined_type_id")
    private RoomType combinedType;

    /** Thông số riêng theo loại, khoá theo {@code RoomType.params} — 201. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "params", columnDefinition = "jsonb", nullable = false)
    private Map<String, String> params = new LinkedHashMap<>();

    public Campus getCampus() {
        return campus;
    }

    public void setCampus(Campus campus) {
        this.campus = campus;
    }

    public Building getBuilding() {
        return building;
    }

    public void setBuilding(Building building) {
        this.building = building;
    }

    public RoomType getRoomType() {
        return roomType;
    }

    public void setRoomType(RoomType roomType) {
        this.roomType = roomType;
    }

    public Subject getSubject() {
        return subject;
    }

    public void setSubject(Subject subject) {
        this.subject = subject;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public BigDecimal getArea() {
        return area;
    }

    public void setArea(BigDecimal area) {
        this.area = area;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public FacilityCondition getCondition() {
        return condition;
    }

    public void setCondition(FacilityCondition condition) {
        this.condition = condition;
    }

    public RoomUsageStatus getUsageStatus() {
        return usageStatus;
    }

    public void setUsageStatus(RoomUsageStatus usageStatus) {
        this.usageStatus = usageStatus;
    }

    public Staff getManagingStaff() {
        return managingStaff;
    }

    public void setManagingStaff(Staff managingStaff) {
        this.managingStaff = managingStaff;
    }

    public String getManagingUnit() {
        return managingUnit;
    }

    public void setManagingUnit(String managingUnit) {
        this.managingUnit = managingUnit;
    }

    public FacilityStructure getStructure() {
        return structure;
    }

    public void setStructure(FacilityStructure structure) {
        this.structure = structure;
    }

    public RoomType getCombinedType() {
        return combinedType;
    }

    public void setCombinedType(RoomType combinedType) {
        this.combinedType = combinedType;
    }

    public Map<String, String> getParams() {
        return params;
    }

    public void setParams(Map<String, String> params) {
        this.params = params;
    }

    public String getOpenDays() {
        return openDays;
    }

    public void setOpenDays(String openDays) {
        this.openDays = openDays;
    }

    public String getOpenSessions() {
        return openSessions;
    }

    public void setOpenSessions(String openSessions) {
        this.openSessions = openSessions;
    }
}
