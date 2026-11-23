package com.g123.sfems.domain.security.user;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

/** Tài khoản Sở GD&ĐT ({@link UserType#SO}) — bảng con {@code user_sos}, phần chung ở {@link AgencyUser}. */
@Entity
@Table(name = "user_sos")
@DiscriminatorValue("SO")
@PrimaryKeyJoinColumn(name = "id")
public class SoUser extends AgencyUser {

    protected SoUser() {
        // for JPA
    }

    public SoUser(String username, String email, String passwordHash, String fullName, UserStatus status,
            DepartmentOfEducation managingBody) {
        super(username, email, passwordHash, fullName, status, managingBody);
    }

    @Override
    public UserType getUserType() {
        return UserType.SO;
    }
}
