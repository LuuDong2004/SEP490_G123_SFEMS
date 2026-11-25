package com.g123.sfems.shared.security;

import org.springframework.security.authentication.BadCredentialsException;

/**
 * Mật khẩu đúng, nhưng tài khoản bật xác thực qua email và chưa gửi mã. Vẫn là
 * 401 như mọi lần đăng nhập hỏng; khác ở chỗ thân trả lời có {@code mfaRequired},
 * để màn đăng nhập biết hiện ô nhập mã thay vì báo sai mật khẩu.
 */
public class MfaRequiredException extends BadCredentialsException {

    /**
     * Thuộc tính request đặt khi trả lời "cần mã" — bước bình thường của đăng nhập có mã qua email, không phải lần thử sai,
     * nên bộ giới hạn theo IP ({@code LoginRateLimitFilter}) không đếm nó.
     */
    public static final String PROMPTED = MfaRequiredException.class.getName() + ".prompted";

    public MfaRequiredException(String message) {
        super(message);
    }
}
