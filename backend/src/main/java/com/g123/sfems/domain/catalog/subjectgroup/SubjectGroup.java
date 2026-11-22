package com.g123.sfems.domain.catalog.subjectgroup;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.subject.Subject;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Tổ chuyên môn — "Tổ Khoa học tự nhiên", "Tổ Khối lớp 1"... thuộc một cấp học
 * và gồm một số môn học.
 */
@Entity
@Table(name = "subject_groups")
public class SubjectGroup extends CatalogEntity {

    /** Cấp học. Khoá ngoại thật (bản Jmix là chuỗi mã). Cho phép rỗng. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    /**
     * Các môn học thuộc tổ. Nhiều-nhiều: một môn có thể thuộc nhiều tổ (Tin học
     * ở tổ Tin học cấp THCS lẫn tổ Khoa học tự nhiên cấp THPT).
     *
     * <p>{@code Set} chứ không {@code List}, vì môn học lại nạp danh sách cấp
     * học của nó EAGER — hai "bag" lồng nhau là {@code MultipleBagFetchException}
     * lúc khởi động. Xem {@code Subject.educationLevels}.
     *
     * <p>Không cascade: tổ không sở hữu môn học. Xoá tổ chỉ xoá dòng liên kết;
     * xoá một môn còn nằm trong tổ bị khoá ngoại {@code RESTRICT} của bảng liên
     * kết từ chối thành 409.
     */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "subject_group_subjects",
            joinColumns = @JoinColumn(name = "subject_group_id"),
            inverseJoinColumns = @JoinColumn(name = "subject_id"))
    @OrderBy("sortOrder ASC, name ASC")
    @BatchSize(size = 100)
    private Set<Subject> subjects = new LinkedHashSet<>();

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    /** Tập sống — sửa trực tiếp, không gán tập mới. */
    public Set<Subject> getSubjects() {
        return subjects;
    }
}
