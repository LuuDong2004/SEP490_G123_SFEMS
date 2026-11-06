package com.g123.sfems.domain.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Danh mục thiết bị (DM-02) — "nhóm thiết bị": mỗi thiết bị của trường thuộc về MỘT nút của cây này.
 * Đề xuất mua sắm, dòng phiếu nhập, định mức đều trỏ vào đây.
 *
 * <p>Cha–con qua {@link #parent}; service chặn vòng (một nhóm không nằm dưới chính nó hay con cháu).
 *
 * <p>{@link #ownerSchool} trống là danh mục của Sở, mọi trường dùng. Có giá trị là nhóm NGOÀI danh mục
 * của riêng trường ấy (tự làm, tài trợ, mua ngoài danh mục), do trường tự thêm lúc ghi tăng — khi đó
 * {@link #origin} bắt buộc (CHECK ở database). Trường khác không thấy nó.
 *
 * <p>Các tính chất của MẶT HÀNG (loại tài sản, vật lý / phần mềm, cách quản lý, đơn vị tính, tuổi thọ)
 * khai ở đây một lần rồi chép xuống từng tài sản: hai cái cùng nhóm không thể hạch toán khác nhau.
 */
@Entity
@Table(name = "equipment_catalogs")
public class EquipmentCatalog extends CatalogEntity {

    /** Ký hiệu loại thiết bị chuẩn (3 chữ in hoa) — thành phần của mã thiết bị dạy học khi cần. */
    @Column(name = "teaching_code", length = 3)
    private String teachingCode;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "parent_id")
    private EquipmentCatalog parent;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "equipment_type_id")
    private EquipmentType equipmentType;

    /** Môn học chính — quyết định thành phần MH của mã tài sản và mọi phép cộng theo môn. */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "grade_id")
    private Grade grade;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(length = 255)
    private String model;

    @Column(length = 255)
    private String manufacturer;

    @Enumerated(EnumType.STRING)
    @Column(name = "tracking_type", nullable = false, length = 20)
    private TrackingType trackingType = TrackingType.SERIAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_category", length = 30)
    private AssetCategory assetCategory;

    @Enumerated(EnumType.STRING)
    @Column(name = "physical_or_digital", length = 30)
    private PhysicalDigitalType physicalOrDigital;

    @Column(name = "useful_life_years")
    private Integer usefulLifeYears;

    /** Thuộc danh mục thiết bị tối thiểu (theo thông tư) hay ngoài danh mục. */
    @Column(name = "minimum_required", nullable = false)
    private Boolean minimumRequired = Boolean.FALSE;

    /** Mã trong danh mục do cấp chủ quản ban hành, tách khỏi {@code code} nội bộ. */
    @Column(name = "statistical_code", length = 64)
    private String statisticalCode;

    /** Căn cứ pháp lý — "Thông tư 39/2021/TT-BGDĐT"… */
    @Column(name = "legal_basis", length = 255)
    private String legalBasis;

    /** Mô tả / yêu cầu kỹ thuật — với thiết bị tối thiểu là cột "Mô tả chi tiết" của phụ lục. */
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "used_by_teacher", nullable = false)
    private Boolean usedByTeacher = Boolean.FALSE;

    @Column(name = "used_by_student", nullable = false)
    private Boolean usedByStudent = Boolean.FALSE;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "owner_school_id")
    private School ownerSchool;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin", length = 30)
    private CatalogOrigin origin;

    public String getTeachingCode() {
        return teachingCode;
    }

    public void setTeachingCode(String teachingCode) {
        this.teachingCode = teachingCode;
    }

    public EquipmentCatalog getParent() {
        return parent;
    }

    public void setParent(EquipmentCatalog parent) {
        this.parent = parent;
    }

    public EquipmentType getEquipmentType() {
        return equipmentType;
    }

    public void setEquipmentType(EquipmentType equipmentType) {
        this.equipmentType = equipmentType;
    }

    public Subject getSubject() {
        return subject;
    }

    public void setSubject(Subject subject) {
        this.subject = subject;
    }

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public Grade getGrade() {
        return grade;
    }

    public void setGrade(Grade grade) {
        this.grade = grade;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public TrackingType getTrackingType() {
        return trackingType;
    }

    public void setTrackingType(TrackingType trackingType) {
        this.trackingType = trackingType == null ? TrackingType.SERIAL : trackingType;
    }

    public AssetCategory getAssetCategory() {
        return assetCategory;
    }

    public void setAssetCategory(AssetCategory assetCategory) {
        this.assetCategory = assetCategory;
    }

    public PhysicalDigitalType getPhysicalOrDigital() {
        return physicalOrDigital;
    }

    public void setPhysicalOrDigital(PhysicalDigitalType physicalOrDigital) {
        this.physicalOrDigital = physicalOrDigital;
    }

    public Integer getUsefulLifeYears() {
        return usefulLifeYears;
    }

    public void setUsefulLifeYears(Integer usefulLifeYears) {
        this.usefulLifeYears = usefulLifeYears;
    }

    public Boolean getMinimumRequired() {
        return minimumRequired;
    }

    public void setMinimumRequired(Boolean minimumRequired) {
        this.minimumRequired = Boolean.TRUE.equals(minimumRequired);
    }

    public String getStatisticalCode() {
        return statisticalCode;
    }

    public void setStatisticalCode(String statisticalCode) {
        this.statisticalCode = statisticalCode;
    }

    public String getLegalBasis() {
        return legalBasis;
    }

    public void setLegalBasis(String legalBasis) {
        this.legalBasis = legalBasis;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getUsedByTeacher() {
        return usedByTeacher;
    }

    public void setUsedByTeacher(Boolean usedByTeacher) {
        this.usedByTeacher = Boolean.TRUE.equals(usedByTeacher);
    }

    public Boolean getUsedByStudent() {
        return usedByStudent;
    }

    public void setUsedByStudent(Boolean usedByStudent) {
        this.usedByStudent = Boolean.TRUE.equals(usedByStudent);
    }

    public School getOwnerSchool() {
        return ownerSchool;
    }

    public void setOwnerSchool(School ownerSchool) {
        this.ownerSchool = ownerSchool;
    }

    public CatalogOrigin getOrigin() {
        return origin;
    }

    public void setOrigin(CatalogOrigin origin) {
        this.origin = origin;
    }
}
