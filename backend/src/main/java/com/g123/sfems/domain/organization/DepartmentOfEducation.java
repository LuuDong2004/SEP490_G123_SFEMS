package com.g123.sfems.domain.organization;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Sở / Phòng Giáo dục và Đào tạo — đơn vị cấp trên của các trường.
 *
 * <p>Đây là gốc của trục tổ chức: Sở → Trường → (sau này) Cơ sở → Toà nhà →
 * Phòng. Một trường bắt buộc thuộc về một Sở, nên bảng này phải có trước.
 *
 * <h2>Bảng này thay chỗ cặp organizations/departments của nền</h2>
 *
 * <p>Nền dth-framework có sẵn cặp {@code organizations}/{@code departments}
 * với đúng hình dạng cha–con cần thiết, và tái dụng chúng sẽ được không hai
 * khoá ngữ cảnh dựng sẵn của engine phân quyền dòng. Đã cân nhắc và KHÔNG
 * chọn: cái tên sống suốt đời dự án và xuất hiện ở mọi bảng, mọi URL, mọi mã
 * quyền, mọi khoá i18n — đọc "department" mà hiểu là "trường" là một phép quy
 * đổi người mới nào cũng phải học. Ngoài ra bên trong một trường còn cần khái
 * niệm tổ/bộ môn, tức là từ "department" phải để dành cho đúng thứ nó chỉ.
 *
 * <p>Cặp cũ sau đó đã bị XOÁ hẳn, cùng {@code tasks}: giữ hai cặp cha–con gần
 * giống hệt nhau cạnh nhau chỉ để một cặp làm mẫu là thêm một chỗ để nhầm.
 * Cặp này — cùng {@code School} — giờ là mẫu để chép khi thêm resource mới.
 *
 * <p>Cái giá phải trả là tự viết một {@code RowLevelContextProvider} cho
 * {@code user.schoolId}. Đã trả, một lần, ở
 * {@code RowLevelContextProviders.currentSchoolId()}.
 */
@Entity
@Table(name = "departments_of_education")
public class DepartmentOfEducation extends BaseEntity {

    /** Mã ổn định, ví dụ {@code SGD-HCM}. Duy nhất, không phân biệt hoa thường. */
    @Column(nullable = false, length = 64, unique = true)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 128)
    private String province;

    @Column(length = 500)
    private String address;

    /**
     * Sở, UBND, hay cơ quan khác. Bắt buộc — xem {@link ManagingBodyType}.
     *
     * <p>Không có giá trị mặc định, và đó là cố ý: một mặc định ở đây sẽ âm
     * thầm gán loại sai cho mọi dòng thêm mà quên khai báo, và loại sai nghĩa
     * là phạm vi dữ liệu sai — thứ không ai phát hiện ra bằng mắt.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ManagingBodyType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrgStatus status = OrgStatus.ACTIVE;

    protected DepartmentOfEducation() {
        // JPA
    }

    public DepartmentOfEducation(String code, String name, ManagingBodyType type) {
        this.code = code;
        this.name = name;
        this.type = type;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getProvince() {
        return province;
    }

    public void setProvince(String province) {
        this.province = province;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public ManagingBodyType getType() {
        return type;
    }

    public void setType(ManagingBodyType type) {
        this.type = type;
    }

    public OrgStatus getStatus() {
        return status;
    }

    public void setStatus(OrgStatus status) {
        this.status = status == null ? OrgStatus.ACTIVE : status;
    }
}
