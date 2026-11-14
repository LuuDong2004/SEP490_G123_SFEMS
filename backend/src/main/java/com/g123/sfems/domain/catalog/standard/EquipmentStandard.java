package com.g123.sfems.domain.catalog.standard;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Bộ tiêu chuẩn thiết bị theo cấp học — "Bộ tiêu chuẩn theo cấp học" của bản Jmix.
 *
 * <p>Một cấp học có nhiều đời văn bản; mỗi đời là một bộ, nối với bộ nó thay
 * thế qua {@link #previousStandard} để tra lịch sử thay vì ghi đè bản cũ.
 * Khoảng áp dụng tính theo NĂM HỌC (bắt đầu/kết thúc), để trống là không giới hạn.
 *
 * <p>Tham chiếu là khoá ngoại thật, không phải chuỗi mã như bản Jmix. Tất cả
 * {@code EAGER} vì DTO được ánh xạ sau khi transaction đóng
 * ({@code open-in-view=false}).
 */
@Entity
@Table(name = "equipment_standards")
public class EquipmentStandard extends CatalogEntity {

    /** Cấp học áp dụng; để trống = mọi cấp. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "start_school_year_id")
    private SchoolYear startSchoolYear;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "end_school_year_id")
    private SchoolYear endSchoolYear;

    /** Phiên bản, ví dụ "2021" hay "2024 - sửa đổi". */
    @Column(name = "standard_version", length = 50)
    private String standardVersion;

    /**
     * Bộ mà bộ này thay thế. EAGER kéo theo cả chuỗi phiên bản, nhưng chuỗi đó
     * chỉ vài đời văn bản — đổi lại không phải lo LazyInitialization.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "previous_standard_id")
    private EquipmentStandard previousStandard;

    /** Nháp / đang áp dụng / hết hiệu lực — xem {@link StandardStatus}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private StandardStatus status = StandardStatus.DRAFT;

    /** Văn bản căn cứ: ban hành, sửa đổi, hướng dẫn... */
    @OneToMany(mappedBy = "standard", cascade = CascadeType.ALL, orphanRemoval = true,
            fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 100)
    private Set<EquipmentStandardDocument> documents = new LinkedHashSet<>();

    public StandardStatus getStatus() {
        return status;
    }

    /** Đổi trạng thái và giữ cờ {@code active} của danh mục đúng bằng "đang áp dụng". */
    public void setStatus(StandardStatus status) {
        this.status = status;
        setActive(status == StandardStatus.ACTIVE);
    }

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public SchoolYear getStartSchoolYear() {
        return startSchoolYear;
    }

    public void setStartSchoolYear(SchoolYear startSchoolYear) {
        this.startSchoolYear = startSchoolYear;
    }

    public SchoolYear getEndSchoolYear() {
        return endSchoolYear;
    }

    public void setEndSchoolYear(SchoolYear endSchoolYear) {
        this.endSchoolYear = endSchoolYear;
    }

    public String getStandardVersion() {
        return standardVersion;
    }

    public void setStandardVersion(String standardVersion) {
        this.standardVersion = standardVersion;
    }

    public EquipmentStandard getPreviousStandard() {
        return previousStandard;
    }

    public void setPreviousStandard(EquipmentStandard previousStandard) {
        this.previousStandard = previousStandard;
    }

    public Set<EquipmentStandardDocument> getDocuments() {
        return documents;
    }
}
