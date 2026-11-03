package com.g123.sfems.domain.catalog.standard;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Danh mục thiết bị tối thiểu (DM-03) — một văn bản của Bộ (Thông tư 39/2021/TT-BGDĐT với THPT) áp
 * dụng cho một cấp học trong một khoảng năm học. Các dòng định mức là {@link EquipmentNorm}.
 *
 * <p>Mỗi cấp học tại một thời điểm chỉ nên có MỘT bộ {@code ACTIVE}; service giữ luật đó khi đổi trạng
 * thái. {@code active} của lớp nền đi theo {@link #status}.
 */
@Entity
@Table(name = "equipment_standards")
public class EquipmentStandard extends CatalogEntity {

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "start_school_year_id")
    private SchoolYear startSchoolYear;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "end_school_year_id")
    private SchoolYear endSchoolYear;

    /** Số hiệu văn bản: "39/2021/TT-BGDĐT". */
    @Column(name = "standard_version", length = 50)
    private String standardVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StandardStatus status = StandardStatus.DRAFT;

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

    public StandardStatus getStatus() {
        return status;
    }

    public void setStatus(StandardStatus status) {
        this.status = status == null ? StandardStatus.DRAFT : status;
        setActive(this.status == StandardStatus.ACTIVE);
    }
}
