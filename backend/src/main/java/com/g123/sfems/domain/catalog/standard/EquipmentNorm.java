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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

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
}
