package com.g123.sfems.domain.catalog.equipmentcatalog;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.organization.School;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OrderBy;
import java.util.LinkedHashSet;
import java.util.Set;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Nhóm thiết bị — "Nhóm thiết bị" (EquipmentCatalog) của bản Jmix: cây phân cấp
 * mà mỗi thiết bị của trường sẽ thuộc về một nút.
 *
 * <p>Cha–con qua {@link #parent}; service chặn vòng lặp (một nhóm không thể
 * nằm dưới chính nó hay dưới con cháu của nó).
 *
 * <p>{@link #ownerSchool} để trống là danh mục của Sở, mọi trường dùng. Có giá trị là thiết bị
 * NGOÀI danh mục của riêng trường ấy (tự làm, tài trợ, mua ngoài danh mục), do trường tự thêm lúc
 * ghi tăng — khi đó {@link #origin} bắt buộc. Trường khác không thấy nó.
 */
@Entity
@Table(name = "equipment_catalogs")
public class EquipmentCatalog extends CatalogEntity {

    /** Nhóm 4 của mã thiết bị dạy học: ký hiệu loại thiết bị chuẩn, 3 chữ in hoa. */
    @Column(name = "teaching_code", length = 3)
    private String teachingCode;

    /**
     * Nhóm cha. EAGER kéo theo cả chuỗi tổ tiên, nhưng cây chỉ vài tầng — đổi
     * lại DTO đọc được nhóm cha sau khi transaction đóng.
     */
    // Nạp bằng SELECT riêng thay vì JOIN: nhóm thiết bị tự trỏ vào cha, và cùng
    // với năm liên kết EAGER bên dưới, Hibernate dựng một câu JOIN lồng nhiều
    // tầng cho mỗi lần chạm tới danh mục. Đo được 53 giây cho 12 tài sản trên
    // màn Thiết bị. Mỗi liên kết một SELECT nhỏ thì tổng chi phí tuyến tính.
    //
    // LAZY: EAGER thì nạp một nhóm là nạp cả chuỗi cha của nó, cho MỌI tài sản của mọi dòng phiếu. Chỉ
    // phản hồi của /api/equipment_catalogs (một tầng) và phép kiểm vòng (trong giao dịch) đọc nó —
    // EquipmentCatalogService.loadForResponse nạp tầng đó.
    @ManyToOne(fetch = FetchType.LAZY)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "parent_id")
    private EquipmentCatalog parent;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "equipment_type_id")
    private EquipmentType equipmentType;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    /**
     * Các môn THÊM ngoài môn chính ({@link #subject}) — thiết bị dùng cho nhiều môn (108). Môn chính vẫn
     * là thứ quyết định mã dạy học trong mã tài sản và mọi phép cộng theo môn; tập này chỉ để tra cứu
     * và hiển thị. {@code SUBSELECT}: một trang danh sách tốn thêm đúng một câu truy vấn, không phải N.
     */
    // LAZY (cả ba bảng nối): chỉ phản hồi danh mục / hồ sơ tài sản và vài phép kiểm trong giao dịch đọc.
    // SUBSELECT nên chạm một tập là nạp tập đó cho mọi nhóm của cùng câu truy vấn.
    @ManyToMany(fetch = FetchType.LAZY)
    @Fetch(FetchMode.SUBSELECT)
    @JoinTable(name = "equipment_catalog_subjects",
            joinColumns = @JoinColumn(name = "catalog_id"),
            inverseJoinColumns = @JoinColumn(name = "subject_id"))
    @OrderBy("sortOrder ASC, id ASC")
    private Set<Subject> extraSubjects = new LinkedHashSet<>();

    public Set<Subject> getExtraSubjects() {
        return extraSubjects;
    }

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    /** Các cấp học THÊM ngoài cấp chính ({@link #educationLevel}) — thiết bị dùng cho nhiều cấp (114). */
    // LAZY (cả ba bảng nối): chỉ phản hồi danh mục / hồ sơ tài sản và vài phép kiểm trong giao dịch đọc.
    // SUBSELECT nên chạm một tập là nạp tập đó cho mọi nhóm của cùng câu truy vấn.
    @ManyToMany(fetch = FetchType.LAZY)
    @Fetch(FetchMode.SUBSELECT)
    @JoinTable(name = "equipment_catalog_levels",
            joinColumns = @JoinColumn(name = "catalog_id"),
            inverseJoinColumns = @JoinColumn(name = "education_level_id"))
    @OrderBy("sortOrder ASC, id ASC")
    private Set<EducationLevel> extraLevels = new LinkedHashSet<>();

    public Set<EducationLevel> getExtraLevels() {
        return extraLevels;
    }

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "grade_id")
    private Grade grade;

    /** Các khối lớp THÊM ngoài khối chính ({@link #grade}) — thiết bị dùng cho nhiều khối (114). */
    // LAZY (cả ba bảng nối): chỉ phản hồi danh mục / hồ sơ tài sản và vài phép kiểm trong giao dịch đọc.
    // SUBSELECT nên chạm một tập là nạp tập đó cho mọi nhóm của cùng câu truy vấn.
    @ManyToMany(fetch = FetchType.LAZY)
    @Fetch(FetchMode.SUBSELECT)
    @JoinTable(name = "equipment_catalog_grades",
            joinColumns = @JoinColumn(name = "catalog_id"),
            inverseJoinColumns = @JoinColumn(name = "grade_id"))
    @OrderBy("sortOrder ASC, id ASC")
    private Set<Grade> extraGrades = new LinkedHashSet<>();

    public Set<Grade> getExtraGrades() {
        return extraGrades;
    }

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

    /**
     * Loại tài sản để hạch toán (TSCĐ / CCDC / vật tư / hoá chất).
     *
     * <p>Ở đây chứ không phải chỉ trên từng tài sản: "ống nghiệm là vật tư" là
     * tính chất của MẶT HÀNG, không phải của riêng cái ống nghiệm phòng 5. Khai
     * lại cho từng tài sản là mời hai cái cùng nhóm hạch toán khác nhau — và
     * người nhập không có cách nào biết cái trước đã chọn gì.
     *
     * <p>Để trống nghĩa là nhóm chưa khai; form thiết bị khi đó không điền hộ,
     * người nhập tự chọn như trước.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "asset_category", length = 30)
    private AssetCategory assetCategory;

    /**
     * Vật lý / phần mềm / hỗ trợ học tập — nhóm LT của mã tài sản (TB/PM/HL).
     *
     * <p>Cùng lý do: một nhóm thiết bị không lúc là phần mềm lúc là máy móc.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "physical_or_digital", length = 30)
    private PhysicalDigitalType physicalOrDigital;

    @Enumerated(EnumType.STRING)
    @Column(name = "depreciation_method", length = 30)
    private DepreciationMethod depreciationMethod;

    @Column(name = "useful_life_years")
    private Integer usefulLifeYears;

    /** Thuộc danh mục thiết bị tối thiểu (theo thông tư) hay ngoài danh mục. */
    @Column(name = "minimum_required", nullable = false)
    private Boolean minimumRequired = Boolean.FALSE;

    /**
     * Mã trong danh mục do cấp chủ quản ban hành, tách khỏi {@code code} là mã
     * trường tự đặt: đổi mã nội bộ không được làm mất đường ghép số liệu gửi
     * lên với danh mục gốc.
     */
    @Column(name = "statistical_code", length = 64)
    private String statisticalCode;

    /** Căn cứ pháp lý của định mức — "Thông tư 38/2011/TT-BGDĐT"… */
    @Column(name = "legal_basis", length = 255)
    private String legalBasis;

    /** Mô tả / yêu cầu kỹ thuật — với thiết bị tối thiểu là cột "Mô tả chi tiết" của phụ lục. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** Đối tượng sử dụng; hai cờ vì rất nhiều thiết bị dùng cho cả hai. */
    @Column(name = "used_by_teacher", nullable = false)
    private Boolean usedByTeacher = Boolean.FALSE;

    @Column(name = "used_by_student", nullable = false)
    private Boolean usedByStudent = Boolean.FALSE;

    /**
     * Trường sở hữu thiết bị ngoài danh mục; {@code null} là danh mục của Sở. SELECT riêng như
     * các liên kết khác — danh sách trả kèm tên trường.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "owner_school_id")
    private School ownerSchool;

    /** Nguồn gốc — bắt buộc khi {@link #ownerSchool} có giá trị (CHECK ở database). */
    @Enumerated(EnumType.STRING)
    @Column(name = "origin", length = 30)
    private CatalogOrigin origin;

    /** Giáo viên tự chế tạo — có báo cáo riêng, không nằm trong danh mục mua sắm. */
    @Column(name = "self_made", nullable = false)
    private Boolean selfMade = Boolean.FALSE;

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

    public DepreciationMethod getDepreciationMethod() {
        return depreciationMethod;
    }

    public void setDepreciationMethod(DepreciationMethod depreciationMethod) {
        this.depreciationMethod = depreciationMethod;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLegalBasis() {
        return legalBasis;
    }

    public void setLegalBasis(String legalBasis) {
        this.legalBasis = legalBasis;
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

    public Boolean getSelfMade() {
        return selfMade;
    }

    public void setSelfMade(Boolean selfMade) {
        this.selfMade = Boolean.TRUE.equals(selfMade);
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
