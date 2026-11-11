package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.shared.exception.ConflictException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Mã hai ký tự của trường — thành phần TR của mã tài sản ({@code 79.TR.MH.LT.STT.NC}), in trên tem nên chỉ cấp
 * MỘT lần và không tự đổi.
 *
 * <p>Thứ tự cấp: 01…99, A0…Z9, AA…ZZ (thứ tự cũ, 1.035 mã — mã đã cấp giữ nguyên), rồi 0A…9Z và 00. Đủ
 * 36 × 36 = 1.296 tổ hợp chữ / số, vì 1.035 không đủ cho 1.099 trường công lập của Sở (QLTB-612). Định dạng
 * vẫn đúng hai ký tự {@code [A-Z0-9]{2}} như {@code Equipment.STANDARD_CODE}, nên chuẩn mã tài sản không đổi.
 * Changelog {@code 214} cấp bù theo đúng thứ tự này — đổi thứ tự thì đổi cả hai.
 */
public final class SchoolShortCodes {

    private static final String DIGITS = "0123456789";
    private static final String LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    /** Mọi mã theo đúng thứ tự cấp. */
    public static final List<String> ORDER = build();

    private SchoolShortCodes() {
    }

    private static List<String> build() {
        List<String> out = new ArrayList<>(1296);
        for (int i = 1; i < 100; i++) {
            out.add(String.format("%02d", i));
        }
        for (char a : LETTERS.toCharArray()) {
            for (char d : DIGITS.toCharArray()) {
                out.add("" + a + d);
            }
        }
        for (char a : LETTERS.toCharArray()) {
            for (char b : LETTERS.toCharArray()) {
                out.add("" + a + b);
            }
        }
        for (char d : DIGITS.toCharArray()) {
            for (char a : LETTERS.toCharArray()) {
                out.add("" + d + a);
            }
        }
        out.add("00");
        return Collections.unmodifiableList(out);
    }

    /** Mã đầu tiên chưa có trong {@code taken} (so chữ hoa) và thêm nó vào {@code taken}. */
    public static String next(Set<String> taken) {
        for (String c : ORDER) {
            if (!taken.contains(c)) {
                taken.add(c);
                return c;
            }
        }
        throw new ConflictException("Đã hết mã hai ký tự để cấp cho trường mới");
    }

    public static String normalize(String code) {
        return code == null ? null : code.trim().toUpperCase(Locale.ROOT);
    }
}
