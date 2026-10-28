package com.g123.sfems.domain.organization;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.ward.Ward;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Trường học — đơn vị sở hữu cơ sở vật chất và thiết bị.
 *
 * <p>Đây sẽ là GỐC PHÂN QUYỀN của toàn hệ thống: gần như mọi bảng nghiệp vụ
 * sau này đều trỏ về đây, và câu "người này thấy dòng nào" hầu hết sẽ quy về
 * "dòng thuộc trường của người này".
 *
 * <h2>Đã ở trong diện phân quyền dòng</h2>
 *
 * <p>Tên {@code "schools"} ở đây phải trùng đúng tên resource trong
 * {@code routes.tsx} và nửa đầu của các mã quyền — không có bảng ánh xạ nào ở
 * giữa để lệch. Luật viết được trên bảng này khai ở
 * {@link com.g123.sfems.module.organization.school.security.SchoolRowLevelPolicies},
 * và luật tự nhiên là {@code id = user.schoolId}.
 *
 * <p>Khoá ngữ cảnh {@code user.schoolId} lấy từ {@code User.school} đi qua
 * {@code AuthorityCache.Entry} rồi thành {@code RowLevelPrincipal} — nên nó
 * KHÔNG tốn truy vấn nào, đúng ràng buộc mà mọi
 * {@code RowLevelContextProvider} phải giữ.
 */
@RowLevelResource("schools")
@Entity
@Table(name = "schools")
public class School extends BaseEntity {

    /**
     * Cơ quan quản lý — Sở với THPT, UBND phường/xã với Tiểu học và THCS.
     *
     * <p>Cho phép RỖNG, và rỗng có nghĩa là "CHƯA XÁC ĐỊNH", không phải "thuộc
     * Sở". Nguồn dữ liệu của Sở không nói trường nào thuộc UBND nào với phần
     * lớn trường tiểu học và THCS, vì địa chỉ của chúng còn ghi theo phường cũ
     * trước 01/07/2025. Gán chúng về Sở sẽ là khẳng định một điều sai theo
     * phân cấp quản lý nhà nước — Sở không quản lý trực tiếp cấp 1 và cấp 2.
     *
     * <p>Rỗng cũng là hành vi đúng với phân quyền dòng: so sánh với một khoá
     * ngoại rỗng cho ra UNKNOWN, và UNKNOWN bị xử như TỪ CHỐI, nên không UBND
     * nào vô tình thấy trường chưa xác định thuộc về mình.
     *
     * <p>Khoá ngoại là {@code RESTRICT}: xoá một cơ quan còn trường trực thuộc
     * bị database từ chối, chứ không phải bị một câu đếm trong service từ chối
     * — đếm số trường từ bên trong feature cơ quan là đọc bảng của feature
     * khác.
     *
     * <p><b>{@code EAGER}, và đó là bắt buộc chứ không phải tuỳ chọn ở nền
     * này.</b> {@code spring.jpa.open-in-view=false}, còn DTO thì được ánh xạ
     * trong controller — tức là SAU khi transaction đã đóng. Một tham chiếu
     * {@code LAZY} ở đây cho ra {@code LazyInitializationException} ngay khi
     * {@code SchoolResponse.from} đọc tới, và nó là lỗi 500 chỉ lộ ra lúc gọi
     * thật: compile sạch, {@code clean test} xanh, vì không test nào mở
     * endpoint.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_of_education_id")
    private DepartmentOfEducation departmentOfEducation;

    /**
     * Cấp học. Khoá ngoại thật tới danh mục chứ không phải chuỗi mã.
     *
     * <p>Bản Jmix lưu đây là một cột chuỗi dài 30 chứa mã cấp học. Chuỗi mã
     * thì không có gì ngăn nó trỏ vào một cấp học không tồn tại, và đổi tên
     * một cấp học là phải đi sửa mọi dòng đang chép mã đó. Khoá ngoại để
     * database giữ hộ cả hai chuyện.
     *
     * <p>Cho phép rỗng, như bản Jmix: có trường liên cấp và có dữ liệu nhập về
     * chưa xác định cấp. Bắt buộc ở đây sẽ chặn việc nhập liệu vì một lý do
     * mang tính hình thức.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    /** Mã trường, duy nhất toàn hệ thống. */
    @Column(nullable = false, length = 64, unique = true)
    private String code;

    /**
     * Mã định danh cơ sở giáo dục của Bộ GD&ĐT — trường "Mã trường (học)" trên
     * CSDL ngành, dài 20 ký tự, ghép từ mã tỉnh + mã huyện + mã đơn vị.
     *
     * <p>Duy nhất toàn quốc và BẤT BIẾN từ lần nhập đầu tiên. Đây là khoá để
     * liên thông với CSDL ngành giáo dục (Chương V mục 3.8.1) — không có nó
     * thì việc ghép dữ liệu phải dựa vào tên trường, thứ chắc chắn lệch.
     *
     * <p>Cho phép rỗng: một trường vừa khai báo ở đây chưa chắc đã có mã trên
     * CSDL ngành. Rỗng nghĩa là "chưa liên thông được".
     */
    @Column(name = "moet_code", length = 20, unique = true)
    private String moetCode;

    /**
     * Mã hai ký tự của trường, dùng làm thành phần {@code TR} khi sinh mã tài
     * sản {@code TT.TR.MH.LT.ST.NC}.
     *
     * <p>Từng mang tên {@code emisCode} và được chú thích nhầm là mã của Bộ.
     * Mã của Bộ dài 20 ký tự — xem {@link #moetCode}. Cái này là mã nội bộ, chỉ
     * để mã tài sản đủ ngắn mà vẫn đọc được.
     */
    @Column(name = "short_code", length = 2)
    private String shortCode;

    @Column(nullable = false, length = 255)
    private String name;

    /**
     * Phường/Xã.
     *
     * <p>Không có cột Quận/Huyện: từ 2025 TP.HCM bỏ cấp quận/huyện, địa chỉ
     * hành chính chỉ còn phường/xã. Bản Jmix vẫn còn cột {@code district} là
     * di sản của cấu trúc cũ.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ward_id")
    private Ward ward;

    /**
     * Giá trị địa bàn do người dùng gõ tay trước khi có danh mục, giữ lại để
     * đối chiếu. Chỉ đọc — mọi đường ghi đều đi qua {@link #ward}.
     *
     * <p>Không xoá khi chuyển sang khoá ngoại: dòng nào không ghép được với
     * danh mục thì đây là thứ duy nhất còn nói được người dùng đã định nhập
     * gì. Một migration sau, khi không còn dòng nào rỗng, mới nên bỏ nó.
     *
     * <p>Không có DTO nào cho ghi vào đây — mọi đường ghi địa bàn đi qua
     * {@link #ward}. Cột vẫn ánh xạ ghi được vì nó còn là <b>vô hướng cho phép
     * rỗng duy nhất</b> trong tập trường đóng của chính sách phạm vi dòng, tức
     * là chỗ {@code CompilerAgreementTest} kiểm chứng hai trình biên dịch đồng
     * ý với nhau trên một giá trị rỗng.
     */
    @Column(name = "ward_text", length = 128)
    private String wardText;

    /**
     * Quận/huyện CŨ trước 01/07/2025 — manh mối địa bàn khi chưa ghép được
     * phường/xã mới.
     *
     * <p>Nguồn dữ liệu của Sở phần lớn còn ghi theo quận cũ; chỉ 75 trong 946
     * trường có tên phường khớp danh mục sau sáp nhập. Bỏ cột này thì 871
     * trường còn lại không có bất kỳ manh mối địa bàn nào để lọc hay tổng hợp.
     *
     * <p>Cột CHUYỂN TIẾP: hết việc khi mọi trường đã có {@link #ward}. Không
     * có khoá ngoại vì các quận ấy không còn là đơn vị hành chính nào để trỏ
     * tới — chúng là dữ liệu lịch sử.
     */
    @Column(length = 128)
    private String district;

    @Column(length = 500)
    private String address;

    /** Màu chủ đạo dùng cho nhãn in và biểu trưng của trường, dạng {@code #RRGGBB}. */
    @Column(name = "primary_color", length = 20)
    private String primaryColor;

    /** Số lớp — cơ sở tính định mức "mỗi lớp một bộ". */
    @Column(name = "class_count")
    private Integer classCount;

    /** Số học sinh — cơ sở tính định mức theo học sinh. */
    @Column(name = "student_count")
    private Integer studentCount;

    public Integer getClassCount() {
        return classCount;
    }

    public void setClassCount(Integer classCount) {
        this.classCount = classCount;
    }

    public Integer getStudentCount() {
        return studentCount;
    }

    public void setStudentCount(Integer studentCount) {
        this.studentCount = studentCount;
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrgStatus status = OrgStatus.ACTIVE;

    /**
     * {@link #departmentOfEducation} được xác định bằng cách nào.
     *
     * <p>Rỗng khi chưa xác định cơ quan quản lý, hoặc khi người dùng tự chọn
     * trên form — chọn tay thì chính người chọn là nguồn, không cần ghi lại.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "department_source", length = 32)
    private DepartmentSource departmentSource;

    protected School() {
        // JPA
    }

    public School(DepartmentOfEducation departmentOfEducation, String code, String name) {
        this.departmentOfEducation = departmentOfEducation;
        this.code = code;
        this.name = name;
    }

    public DepartmentOfEducation getDepartmentOfEducation() {
        return departmentOfEducation;
    }

    public void setDepartmentOfEducation(DepartmentOfEducation departmentOfEducation) {
        this.departmentOfEducation = departmentOfEducation;
    }

    public EducationLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(EducationLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMoetCode() {
        return moetCode;
    }

    public void setMoetCode(String moetCode) {
        this.moetCode = moetCode;
    }

    public String getShortCode() {
        return shortCode;
    }

    public void setShortCode(String shortCode) {
        this.shortCode = shortCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Ward getWard() {
        return ward;
    }

    public void setWard(Ward ward) {
        this.ward = ward;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    /** Địa bàn người dùng từng gõ tay, nếu chưa ghép được với danh mục. */
    public String getWardText() {
        return wardText;
    }

    /** Chỉ dùng cho chuyển đổi dữ liệu và fixture kiểm thử. */
    public void setWardText(String wardText) {
        this.wardText = wardText;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPrimaryColor() {
        return primaryColor;
    }

    public void setPrimaryColor(String primaryColor) {
        this.primaryColor = primaryColor;
    }

    public DepartmentSource getDepartmentSource() {
        return departmentSource;
    }

    public void setDepartmentSource(DepartmentSource departmentSource) {
        this.departmentSource = departmentSource;
    }

    public OrgStatus getStatus() {
        return status;
    }

    public void setStatus(OrgStatus status) {
        this.status = status == null ? OrgStatus.ACTIVE : status;
    }
}
