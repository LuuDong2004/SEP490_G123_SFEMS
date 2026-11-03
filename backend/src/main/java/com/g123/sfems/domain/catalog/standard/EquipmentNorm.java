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
 * Một dòng định mức (DM-03): nhóm thiết bị nào, cần tối thiểu bao nhiêu, tính trên cái gì. Báo cáo
 * "mức đáp ứng" (BC-03) so số thiết bị dùng được của trường với {@code minQuantity × cơ sở tính}.
 *
 * <p>{@code code} / {@code name} của lớp nền là số thứ tự và tên dòng trong phụ lục thông tư. Trỏ vào
 * {@link #catalog} khi dòng đã ghép được với danh mục thiết bị; chưa ghép thì vẫn giữ được mô tả.
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

    /** Phòng bộ môn mà dòng này tính cho (khi {@code normBasis = PER_ROOM}). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    /** Số lượng tối thiểu trên một đơn vị cơ sở ({@link #basisSize} đơn vị). */
    @Column(name = "min_quantity", precision = 14, scale = 3)
    private BigDecimal minQuantity;

    /** Cơ sở tính: "1 bộ / 2 lớp" là {@code minQuantity = 1, basisSize = 2}. Trống là 1. */
    @Column(name = "basis_size")
    private Integer basisSize;

    /** Số lượng và đơn vị NHƯ TRONG VĂN BẢN, giữ nguyên chữ để đối chiếu khi số không quy được. */
    @Column(name = "quantity_text", length = 100)
    private String quantityText;

    @Column(name = "unit_text", length = 50)
    private String unitText;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "norm_basis", nullable = false, length = 20)
    private NormBasis normBasis = NormBasis.PER_SCHOOL;

    /** Số thứ tự trong phụ lục ("I.1.3"). */
    @Column(name = "item_no", length = 20)
    private String itemNo;

    /** Chủ đề / mục của phụ lục chứa dòng này. */
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

    /** Thiết bị "nên có" chứ không bắt buộc — không tính vào mức đáp ứng. */
    @Column(nullable = false)
    private boolean optional;

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

    public String getItemNo() {
        return itemNo;
    }

    public void setItemNo(String itemNo) {
        this.itemNo = itemNo;
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
}
