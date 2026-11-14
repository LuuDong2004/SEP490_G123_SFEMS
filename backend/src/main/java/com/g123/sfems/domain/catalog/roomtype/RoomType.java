package com.g123.sfems.domain.catalog.roomtype;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import org.hibernate.type.SqlTypes;
import org.hibernate.annotations.JdbcTypeCode;
import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.facilitygroup.FacilityGroup;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Loại CSVC (bảng {@code room_types}, tên cũ "loại phòng") — phòng học, phòng bộ môn, thư viện, sân, cổng… theo danh
 * mục CSVC của Sở (192): mỗi loại thuộc một khối, là phòng hay khu vực, áp cho cấp nào, theo văn bản nào.
 *
 * <p>Hành vi của phòng đọc từ CỜ của loại, không từ mã: {@link #loanable} (mặc định cho mượn), {@link #functional}
 * (phòng bộ môn / chức năng, báo cáo Sử dụng phòng). Riêng "kho" vẫn theo mã {@code KHO} (Phòng thiết bị giáo dục).
 *
 * <p>{@link #schoolId} khác rỗng: loại ngoài danh mục do một trường thêm, chỉ trường đó (và Sở) thấy.
 */
@Entity
@Table(name = "room_types")
public class RoomType extends CatalogEntity {

    /** Loại phòng, nhà. */
    public static final String ROOM = "ROOM";
    /** Khu vực, công trình không phải phòng: sân, cổng, hàng rào, khu vệ sinh, khu để xe, bể bơi. */
    public static final String AREA = "AREA";

    /** Nhóm phòng, văn bản tự do của bản Jmix — giữ cho dữ liệu cũ; khối CSVC thay nó. */
    @Column(name = "room_group", length = 64)
    private String roomGroup;

    /**
     * Cấp học (bản Jmix, một cấp). Thay bằng {@link #levels}; giữ cột cho dữ liệu cũ.
     *
     * <p>{@code EAGER}: DTO được ánh xạ trong controller, sau khi transaction đã đóng ({@code open-in-view=false}).
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    /** Khối CSVC. {@code EAGER} vì cùng lý do với cấp học. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "group_id")
    private FacilityGroup group;

    @Column(name = "kind", length = 10, nullable = false)
    private String kind = ROOM;

    /** Cấp áp dụng, xem {@code FacilityLevels}; trống là mọi cấp. */
    @Column(name = "levels", length = 40)
    private String levels;

    /** Thuộc danh mục theo văn bản (Sở quản lý); {@code false} là loại ngoài danh mục. */
    @Column(name = "standard", nullable = false)
    private boolean standard;

    @Column(name = "legal_basis", length = 255)
    private String legalBasis;

    @Column(name = "loanable", nullable = false)
    private boolean loanable;

    @Column(name = "functional", nullable = false)
    private boolean functional;

    @Column(name = "school_id")
    private Long schoolId;

    /** Thông số riêng của loại: [{key, label, unit, type}] — phòng thuộc loại này khai các ô đó (201, QLTB-633). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "params", columnDefinition = "jsonb", nullable = false)
    private List<Map<String, String>> params = new ArrayList<>();

    public String getRoomGroup() {
        return roomGroup;
    }

    public void setRoomGroup(String roomGroup) {
        this.roomGroup = roomGroup;
    }

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public FacilityGroup getGroup() {
        return group;
    }

    public void setGroup(FacilityGroup group) {
        this.group = group;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getLevels() {
        return levels;
    }

    public void setLevels(String levels) {
        this.levels = levels;
    }

    public boolean isStandard() {
        return standard;
    }

    public void setStandard(boolean standard) {
        this.standard = standard;
    }

    public String getLegalBasis() {
        return legalBasis;
    }

    public void setLegalBasis(String legalBasis) {
        this.legalBasis = legalBasis;
    }

    public boolean isLoanable() {
        return loanable;
    }

    public void setLoanable(boolean loanable) {
        this.loanable = loanable;
    }

    public boolean isFunctional() {
        return functional;
    }

    public void setFunctional(boolean functional) {
        this.functional = functional;
    }

    public Long getSchoolId() {
        return schoolId;
    }

    public void setSchoolId(Long schoolId) {
        this.schoolId = schoolId;
    }

    public List<Map<String, String>> getParams() {
        return params;
    }

    public void setParams(List<Map<String, String>> params) {
        this.params = params;
    }
}
