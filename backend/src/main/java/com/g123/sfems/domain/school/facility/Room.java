package com.g123.sfems.domain.school.facility;

import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
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
 * Phòng (TC-02) — phòng học, phòng bộ môn, phòng chức năng, kho. Là NƠI ĐẶT của thiết bị: hồ sơ thiết
 * bị, dòng phiếu nhập và phiếu kiểm kê đều trỏ về đây.
 *
 * <p>Không có cơ sở / khối nhà riêng: phạm vi đồ án chỉ quản lý tới phòng, nên khối nhà và tầng là hai
 * cột chữ ({@link #building}, {@link #floor}) để ghi vị trí, không phải bảng.
 *
 * <p>Mã phòng duy nhất TRONG trường ({@code uq_rooms_school_code}); hai trường cùng có "P101" là
 * bình thường.
 */
@RowLevelResource("rooms")
@Entity
@Table(name = "rooms")
public class Room extends SchoolOwnedEntity {

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    /**
     * Phòng bộ môn / thí nghiệm / máy tính là của môn nào. Trống với phòng học thường, kho, thư viện.
     * Định mức "tính cho 01 phòng học bộ môn" nhân theo số phòng của môn này.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    /** Khối nhà / dãy: "Dãy A", "Nhà B". */
    @Column(length = 100)
    private String building;

    @Column(length = 50)
    private String floor;

    @Column(length = 255)
    private String location;

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

    /** Đơn vị / tổ quản lý phòng, nhập tự do: "Tổ Vật lí", "Thư viện". */
    @Column(name = "managing_unit", length = 255)
    private String managingUnit;

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

    public String getBuilding() {
        return building;
    }

    public void setBuilding(String building) {
        this.building = building;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
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

    public String getManagingUnit() {
        return managingUnit;
    }

    public void setManagingUnit(String managingUnit) {
        this.managingUnit = managingUnit;
    }
}
