package com.g123.sfems.domain.school.facility;

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

/** Khối nhà — tầng giữa Cơ sở và Phòng. Cơ sở để trống được (trường chưa tách cơ sở). */
@RowLevelResource("buildings")
@Entity
@Table(name = "buildings")
public class Building extends SchoolOwnedEntity {

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "campus_id")
    private Campus campus;

    @Column(name = "floor_count")
    private Integer floorCount;

    @Column(name = "built_year")
    private Integer builtYear;

    /** Tổng diện tích sàn (m²). */
    @Column(name = "floor_area", precision = 12, scale = 2)
    private BigDecimal floorArea;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", length = 30)
    private FacilityCondition condition;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "managing_staff_id")
    private Staff managingStaff;

    /** Kết cấu (Kiên cố / Bán kiên cố / Tạm / Nhờ, mượn, thuê) — 201. */
    @Enumerated(EnumType.STRING)
    @Column(name = "structure", length = 20)
    private FacilityStructure structure;

    public Campus getCampus() {
        return campus;
    }

    public void setCampus(Campus campus) {
        this.campus = campus;
    }

    public Integer getFloorCount() {
        return floorCount;
    }

    public void setFloorCount(Integer floorCount) {
        this.floorCount = floorCount;
    }

    public Integer getBuiltYear() {
        return builtYear;
    }

    public void setBuiltYear(Integer builtYear) {
        this.builtYear = builtYear;
    }

    public BigDecimal getFloorArea() {
        return floorArea;
    }

    public void setFloorArea(BigDecimal floorArea) {
        this.floorArea = floorArea;
    }

    public FacilityCondition getCondition() {
        return condition;
    }

    public void setCondition(FacilityCondition condition) {
        this.condition = condition;
    }

    public Staff getManagingStaff() {
        return managingStaff;
    }

    public void setManagingStaff(Staff managingStaff) {
        this.managingStaff = managingStaff;
    }

    public FacilityStructure getStructure() {
        return structure;
    }

    public void setStructure(FacilityStructure structure) {
        this.structure = structure;
    }
}
