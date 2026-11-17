package com.g123.sfems.module.security.user.api.dto;

import com.g123.sfems.domain.security.user.UserType;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.security.role.Role;
import com.g123.sfems.domain.security.user.AgencyUser;
import com.g123.sfems.domain.security.user.SchoolUser;
import com.g123.sfems.domain.security.user.SystemUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserPosition;
import com.g123.sfems.domain.security.user.UserStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Wire shape of a user.
 *
 * <p>No password field of any kind, hashed or otherwise: this record is the
 * only way a user leaves the application, so the hash having no place to go is
 * what guarantees it never does.
 *
 * <p>{@code roles} is nested rather than flattened to an id list because the
 * list view renders the role names as badges and the form binds its
 * multi-select to the objects it was given.
 */
public record UserResponse(
        Long id,
        String username,
        String email,
        String fullName,
        /** Loại tài khoản — cố định từ lúc tạo. */
        UserType userType,
        UserStatus status,
        List<RoleSummary> roles,
        /** Null for an account that has not been placed. */
        /** Rỗng với tài khoản chưa thuộc trường nào. */
        SchoolSummary school,
        /** Phạm vi cơ sở của tài khoản trường; rỗng = cả trường. */
        CampusSummary campus,
        ManagingBodySummary managingBody,
        /** Phần riêng theo loại tài khoản (bảng con). */
        Profile profile,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt) {

    /**
     * The role as this endpoint reports it.
     *
     * <p>Deliberately narrower than the role resource's own response — no
     * permission list, which a user row has no use for — and declared here
     * rather than imported so that widening the role endpoint cannot silently
     * widen this one.
     */
    public record RoleSummary(Long id, String code, String name) {

        static RoleSummary from(Role role) {
            return new RoleSummary(role.getId(), role.getCode(), role.getName());
        }
    }

    /**
     * Trường như endpoint này báo cáo — hẹp hơn payload của chính resource
     * trường, và khai ngay ở đây chứ không import DTO của feature kia: một
     * feature không dùng {@code api/dto} của feature khác, để nới rộng payload
     * bên đó không lặng lẽ nới rộng payload bên này.
     */
    /**
     * Cơ quan quản lý của tài khoản, đủ để hiển thị và đủ để biết loại.
     *
     * <p>Mang cả {@code type} vì màn hình cần nói "Sở" hay "UBND" mà không
     * phải gọi thêm một request nữa — và vì loại là thứ giải thích phạm vi dữ
     * liệu mà tài khoản này có.
     *
     * <p>Khai báo riêng ở đây thay vì mượn DTO của slice tổ chức: một feature
     * không import {@code api/dto} của feature khác, nên nới rộng payload bên
     * kia không âm thầm nới rộng payload này.
     */
    public record ManagingBodySummary(Long id, String code, String name, ManagingBodyType type) {

        static ManagingBodySummary from(DepartmentOfEducation body) {
            return new ManagingBodySummary(
                    body.getId(), body.getCode(), body.getName(), body.getType());
        }
    }

    /** Cơ sở mà tài khoản bị giới hạn trong — đủ cho nhãn "Phạm vi". */
    public record CampusSummary(Long id, String name, boolean primary) {

        static CampusSummary of(User user) {
            if (!(user instanceof SchoolUser s) || s.getCampus() == null) {
                return null;
            }
            return new CampusSummary(s.getCampus().getId(), s.getCampus().getName(),
                    Boolean.TRUE.equals(s.getCampus().getPrimaryCampus()));
        }
    }

    public record SchoolSummary(Long id, String code, String name) {

        static SchoolSummary from(School school) {
            return new SchoolSummary(school.getId(), school.getCode(), school.getName());
        }
    }

    /**
     * Phần riêng theo loại — ô không thuộc loại để null. {@code position} suy từ vai (LEADER / STAFF), chỉ đọc.
     * {@code allowedIps} chỉ có ở tài khoản quản trị; danh sách tài khoản chỉ quản trị đọc được.
     */
    public record Profile(UserPosition position, String jobTitle, String workPhone, String note, Boolean superAdmin,
            String allowedIps) {

        static Profile from(User user) {
            return switch (user) {
                case SystemUser a -> new Profile(null, a.getJobTitle(), null, a.getNote(), a.isSuperAdmin(),
                        a.getAllowedIps());
                case AgencyUser a -> new Profile(a.getPosition(), a.getJobTitle(), a.getWorkPhone(), null, null, null);
                case SchoolUser s -> new Profile(s.getPosition(), s.getJobTitle(), null, null, null, null);
                default -> null;
            };
        }
    }

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getUserType(),
                user.getStatus(),
                user.getRoles().stream()
                        // Sorted by code so the badges keep a stable order
                        // rather than whatever order the join table returned.
                        .sorted(Comparator.comparing(Role::getCode))
                        .map(RoleSummary::from)
                        .toList(),
                user.schoolOrNull() == null ? null : SchoolSummary.from(user.schoolOrNull()),
                CampusSummary.of(user),
                user.managingBodyOrNull() == null
                        ? null
                        : ManagingBodySummary.from(user.managingBodyOrNull()),
                Profile.from(user),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getLastLoginAt());
    }
}
