package com.g123.sfems.domain.security.permission;

import com.g123.sfems.domain.security.user.UserType;

/**
 * Phạm vi của một quyền (docs/kien-truc/11 §11, theo PermissionScope của qlvb-app). Lưu ở {@code permissions.scope};
 * CSDL chặn gán sai loại (changelog 235).
 */
public enum PermissionScope {
    /** Chỉ quản trị hệ thống: tài khoản, vai, phạm vi dòng, tích hợp, nhật ký… */
    SYSTEM("Quản trị hệ thống"),
    /** Nghiệp vụ: Sở, trường — và quản trị (chỉ xem, xuất; phần ghi theo {@code PermissionGrants}). */
    ORGANIZATION("Nghiệp vụ đơn vị"),
    /** Mọi loại tài khoản: thông báo, danh bạ đơn vị (xem). */
    COMMON("Dùng chung");

    private final String label;

    PermissionScope(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Vai loại {@code roleType} có được mang quyền phạm vi này không. */
    public boolean fits(UserType roleType) {
        return switch (this) {
            case COMMON -> true;
            case SYSTEM -> roleType == UserType.SYSTEM;
            // Quản trị xem được nghiệp vụ để hỗ trợ; quyền nào trong nhóm này vai quản trị mang được thì
            // PermissionGrants quyết định. Vai Sở / trường không bao giờ mang quyền quản trị.
            case ORGANIZATION -> true;
        };
    }
}
