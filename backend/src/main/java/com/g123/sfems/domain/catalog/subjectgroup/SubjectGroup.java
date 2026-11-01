package com.g123.sfems.domain.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.Formula;

/** Tổ chuyên môn (DM-01): Tổ Toán – Tin, Tổ Khoa học tự nhiên… thuộc một cấp học. */
@Entity
@Table(name = "subject_groups")
public class SubjectGroup extends CatalogEntity {

    /** EAGER vì open-in-view tắt: response luôn trả kèm cấp học. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    /**
     * Số môn học thuộc tổ — đếm ngay trong câu truy vấn, không lưu thành cột nên không bao giờ lệch
     * với bảng môn học. Chỉ đọc.
     */
    @Formula("(SELECT count(*) FROM subjects s WHERE s.subject_group_id = id)")
    private Long subjectCount;

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public Long getSubjectCount() {
        return subjectCount;
    }
}
