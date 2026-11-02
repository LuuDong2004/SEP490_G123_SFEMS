package com.g123.sfems.domain.catalog.grade;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Khối lớp (DM-01): Lớp 10, 11, 12 của cấp THPT. Định mức thiết bị (DM-03) tính theo khối lớp. */
@Entity
@Table(name = "grades")
public class Grade extends CatalogEntity {

    /** EAGER vì open-in-view tắt: response luôn trả kèm cấp học, đọc sau khi giao dịch đóng thì lỗi. */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "education_level_id", nullable = false)
    private EducationLevel educationLevel;

    /** Số của khối (10, 11, 12) để sắp xếp và so định mức; tên khối thì để người dùng tự đặt. */
    @Column(name = "grade_number")
    private Integer gradeNumber;

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public Integer getGradeNumber() {
        return gradeNumber;
    }

    public void setGradeNumber(Integer gradeNumber) {
        this.gradeNumber = gradeNumber;
    }
}
