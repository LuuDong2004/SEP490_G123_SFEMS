package com.g123.sfems.domain.security.user;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.security.role.Role;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

/**
 * Tài khoản trường ({@link UserType#SCHOOL}) — bảng con {@code user_schools}. Trường là cột NOT NULL không đổi được:
 * phân quyền dòng, RLS và mọi "chỉ thấy trường mình" dựa vào nó. Đổi trường = tạo tài khoản mới.
 */
@Entity
@Table(name = "user_schools")
@DiscriminatorValue("SCHOOL")
@PrimaryKeyJoinColumn(name = "id")
public class SchoolUser extends User {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "school_id", nullable = false, updatable = false)
    private School school;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserPosition position = UserPosition.STAFF;

    @Column(name = "job_title", length = 255)
    private String jobTitle;

    protected SchoolUser() {
        // for JPA
    }

    public SchoolUser(String username, String email, String passwordHash, String fullName, UserStatus status,
            School school) {
        super(username, email, passwordHash, fullName, status);
        this.school = school;
    }

    @Override
    public UserType getUserType() {
        return UserType.SCHOOL;
    }

    @PrePersist
    @PreUpdate
    void syncPosition() {
        position = UserPosition.fromRoles(getRoles().stream().map(Role::getCode).toList());
    }

    public School getSchool() {
        return school;
    }

    @Override
    public School schoolOrNull() {
        return school;
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
}
