package com.g123.sfems.domain.school.staff;

import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.facility.Campus;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Cán bộ, giáo viên của trường — NHÂN SỰ, không phải tài khoản đăng nhập.
 * Người quản lý phòng, thiết bị, thành viên tổ kiểm kê... đều trỏ vào đây.
 *
 * <p>{@code name} (của lớp nền) là HỌ TÊN. Chưa có liên kết tới tài khoản như
 * bản Jmix — làm cùng chức năng cấp tài khoản cho cán bộ.
 */
@RowLevelResource("staff")
@Entity
@Table(name = "staff")
public class Staff extends SchoolOwnedEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "staff_type", nullable = false, length = 20)
    private StaffType staffType = StaffType.TEACHER;

    /** Chức vụ — giá trị trong danh mục cố định "Chức vụ". */
    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private StaffPosition position;

    /** Phòng ban / bộ phận (cho cán bộ), nhập tự do: "Phòng Hành chính"... */
    @Column(length = 255)
    private String department;

    @Column(length = 30)
    private String phone;

    @Column(length = 255)
    private String email;

    /** Các môn giảng dạy (giáo viên). */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "staff_subjects",
            joinColumns = @JoinColumn(name = "staff_id"),
            inverseJoinColumns = @JoinColumn(name = "subject_id"))
    @OrderBy("sortOrder ASC, name ASC")
    @BatchSize(size = 100)
    private Set<Subject> subjects = new LinkedHashSet<>();

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "main_subject_id")
    private Subject mainSubject;

    /** Cơ sở làm việc (271) — trống = cơ sở chính. Phạm vi cơ sở của tài khoản, giáo viên theo cơ sở ở báo cáo. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "campus_id")
    private Campus campus;

    /**
     * Tài khoản đăng nhập của cán bộ này, nếu đã cấp. EAGER: danh sách cán bộ hiện tên đăng nhập và
     * trạng thái trên mỗi dòng, và chỉ cán bộ đã có tài khoản mới tốn một lần đọc.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id")
    private User account;

    public StaffType getStaffType() {
        return staffType;
    }

    public void setStaffType(StaffType staffType) {
        this.staffType = staffType == null ? StaffType.TEACHER : staffType;
    }

    public StaffPosition getPosition() {
        return position;
    }

    public void setPosition(StaffPosition position) {
        this.position = position;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Set<Subject> getSubjects() {
        return subjects;
    }

    public Campus getCampus() {
        return campus;
    }

    public void setCampus(Campus campus) {
        this.campus = campus;
    }

    public Subject getMainSubject() {
        return mainSubject;
    }

    public void setMainSubject(Subject mainSubject) {
        this.mainSubject = mainSubject;
    }

    public User getAccount() {
        return account;
    }

    public void setAccount(User account) {
        this.account = account;
    }
}
