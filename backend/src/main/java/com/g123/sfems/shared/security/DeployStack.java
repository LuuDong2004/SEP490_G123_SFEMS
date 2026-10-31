package com.g123.sfems.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Môi trường đang chạy, theo tên STACK của {@code deploy/docker-compose.yml} (compose truyền vào qua
 * {@code APP_STACK}): {@code sfems_dev} (dev server), {@code sfems_main} (chính thức).
 * Trống là máy dev chạy {@code bootRun}.
 *
 * <p>Những thứ tiện cho thử nghiệm nhưng nguy hiểm ở bản chính thức — tài khoản demo, khoá JWT mặc định,
 * trang tài liệu API mở, nội dung thư ghi ra log — hỏi ở đây thay vì mỗi chỗ một biến môi trường: quên
 * đặt biến ở máy chủ chính thức là kiểu sai không ai thấy, còn tên STACK thì luôn có.
 */
@Component
public class DeployStack {

    public static final String PRODUCTION = "sfems_main";

    private final String stack;

    public DeployStack(@Value("${app.stack:}") String stack) {
        this.stack = stack == null ? "" : stack.trim();
    }

    /** Chạy trong một stack của máy chủ (dev server, UAT, chính thức), không phải máy dev. */
    public boolean deployed() {
        return !stack.isEmpty();
    }

    /** Bản chính thức — người ngoài với tới được. */
    public boolean production() {
        return PRODUCTION.equals(stack);
    }

    public String name() {
        return stack.isEmpty() ? "local" : stack;
    }
}
