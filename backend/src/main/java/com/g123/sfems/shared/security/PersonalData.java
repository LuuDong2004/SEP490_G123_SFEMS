package com.g123.sfems.shared.security;

/**
 * Che bớt dữ liệu cá nhân trên đường truyền (QLTB-250): số điện thoại giữ 2 số đầu và 3 số cuối
 * ({@code 09*****123}), email giữ ký tự đầu, ký tự cuối của phần tên và nguyên tên miền ({@code n*****a@truong.edu.vn}).
 * Đủ để người xem nhận ra "đúng người này", không đủ để gọi điện hay gửi thư.
 *
 * <p>Che ở MÁY CHỦ, không ở màn hình: dữ liệu không đến trình duyệt thì không lộ qua công cụ dev, qua xuất Excel
 * "tất cả" hay qua API. Ai được che, ai được xem đủ là việc của nơi dựng response (vd. {@code StaffResponse}).
 */
public final class PersonalData {

    private PersonalData() {
    }

    public static String phone(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String digits = value.replaceAll("\\s+", "");
        if (digits.length() <= 5) {
            return "*".repeat(digits.length());
        }
        return digits.substring(0, 2) + "*".repeat(digits.length() - 5) + digits.substring(digits.length() - 3);
    }

    public static String email(String value) {
        if (value == null || value.isBlank() || !value.contains("@")) {
            return value == null || value.isBlank() ? value : "*****";
        }
        int at = value.indexOf('@');
        String name = value.substring(0, at);
        String shown = name.length() <= 2 ? name.charAt(0) + "*"
                : name.charAt(0) + "*".repeat(Math.max(1, name.length() - 2)) + name.charAt(name.length() - 1);
        return shown + value.substring(at);
    }
}
