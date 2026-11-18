package com.g123.sfems.shared.security;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.web.util.matcher.IpAddressMatcher;

/** Danh sách IP / dải CIDR của khu quản trị: kiểm cú pháp lúc lưu, so khớp lúc đăng nhập. */
public final class AdminIps {

    private AdminIps() {
    }

    /**
     * Chuẩn hoá chữ người gõ ("10.0.0.1, 10.1.0.0/16") thành danh sách cách nhau ", "; rỗng thành null. Một mục sai cú
     * pháp là lỗi — danh sách IP gõ hỏng mà bị bỏ qua lặng lẽ là khu quản trị mở toang.
     */
    public static String normalize(String raw) {
        List<String> items = split(raw);
        for (String item : items) {
            try {
                new IpAddressMatcher(item);
            } catch (IllegalArgumentException e) {
                throw new FieldValidationException("profile.allowedIps",
                        "IP không hợp lệ: " + item);
            }
        }
        return items.isEmpty() ? null : String.join(", ", items);
    }

    /** {@code ip} có khớp một mục của {@code list} không. Danh sách rỗng = không giới hạn. */
    public static boolean matches(List<String> list, String ip) {
        if (list.isEmpty()) {
            return true;
        }
        if (ip == null || ip.isBlank()) {
            return false;
        }
        try {
            return list.stream().map(IpAddressMatcher::new).anyMatch(matcher -> matcher.matches(ip));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    static List<String> split(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split("[,;\s]+")).map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
