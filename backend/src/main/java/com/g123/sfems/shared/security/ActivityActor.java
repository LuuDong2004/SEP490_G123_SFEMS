package com.g123.sfems.shared.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Người thao tác cho nhật ký hoạt động khi request CHƯA mang phiên đăng nhập — đăng nhập, đăng xuất.
 *
 * <p>Nhật ký lấy người thao tác từ phiên của request; nhưng lúc gọi {@code /auth/login} thì chưa có phiên,
 * và {@code /auth/logout} chỉ mang refresh token. Thiếu chỗ này, mọi dòng đăng nhập / đăng xuất đều ghi
 * "Chưa đăng nhập" — đúng những dòng người quản trị hay tra nhất. Endpoint xác thực ghi lại ai đó vào
 * thuộc tính của request; bộ ghi nhật ký đọc lại ở cuối request.
 */
public final class ActivityActor {

    /** Id tài khoản (đăng nhập thành công, đăng xuất có token hợp lệ). */
    public static final String ID = "activity.actorId";
    /** Tên đăng nhập đã gõ — cho lần đăng nhập SAI, khi chưa biết tài khoản nào. */
    public static final String NAME = "activity.actorName";

    private ActivityActor() {
    }

    public static void id(HttpServletRequest request, Long userId) {
        if (request != null && userId != null) {
            request.setAttribute(ID, userId);
        }
    }

    public static void name(HttpServletRequest request, String name) {
        if (request != null && name != null && !name.isBlank()) {
            request.setAttribute(NAME, name.trim());
        }
    }
}
