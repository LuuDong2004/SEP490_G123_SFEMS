package com.g123.sfems.domain.school.facility;

import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Cơ sở (điểm trường) — tầng trên cùng của cơ sở vật chất: Cơ sở → Khối nhà → Phòng.
 * Mỗi trường có tối đa một cơ sở chính; service tự bỏ cờ của cơ sở chính cũ.
 */
@RowLevelResource("campuses")
@Entity
@Table(name = "campuses")
public class Campus extends SchoolOwnedEntity {

    @Column(name = "is_primary", nullable = false)
    private Boolean primaryCampus = Boolean.FALSE;

    @Column(length = 30)
    private String phone;

    @Column(length = 500)
    private String address;

    /** Cơ sở không phải trường chính: phân hiệu (true) hay điểm trường (false) — 201. */
    @Column(name = "branch", nullable = false)
    private boolean branch;

    public Boolean getPrimaryCampus() {
        return primaryCampus;
    }

    public void setPrimaryCampus(Boolean primaryCampus) {
        this.primaryCampus = Boolean.TRUE.equals(primaryCampus);
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public boolean isBranch() {
        return branch;
    }

    public void setBranch(boolean branch) {
        this.branch = branch;
    }
}
