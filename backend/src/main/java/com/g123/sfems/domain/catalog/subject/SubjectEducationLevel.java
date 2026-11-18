package com.g123.sfems.domain.catalog.subject;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Một môn học được dạy ở một cấp học, và ở cấp đó nó là bắt buộc hay tự chọn.
 *
 * <p>Là dòng con của {@link Subject}, không phải resource riêng: nó không có
 * màn hình, không có endpoint, và chỉ được tạo/xoá qua môn học cha. Một môn
 * chỉ xuất hiện MỘT lần ở mỗi cấp — database giữ điều đó bằng unique
 * {@code (subject_id, education_level_id)}.
 */
@Entity
@Table(name = "subject_education_levels")
public class SubjectEducationLevel extends BaseEntity {

    /**
     * Môn học cha. {@code LAZY} được, khác với các tham chiếu khác: không DTO nào
     * đọc ngược từ dòng con lên cha, và đọc cha lúc nạp con chỉ tạo vòng lặp.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    /** {@code EAGER}: DTO đọc nó sau khi transaction đã đóng. */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "education_level_id", nullable = false)
    private EducationLevel educationLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false, length = 32)
    private SubjectType subjectType = SubjectType.BAT_BUOC;

    @Column(name = "sort_order")
    private Integer sortOrder;

    protected SubjectEducationLevel() {
        // JPA
    }

    public SubjectEducationLevel(Subject subject, EducationLevel educationLevel) {
        this.subject = subject;
        this.educationLevel = educationLevel;
    }

    public Subject getSubject() {
        return subject;
    }

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public SubjectType getSubjectType() {
        return subjectType;
    }

    public void setSubjectType(SubjectType subjectType) {
        this.subjectType = subjectType == null ? SubjectType.BAT_BUOC : subjectType;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
