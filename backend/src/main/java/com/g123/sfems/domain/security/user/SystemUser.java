package com.g123.sfems.domain.security.user;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import java.util.Arrays;
import java.util.List;

/**
 * Tài khoản quản trị hệ thống ({@link UserType#SYSTEM}) — bảng con {@code user_systems}. Không gắn đơn vị, không
 * thấy dữ liệu nghiệp vụ. Quản trị cấp cao ({@code is_super_admin}) mới quản lý được tài khoản quản trị khác, và luôn
 * còn ít nhất một người đang hoạt động. {@code allowed_ips} siết thêm IP được đăng nhập của RIÊNG người này, trên
 * danh sách chung {@code app.portal.admin-allowed-ips}.
 */
@Entity
@Table(name = "user_systems")
@DiscriminatorValue("SYSTEM")
@PrimaryKeyJoinColumn(name = "id")
public class SystemUser extends User {

    @Column(name = "is_super_admin", nullable = false)
    private boolean superAdmin;

    /** IP / dải CIDR được đăng nhập, cách nhau bằng dấu phẩy. Rỗng = theo danh sách chung. */
    @Column(name = "allowed_ips", length = 1000)
    private String allowedIps;

    @Column(name = "job_title", length = 255)
    private String jobTitle;

    @Column(length = 500)
    private String note;

    protected SystemUser() {
        // for JPA
    }

    public SystemUser(String username, String email, String passwordHash, String fullName, UserStatus status) {
        super(username, email, passwordHash, fullName, status);
    }

    @Override
    public UserType getUserType() {
        return UserType.SYSTEM;
    }

    /** Danh sách IP riêng đã tách; rỗng = không siết thêm. */
    public List<String> allowedIpList() {
        if (allowedIps == null || allowedIps.isBlank()) {
            return List.of();
        }
        return Arrays.stream(allowedIps.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public boolean isSuperAdmin() {
        return superAdmin;
    }

    public void setSuperAdmin(boolean superAdmin) {
        this.superAdmin = superAdmin;
    }

    public String getAllowedIps() {
        return allowedIps;
    }

    public void setAllowedIps(String allowedIps) {
        this.allowedIps = allowedIps;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
