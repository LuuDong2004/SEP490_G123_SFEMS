package com.g123.sfems.shared.security;

import com.g123.sfems.shared.exception.FieldValidationException;

/**
 * Chính sách mật khẩu (HSMT 3.6 — quản lý mật khẩu và tài khoản đặc quyền).
 *
 * <p>Ít nhất 8 ký tự, có chữ hoa, chữ thường, chữ số và một ký tự đặc biệt, và
 * không chứa tên đăng nhập. Kiểm ở server cho MỌI đường đặt mật khẩu — tạo tài
 * khoản, quản trị đặt lại, tự đổi — vì một form quên kiểm là một lối vòng.
 *
 * <p>Câu từ chối nói đúng điều còn thiếu, không phải "mật khẩu không hợp lệ":
 * người đặt mật khẩu cần biết phải thêm gì.
 */
public final class PasswordPolicy {

    private PasswordPolicy() {
    }

    /**
     * Mật khẩu bỏ mọi khoảng trắng (QLTB-508: "hệ thống tự xoá khoảng trắng"): dấu cách gõ nhầm đầu / cuối, hay
     * dán kèm xuống dòng, không thành một mật khẩu khác với cái người dùng nghĩ mình đặt. Áp ở MỌI chỗ nhận mật
     * khẩu — đặt, đổi, đăng nhập — để hai phía luôn so cùng một chuỗi.
     */
    public static String strip(String password) {
        return password == null ? null : password.replaceAll("\\s+", "");
    }

    public static void check(String field, String password, String username) {
        if (password == null || password.length() < 8) {
            throw new FieldValidationException(field, "Mật khẩu phải có ít nhất 8 ký tự");
        }
        if (password.chars().noneMatch(Character::isUpperCase)) {
            throw new FieldValidationException(field, "Mật khẩu phải có ít nhất một chữ hoa");
        }
        if (password.chars().noneMatch(Character::isLowerCase)) {
            throw new FieldValidationException(field, "Mật khẩu phải có ít nhất một chữ thường");
        }
        if (password.chars().noneMatch(Character::isDigit)) {
            throw new FieldValidationException(field, "Mật khẩu phải có ít nhất một chữ số");
        }
        if (password.chars().allMatch(Character::isLetterOrDigit)) {
            throw new FieldValidationException(field, "Mật khẩu phải có ít nhất một ký tự đặc biệt (vd. @ # !)");
        }
        if (username != null && username.length() >= 3
                && password.toLowerCase().contains(username.toLowerCase())) {
            throw new FieldValidationException(field, "Mật khẩu không được chứa tên đăng nhập");
        }
    }
}
