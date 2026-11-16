package com.g123.sfems.shared.security;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.security.SecureRandom;
import java.util.Collection;
import java.util.Locale;
import java.util.Set;

/**
 * Chính sách mật khẩu (HSMT 3.6; HSDT TL4.1.11 — chính sách mật khẩu).
 *
 * <p>Ít nhất 8 ký tự (12 với tài khoản quyền cao — {@link #PRIVILEGED_ROLES}), có chữ hoa, chữ thường, chữ số và
 * một ký tự đặc biệt; không chứa tên đăng nhập, không chứa dãy liên tiếp ("1234", "abcd", "aaaa") và phần chữ
 * không phải một mật khẩu phổ biến ("Password@1", "Admin@123"). Kiểm ở server cho MỌI đường đặt mật khẩu — tạo
 * tài khoản, quản trị đặt lại, tự đổi, quên mật khẩu — vì một form quên kiểm là một lối vòng. Đăng nhập KHÔNG
 * kiểm: luật mới không khoá ai ở ngoài, chỉ áp từ lần đặt kế tiếp.
 *
 * <p>Câu từ chối nói đúng điều còn thiếu, không phải "mật khẩu không hợp lệ": người đặt mật khẩu cần biết phải
 * thêm gì. Frontend có bản sao các luật ở {@code shared/lib/password-policy.ts} — đổi một bên phải đổi bên kia.
 */
public final class PasswordPolicy {

    /** Vai đọc / ghi dữ liệu toàn ngành hoặc quản trị hệ thống. */
    public static final Set<String> PRIVILEGED_ROLES = Set.of("ADMIN", "SO_SPECIALIST", "SO_LEADER");

    private static final SecureRandom RANDOM = new SecureRandom();

    public static final int MIN_LENGTH = 8;
    public static final int PRIVILEGED_MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 128;

    /** Phần chữ (bỏ số, ký tự đặc biệt) của mật khẩu hay bị đoán nhất. */
    private static final Set<String> COMMON = Set.of(
            "password", "passw", "pass", "matkhau", "admin", "administrator", "qwerty", "qwertyuiop", "asdfgh",
            "abc", "abcabc", "iloveyou", "welcome", "letmein", "login", "user", "test", "demo", "root", "master",
            "secret", "changeme", "default", "hello", "monkey", "dragon", "football", "sunshine", "princess",
            "qltb", "sfems", "giaoduc", "truonghoc", "vietnam", "hcm", "saigon");

    private PasswordPolicy() {
    }

    /**
     * Mật khẩu bỏ mọi khoảng trắng ("hệ thống tự xoá khoảng trắng"): dấu cách gõ nhầm đầu / cuối, hay
     * dán kèm xuống dòng, không thành một mật khẩu khác với cái người dùng nghĩ mình đặt. Áp ở MỌI chỗ nhận mật
     * khẩu — đặt, đổi, đăng nhập — để hai phía luôn so cùng một chuỗi.
     */
    public static String strip(String password) {
        return password == null ? null : password.replaceAll("\\s+", "");
    }

    public static boolean privileged(Collection<String> roleCodes) {
        return roleCodes != null && roleCodes.stream().anyMatch(PRIVILEGED_ROLES::contains);
    }

    public static void check(String field, String password, String username) {
        check(field, password, username, false);
    }

    public static void check(String field, String password, String username, boolean privileged) {
        int min = privileged ? PRIVILEGED_MIN_LENGTH : MIN_LENGTH;
        if (password == null || password.length() < min) {
            throw new FieldValidationException(field, privileged
                    ? "Tài khoản quyền cao phải dùng mật khẩu ít nhất " + min + " ký tự"
                    : "Mật khẩu phải có ít nhất " + min + " ký tự");
        }
        if (password.length() > MAX_LENGTH) {
            throw new FieldValidationException(field, "Mật khẩu tối đa " + MAX_LENGTH + " ký tự");
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
                && password.toLowerCase(Locale.ROOT).contains(username.toLowerCase(Locale.ROOT))) {
            throw new FieldValidationException(field, "Mật khẩu không được chứa tên đăng nhập");
        }
        if (hasRun(password)) {
            throw new FieldValidationException(field,
                    "Mật khẩu không được chứa dãy liên tiếp hoặc lặp lại (vd. 1234, abcd, aaaa)");
        }
        String letters = password.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
        if (COMMON.contains(letters)) {
            throw new FieldValidationException(field, "Mật khẩu quá dễ đoán — đừng dùng từ phổ biến như \"password\", \"admin\"");
        }
    }

    /**
     * Mật khẩu tạm máy sinh cho tài khoản phía trường: 10 ký tự đủ bốn loại, bỏ ký tự dễ nhầm (I, l, O, 0, 1), và
     * sinh lại tới khi qua đúng luật ở trên — một dãy ngẫu nhiên vẫn có thể ra "2345".
     */
    public static String temporary() {
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghijkmnpqrstuvwxyz";
        String digit = "23456789";
        String special = "@#!";
        while (true) {
            StringBuilder sb = new StringBuilder();
            sb.append(upper.charAt(RANDOM.nextInt(upper.length())));
            for (int i = 0; i < 5; i++) {
                sb.append(lower.charAt(RANDOM.nextInt(lower.length())));
            }
            sb.append(special.charAt(RANDOM.nextInt(special.length())));
            for (int i = 0; i < 3; i++) {
                sb.append(digit.charAt(RANDOM.nextInt(digit.length())));
            }
            String candidate = sb.toString();
            try {
                check("password", candidate, null);
                return candidate;
            } catch (FieldValidationException retry) {
                // dãy liên tiếp hoặc lặp — sinh lại
            }
        }
    }

    /** Bốn ký tự liền nhau tăng dần, giảm dần hoặc giống nhau (không phân biệt hoa thường). */
    static boolean hasRun(String password) {
        String s = password.toLowerCase(Locale.ROOT);
        int up = 1;
        int down = 1;
        int same = 1;
        for (int i = 1; i < s.length(); i++) {
            int diff = s.charAt(i) - s.charAt(i - 1);
            boolean alnum = Character.isLetterOrDigit(s.charAt(i)) && Character.isLetterOrDigit(s.charAt(i - 1));
            up = alnum && diff == 1 ? up + 1 : 1;
            down = alnum && diff == -1 ? down + 1 : 1;
            same = diff == 0 ? same + 1 : 1;
            if (up >= 4 || down >= 4 || same >= 4) {
                return true;
            }
        }
        return false;
    }
}
