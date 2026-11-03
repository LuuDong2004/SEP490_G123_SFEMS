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
 * Cách MỘT trường đặt mã cho dữ liệu nó tự lập — phòng, và phần số thứ tự (ST) của mã tài sản (TS-05):
 * ký hiệu đầu, độ dài phần số, số bắt đầu. Không giữ bộ đếm — số kế tiếp đọc từ dữ liệu đang có.
 *
 * <p>Mỗi trường mỗi {@link #target} một dòng ({@code uq_school_code_rules}). Quy tắc chung toàn ngành
 * nằm ở {@code code_rules} (DM-04); dòng ở đây là phần trường được tự quyết.
 */
@Entity
@Table(name = "school_code_rules")
public class SchoolCodeRule extends BaseEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    /** Loại dữ liệu áp dụng: {@code rooms}, {@code equipment}. */
    @Column(nullable = false, length = 64)
    private String target;

    @Column(length = 20)
    private String prefix;

    @Column(name = "number_length", nullable = false)
    private Integer numberLength = 3;

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
        this.numberLength = numberLength == null ? 3 : numberLength;
    }

    public Integer getStartNumber() {
        return startNumber;
    }

    public void setStartNumber(Integer startNumber) {
        this.startNumber = startNumber == null ? 1 : startNumber;
    }
}
