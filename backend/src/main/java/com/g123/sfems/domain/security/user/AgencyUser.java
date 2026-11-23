package com.g123.sfems.domain.security.user;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.security.role.Role;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

/**
 * Phần chung của tài khoản cơ quan quản lý — {@link SoUser} (bảng {@code user_sos}). Cơ quan quản lý không đổi sau khi tạo; khoá ngoại kép
 * {@code (managing_body_id, body_type)} ở CSDL bắt cơ quan đúng loại (tài khoản Sở luôn gắn cơ quan loại Sở).
 */
@MappedSuperclass
public abstract class AgencyUser extends User {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "managing_body_id", nullable = false, updatable = false)
    private DepartmentOfEducation managingBody;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserPosition position = UserPosition.STAFF;

    @Column(name = "job_title", length = 255)
    private String jobTitle;

    @Column(name = "work_phone", length = 20)
    private String workPhone;

    protected AgencyUser() {
        // for JPA
    }

    protected AgencyUser(String username, String email, String passwordHash, String fullName, UserStatus status,
            DepartmentOfEducation managingBody) {
        super(username, email, passwordHash, fullName, status);
        this.managingBody = managingBody;
    }

    @PrePersist
    @PreUpdate
    void syncPosition() {
        position = UserPosition.fromRoles(getRoles().stream().map(Role::getCode).toList());
    }

    public DepartmentOfEducation getManagingBody() {
        return managingBody;
    }

    @Override
    public DepartmentOfEducation managingBodyOrNull() {
        return managingBody;
    }

    public UserPosition getPosition() {
        return position;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public String getWorkPhone() {
        return workPhone;
    }

    public void setWorkPhone(String workPhone) {
        this.workPhone = workPhone;
    }
}
