package com.g123.sfems.domain.catalog.subject;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Môn học (DM-01): Toán, Vật lí, Hoá học… theo chương trình THPT 2018. */
@Entity
@Table(name = "subjects")
public class Subject extends CatalogEntity {

    /**
     * Mã môn ngắn — thành phần MH trong mã tài sản TT.TR.MH.LT.ST.NC (DR-08). Không trùng giữa các
     * môn (unique index không phân biệt hoa thường). Để trống thì thiết bị của môn này chưa cấp được
     * mã chuẩn (DR-09).
     */
    @Column(name = "short_code", length = 10)
    private String shortCode;

    /**
     * Mã dạy học 2 chữ số — thành phần MH của mã tài sản (DR-09, theo repo mẫu). Để trống thì thiết bị của
     * môn này chưa cấp được mã chuẩn (DR-10). Khác với {@link #shortCode} (mã chữ, dùng cho tên gọi).
     */
    @Column(name = "teaching_code", length = 2)
    private String teachingCode;

    /** Cấp học giảng dạy môn này. EAGER vì open-in-view tắt. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    /** Tổ chuyên môn phụ trách môn; để trống được (môn chưa xếp tổ). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_group_id")
    private SubjectGroup subjectGroup;

    public String getShortCode() {
        return shortCode;
    }

    public void setShortCode(String shortCode) {
        this.shortCode = shortCode;
    }

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

    public SubjectGroup getSubjectGroup() {
        return subjectGroup;
    }

    public void setSubjectGroup(SubjectGroup subjectGroup) {
        this.subjectGroup = subjectGroup;
    }
}
