package com.g123.sfems.domain.catalog.standard;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmenttype.EquipmentType;
import com.g123.sfems.domain.catalog.grade.Grade;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.unit.Unit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Một dòng của Danh mục thiết bị dạy học tối thiểu — đúng một dòng phụ lục của thông tư: thiết bị
 * nào, cho môn nào, chủ đề nào, dùng cho GV hay HS, bao nhiêu (theo lớp / trường / nhóm học sinh /
 * giáo viên / phòng bộ môn), lớp nào.
 *
 * <p>Gắn với MỘT thiết bị trong Danh mục thiết bị ({@link #catalog}) — đó là thứ phần đủ / thiếu
 * đếm. Loại thiết bị chỉ còn là nhãn phân loại (095). Số lượng giữ cả nguyên văn
 * ({@link #quantityText}) lẫn phần đã hiểu ({@link #minQuantity}, {@link #normBasis},
 * {@link #basisSize}); {@code minQuantity} trống là phụ lục không ghi số — không tính tự động.
 *
 * <p>Môn học, loại phòng để trống nghĩa là không ràng buộc theo chiều đó; {@link #gradeLevels}
 * trống là mọi lớp của cấp học.
 */
@Entity
@Table(name = "equipment_norms")
public class EquipmentNorm extends CatalogEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "standard_id", nullable = false)
    private EquipmentStandard standard;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "catalog_id")
    private EquipmentCatalog catalog;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "equipment_type_id")
    private EquipmentType equipmentType;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "grade_id")
    private Grade grade;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    @Column(name = "min_quantity", precision = 14, scale = 3)
    private BigDecimal minQuantity;

    /** Mẫu số của căn cứ: 6 trong "01/6HS", 5 trong "01 bộ/5 lớp". Trống là 1. */
    @Column(name = "basis_size")
    private Integer basisSize;

    /** Cột "Số lượng" nguyên văn của phụ lục. */
    @Column(name = "quantity_text", length = 100)
    private String quantityText;

    /** Cột "Đơn vị" nguyên văn, khi không khớp danh mục đơn vị tính. */
    @Column(name = "unit_text", length = 50)
    private String unitText;

    /** "6,7" — các lớp áp dụng; trống là mọi lớp của cấp học. */
    @Column(name = "grade_levels", length = 40)
    private String gradeLevels;

    /** Số thứ tự trong phụ lục ("1.2"). */
    @Column(name = "item_no", length = 20)
    private String itemNo;

    /** Nhóm trong phụ lục: "Thiết bị dùng chung › Tranh ảnh". */
    @Column(name = "section_name", length = 500)
    private String sectionName;

    /** Chủ đề / mạch nội dung dạy học. */
    @Column(length = 500)
    private String topic;

    @Column(columnDefinition = "TEXT")
    private String purpose;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "for_teacher", nullable = false)
    private boolean forTeacher;

    @Column(name = "for_student", nullable = false)
    private boolean forStudent;

    /**
     * Dòng của nhóm tự chọn (ngoại ngữ lựa chọn 2, 3; Công nghệ THPT theo định hướng; dụng cụ môn thể
     * thao tự chọn) — trường chọn phương án nào thì trang bị phương án đó, nên không vào đủ / thiếu.
     */
    @Column(nullable = false)
    private boolean optional;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "norm_basis", nullable = false, length = 20)
    private NormBasis normBasis = NormBasis.PER_SCHOOL;

    /** Văn bản (trong bộ tiêu chuẩn) quy định dòng này. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "source_document_id")
    private EquipmentStandardDocument sourceDocument;

    /** Ngày dòng bắt đầu áp dụng (changelog 267). */
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    /** Ngày dòng thôi áp dụng — không tính ngày này; {@code null} = còn áp dụng. */
    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    /** Dòng mà dòng này thay (sửa = đóng dòng cũ, mở dòng mới cùng mã). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replaces_norm_id")
    private EquipmentNorm replaces;

    /** Văn bản căn cứ của lần bỏ / thay dòng này. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "end_document_id")
    private EquipmentStandardDocument endDocument;

    /** Điều chỉnh của dòng (changelog 276) — Sở khai tay; {@link AdjustKind#NONE} là không được phép. */
    @Enumerated(EnumType.STRING)
    @Column(name = "adjust_kind", nullable = false, length = 20)
    private AdjustKind adjustKind = AdjustKind.NONE;

    /** Giảm: số còn lại (tử số). */
    @Column(name = "adjust_quantity", precision = 14, scale = 3)
    private BigDecimal adjustQuantity;

    /** Giảm: đối tượng tính sau giảm. */
    @Enumerated(EnumType.STRING)
    @Column(name = "adjust_basis", length = 20)
    private NormBasis adjustBasis;

    /** Giảm: mỗi bao nhiêu đối tượng (mẫu số). */
    @Column(name = "adjust_basis_size")
    private Integer adjustBasisSize;

    /** Giảm: khi nào ("Nơi chưa có điều kiện"). */
    @Column(name = "adjust_condition", length = 500)
    private String adjustCondition;

    /** Thay thế: thiết bị của danh mục thay được. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "adjust_substitute_catalog_id")
    private EquipmentCatalog adjustSubstituteCatalog;

    /** Thay thế: hình thức khác ("Phần mềm mô phỏng"). */
    @Column(name = "adjust_substitute_text", length = 500)
    private String adjustSubstituteText;

    /** Thay thế: trường đã có thứ thay thế thì không tính thiết bị này. */
    @Column(name = "adjust_substitute_required", nullable = false)
    private boolean adjustSubstituteRequired;

    /** Chọn trong nhóm: tên nhóm, trong cùng bộ + môn. */
    @Column(name = "adjust_group", length = 255)
    private String adjustGroup;

    /** Chọn trong nhóm: số thiết bị được chọn. */
    @Column(name = "adjust_group_pick")
    private Integer adjustGroupPick;

    /** Câu căn cứ trong thông tư — bắt buộc với mọi kiểu trừ NONE. */
    @Column(name = "adjust_basis_text", length = 1000)
    private String adjustBasisText;

    /** Dùng chung: các thiết bị dùng chung được. LAZY — chạm ở {@code loadForResponse}. */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "equipment_norm_adjust_shared",
            joinColumns = @JoinColumn(name = "norm_id"),
            inverseJoinColumns = @JoinColumn(name = "catalog_id"))
    @BatchSize(size = 50)
    private Set<EquipmentCatalog> adjustShared = new LinkedHashSet<>();

    /** Dòng thay dòng này (nếu có) — điền khi đọc danh sách, không lưu. */
    @Transient
    private Long replacedById;

    public EquipmentStandard getStandard() {
        return standard;
    }

    public void setStandard(EquipmentStandard standard) {
        this.standard = standard;
    }

    public EquipmentCatalog getCatalog() {
        return catalog;
    }

    public void setCatalog(EquipmentCatalog catalog) {
        this.catalog = catalog;
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

    public Grade getGrade() {
        return grade;
    }

    public void setGrade(Grade grade) {
        this.grade = grade;
    }

    public RoomType getRoomType() {
        return roomType;
    }

    public void setRoomType(RoomType roomType) {
        this.roomType = roomType;
    }

    public BigDecimal getMinQuantity() {
        return minQuantity;
    }

    public void setMinQuantity(BigDecimal minQuantity) {
        this.minQuantity = minQuantity;
    }

    public Integer getBasisSize() {
        return basisSize;
    }

    public void setBasisSize(Integer basisSize) {
        this.basisSize = basisSize;
    }

    public String getQuantityText() {
        return quantityText;
    }

    public void setQuantityText(String quantityText) {
        this.quantityText = quantityText;
    }

    public String getUnitText() {
        return unitText;
    }

    public void setUnitText(String unitText) {
        this.unitText = unitText;
    }

    public String getGradeLevels() {
        return gradeLevels;
    }

    public void setGradeLevels(String gradeLevels) {
        this.gradeLevels = gradeLevels;
    }

    public String getItemNo() {
        return itemNo;
    }

    public void setItemNo(String itemNo) {
        this.itemNo = itemNo;
    }

    public String getSectionName() {
        return sectionName;
    }

    public void setSectionName(String sectionName) {
        this.sectionName = sectionName;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isForTeacher() {
        return forTeacher;
    }

    public void setForTeacher(boolean forTeacher) {
        this.forTeacher = forTeacher;
    }

    public boolean isForStudent() {
        return forStudent;
    }

    public void setForStudent(boolean forStudent) {
        this.forStudent = forStudent;
    }

    public boolean isOptional() {
        return optional;
    }

    public void setOptional(boolean optional) {
        this.optional = optional;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public NormBasis getNormBasis() {
        return normBasis;
    }

    public void setNormBasis(NormBasis normBasis) {
        this.normBasis = normBasis == null ? NormBasis.PER_SCHOOL : normBasis;
    }

    public EquipmentStandardDocument getSourceDocument() {
        return sourceDocument;
    }

    public void setSourceDocument(EquipmentStandardDocument sourceDocument) {
        this.sourceDocument = sourceDocument;
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public LocalDate getEffectiveTo() {
        return effectiveTo;
    }

    public void setEffectiveTo(LocalDate effectiveTo) {
        this.effectiveTo = effectiveTo;
    }

    public EquipmentNorm getReplaces() {
        return replaces;
    }

    public void setReplaces(EquipmentNorm replaces) {
        this.replaces = replaces;
    }

    public EquipmentStandardDocument getEndDocument() {
        return endDocument;
    }

    public void setEndDocument(EquipmentStandardDocument endDocument) {
        this.endDocument = endDocument;
    }

    public AdjustKind getAdjustKind() {
        return adjustKind;
    }

    public void setAdjustKind(AdjustKind adjustKind) {
        this.adjustKind = adjustKind == null ? AdjustKind.NONE : adjustKind;
    }

    public BigDecimal getAdjustQuantity() {
        return adjustQuantity;
    }

    public void setAdjustQuantity(BigDecimal adjustQuantity) {
        this.adjustQuantity = adjustQuantity;
    }

    public NormBasis getAdjustBasis() {
        return adjustBasis;
    }

    public void setAdjustBasis(NormBasis adjustBasis) {
        this.adjustBasis = adjustBasis;
    }

    public Integer getAdjustBasisSize() {
        return adjustBasisSize;
    }

    public void setAdjustBasisSize(Integer adjustBasisSize) {
        this.adjustBasisSize = adjustBasisSize;
    }

    public String getAdjustCondition() {
        return adjustCondition;
    }

    public void setAdjustCondition(String adjustCondition) {
        this.adjustCondition = adjustCondition;
    }

    public EquipmentCatalog getAdjustSubstituteCatalog() {
        return adjustSubstituteCatalog;
    }

    public void setAdjustSubstituteCatalog(EquipmentCatalog adjustSubstituteCatalog) {
        this.adjustSubstituteCatalog = adjustSubstituteCatalog;
    }

    public String getAdjustSubstituteText() {
        return adjustSubstituteText;
    }

    public void setAdjustSubstituteText(String adjustSubstituteText) {
        this.adjustSubstituteText = adjustSubstituteText;
    }

    public boolean isAdjustSubstituteRequired() {
        return adjustSubstituteRequired;
    }

    public void setAdjustSubstituteRequired(boolean adjustSubstituteRequired) {
        this.adjustSubstituteRequired = adjustSubstituteRequired;
    }

    public String getAdjustGroup() {
        return adjustGroup;
    }

    public void setAdjustGroup(String adjustGroup) {
        this.adjustGroup = adjustGroup;
    }

    public Integer getAdjustGroupPick() {
        return adjustGroupPick;
    }

    public void setAdjustGroupPick(Integer adjustGroupPick) {
        this.adjustGroupPick = adjustGroupPick;
    }

    public String getAdjustBasisText() {
        return adjustBasisText;
    }

    public void setAdjustBasisText(String adjustBasisText) {
        this.adjustBasisText = adjustBasisText;
    }

    public Set<EquipmentCatalog> getAdjustShared() {
        return adjustShared;
    }

    public Long getReplacedById() {
        return replacedById;
    }

    public void setReplacedById(Long replacedById) {
        this.replacedById = replacedById;
    }

    /** Áp dụng vào ngày {@code day}. */
    public boolean effectiveOn(LocalDate day) {
        return effectiveFrom != null && !effectiveFrom.isAfter(day) && (effectiveTo == null || effectiveTo.isAfter(day));
    }

    /**
     * Vế SQL "dòng {@code alias} áp dụng HÔM NAY" — mọi truy vấn tính đủ / thiếu, báo cáo đọc định mức phải ghép nó
     * (dòng sắp áp dụng / đã thôi áp dụng vẫn nằm cùng bộ).
     */
    public static String effectiveTodaySql(String alias) {
        // Ngày áp dụng (theo văn bản căn cứ) chỉ để biết — danh mục là danh sách phẳng, dòng có trong bộ là đang tính.
        return " (" + alias + ".effective_to IS NULL OR " + alias + ".effective_to > CURRENT_DATE) ";
    }
}
