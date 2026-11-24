package com.g123.sfems.domain.catalog.facilitystandard;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.legaldocument.LegalDocument;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Quy tắc chuẩn CSVC (203): một loại CSVC ở một cấp học và một mức (tối thiểu / mức độ 1 / mức độ 2) theo
 * TT 13/2020 sửa bởi TT 23/2024. Các điều kiện đều tuỳ chọn; quy tắc đạt khi mọi điều kiện đã khai đều đạt.
 *
 * <p>Dựng trên {@link CatalogEntity} để dùng chung màn danh mục: {@code code} và {@code name} do máy chủ sinh từ loại,
 * cấp, mức ({@code FacilityStandardRuleService}), không ai gõ.
 */
@Entity
@Table(name = "facility_standard_rules")
public class FacilityStandardRule extends CatalogEntity {

    public static final String MIN = "MIN";
    public static final String LEVEL1 = "LEVEL1";
    public static final String LEVEL2 = "LEVEL2";
    /** Ba mức theo thứ tự tăng dần — mức sau gồm cả quy tắc của mức trước. */
    public static final List<String> TIERS = List.of(MIN, LEVEL1, LEVEL2);

    /** {@code EAGER}: phản hồi đọc tên loại sau khi giao dịch đã đóng. */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    /** Mã cấp học: TH, THCS, THPT. */
    @Column(name = "level_code", length = 10, nullable = false)
    private String levelCode;

    /** {@link #MIN}, {@link #LEVEL1}, {@link #LEVEL2}. */
    @Column(name = "tier", length = 10, nullable = false)
    private String tier;

    /** Có ít nhất N phòng / hạng mục. */
    @Column(name = "min_count")
    private Integer minCount;

    /** Số phòng ≥ làm tròn lên(số lớp × tỷ lệ). */
    @Column(name = "count_per_class", precision = 6, scale = 3)
    private BigDecimal countPerClass;

    /** Mỗi phòng ≥ X m². */
    @Column(name = "min_room_area", precision = 10, scale = 2)
    private BigDecimal minRoomArea;

    /** Tổng diện tích ≥ số học sinh × X m². */
    @Column(name = "area_per_student", precision = 8, scale = 3)
    private BigDecimal areaPerStudent;

    /** Tổng diện tích ≥ X m². */
    @Column(name = "min_total_area", precision = 12, scale = 2)
    private BigDecimal minTotalArea;

    /** Trường lớn hơn N lớp thì tối thiểu {@link #largeMinCount} phòng (291) — cả hai cùng khai hoặc cùng trống. */
    @Column(name = "large_class_from")
    private Integer largeClassFrom;

    @Column(name = "large_min_count")
    private Integer largeMinCount;

    /** {@link #areaPerStudent} tính trên bao nhiêu % học sinh toàn trường (thư viện: 30%). Trống = mọi học sinh. */
    @Column(name = "student_percent", precision = 5, scale = 2)
    private BigDecimal studentPercent;

    /** Chỉ xét khi trường có loại phòng này (kho bếp, phòng sinh hoạt chung của trường nội trú, phòng bộ môn từng môn). */
    @Column(name = "only_if_present", nullable = false)
    private Boolean onlyIfPresent = false;

    /** Đếm CHUNG mọi phòng học bộ môn (một phòng ghép tính một lần) thay vì đếm phòng của riêng loại này. */
    @Column(name = "subject_rooms", nullable = false, updatable = false)
    private Boolean subjectRooms = false;

    /** Điều, khoản áp dụng ("Khoản 4 Điều 18 và Phụ lục IV") — văn bản nào thì ở {@link #legalDocuments}. */
    @Column(name = "legal_basis", length = 255)
    private String legalBasis;

    /** Văn bản căn cứ, chọn từ danh mục Văn bản căn cứ. {@code SUBSELECT}: cả danh sách một câu, không một câu mỗi quy tắc. */
    @ManyToMany(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SUBSELECT)
    @JoinTable(name = "facility_standard_rule_documents",
            joinColumns = @JoinColumn(name = "rule_id"),
            inverseJoinColumns = @JoinColumn(name = "legal_document_id"))
    @OrderBy("issuedOn ASC, id ASC")
    private Set<LegalDocument> legalDocuments = new LinkedHashSet<>();

    public Set<LegalDocument> getLegalDocuments() {
        return legalDocuments;
    }

    public Integer getLargeClassFrom() {
        return largeClassFrom;
    }

    public void setLargeClassFrom(Integer largeClassFrom) {
        this.largeClassFrom = largeClassFrom;
    }

    public Integer getLargeMinCount() {
        return largeMinCount;
    }

    public void setLargeMinCount(Integer largeMinCount) {
        this.largeMinCount = largeMinCount;
    }

    public BigDecimal getStudentPercent() {
        return studentPercent;
    }

    public void setStudentPercent(BigDecimal studentPercent) {
        this.studentPercent = studentPercent;
    }

    public Boolean getOnlyIfPresent() {
        return onlyIfPresent;
    }

    public void setOnlyIfPresent(Boolean onlyIfPresent) {
        this.onlyIfPresent = Boolean.TRUE.equals(onlyIfPresent);
    }

    public Boolean getSubjectRooms() {
        return subjectRooms;
    }

    public RoomType getRoomType() {
        return roomType;
    }

    public void setRoomType(RoomType roomType) {
        this.roomType = roomType;
    }

    public String getLevelCode() {
        return levelCode;
    }

    public void setLevelCode(String levelCode) {
        this.levelCode = levelCode;
    }

    public String getTier() {
        return tier;
    }

    public void setTier(String tier) {
        this.tier = tier;
    }

    public Integer getMinCount() {
        return minCount;
    }

    public void setMinCount(Integer minCount) {
        this.minCount = minCount;
    }

    public BigDecimal getCountPerClass() {
        return countPerClass;
    }

    public void setCountPerClass(BigDecimal countPerClass) {
        this.countPerClass = countPerClass;
    }

    public BigDecimal getMinRoomArea() {
        return minRoomArea;
    }

    public void setMinRoomArea(BigDecimal minRoomArea) {
        this.minRoomArea = minRoomArea;
    }

    public BigDecimal getAreaPerStudent() {
        return areaPerStudent;
    }

    public void setAreaPerStudent(BigDecimal areaPerStudent) {
        this.areaPerStudent = areaPerStudent;
    }

    public BigDecimal getMinTotalArea() {
        return minTotalArea;
    }

    public void setMinTotalArea(BigDecimal minTotalArea) {
        this.minTotalArea = minTotalArea;
    }

    public String getLegalBasis() {
        return legalBasis;
    }

    public void setLegalBasis(String legalBasis) {
        this.legalBasis = legalBasis;
    }
}
