package com.g123.sfems.domain.school.coderule;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.organization.School;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Cách MỘT trường đặt mã cho một loại dữ liệu nó tự lập (phòng, khối nhà, cơ sở, cán bộ): ký hiệu
 * đầu, độ dài phần số, số bắt đầu. Không giữ bộ đếm — số kế tiếp đọc từ dữ liệu đang có
 * (xem {@code SchoolCodeService}).
 */
@Entity
@Table(name = "school_code_rules")
public class SchoolCodeRule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(nullable = false, length = 64)
    private String target;

    @Column(length = 20)
    private String prefix;

    @Column(name = "number_length", nullable = false)
    private Integer numberLength = 2;

    @Column(name = "start_number", nullable = false)
    private Integer startNumber = 1;

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getPrefix() {
        return prefix;
    }

    public void setPrefix(String prefix) {
        this.prefix = prefix;
    }

    public Integer getNumberLength() {
        return numberLength;
    }

    public void setNumberLength(Integer numberLength) {
        this.numberLength = numberLength;
    }

    public Integer getStartNumber() {
        return startNumber;
    }

    public void setStartNumber(Integer startNumber) {
        this.startNumber = startNumber;
    }
}
