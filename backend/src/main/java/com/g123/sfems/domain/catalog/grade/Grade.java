package com.g123.sfems.domain.catalog.grade;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Khối lớp — Lớp 1 tới Lớp 12. Mỗi khối thuộc một cấp học.
 *
 * <p>Năm trường chung ở {@link CatalogEntity}; lớp này thêm hai trường riêng.
 */
@Entity
@Table(name = "grades")
public class Grade extends CatalogEntity {

    /** Mã khối theo chương trình dạy học (ví dụ 6), khác với mã danh mục. */
    @Column(name = "teaching_code", length = 32)
    private String teachingCode;

    /**
     * Cấp học. KHOÁ NGOẠI thật tới danh mục, không phải chuỗi mã như bản Jmix
     * (ở đó cột này là chuỗi tự do). Cho phép rỗng.
     *
     * <p>{@code EAGER}: DTO được ánh xạ trong controller, sau khi transaction
     * đã đóng ({@code open-in-view=false}), nên {@code LAZY} ở đây là
     * {@code LazyInitializationException} ngay lần gọi đầu.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    public String getTeachingCode() {
        return teachingCode;
    }

    public void setTeachingCode(String teachingCode) {
        this.teachingCode = teachingCode;
    }

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }
}
