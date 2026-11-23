package com.g123.sfems.domain.security.user;

/**
 * Chức vụ của tài khoản đơn vị (Sở, UBND, trường): lãnh đạo hay chuyên viên / cán bộ. Suy từ vai hệ thống mỗi lần lưu
 * ({@code *_LEADER} → {@link #LEADER}), không gõ tay — vai là nguồn của quyền, chức vụ là cột để lọc và hiển thị.
 */
public enum UserPosition {
    /** Lãnh đạo Sở / lãnh đạo UBND / hiệu trưởng. */
    LEADER,
    /** Chuyên viên Sở / chuyên viên UBND / cán bộ trường. */
    STAFF;

    static UserPosition fromRoles(Iterable<String> roleCodes) {
        for (String code : roleCodes) {
            if (code.endsWith("_LEADER")) {
                return LEADER;
            }
        }
        return STAFF;
    }
}
