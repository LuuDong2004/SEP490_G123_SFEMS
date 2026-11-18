package com.g123.sfems.shared.security;

import org.springframework.security.access.AccessDeniedException;

/**
 * Khu quản trị từ chối: máy không nằm trong danh sách IP được phép, hoặc tài khoản SYSTEM chưa bật lớp xác thực thứ
 * hai. Vẫn là 403 như mọi lần thiếu quyền; thân trả lời có câu riêng và {@code adminBlock} để màn hình biết vì sao.
 */
public class AdminAccessDeniedException extends AccessDeniedException {

    /** Lý do: {@code ip} hoặc {@code mfa}. */
    public enum Reason { IP, MFA }

    public static final String IP_MESSAGE = "Máy này không được phép vào khu quản trị";
    public static final String MFA_MESSAGE = "Tài khoản quản trị phải bật xác thực hai lớp trước khi dùng hệ thống";

    private final Reason reason;

    private AdminAccessDeniedException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public static AdminAccessDeniedException ip() {
        return new AdminAccessDeniedException(Reason.IP, IP_MESSAGE);
    }

    public static AdminAccessDeniedException mfa() {
        return new AdminAccessDeniedException(Reason.MFA, MFA_MESSAGE);
    }

    public Reason getReason() {
        return reason;
    }
}
