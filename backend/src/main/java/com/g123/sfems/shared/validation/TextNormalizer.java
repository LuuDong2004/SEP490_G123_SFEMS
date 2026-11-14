package com.g123.sfems.shared.validation;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Chuẩn hoá MỌI chuỗi đi vào qua JSON, trước khi kiểm tra và trước khi lưu:
 *
 * <ul>
 *   <li>Unicode dạng dựng sẵn (NFC). Chữ có dấu gõ từ Word, macOS hay dán từ PDF thường ở dạng tổ hợp ("e" +
 *       dấu): nhìn giống hệt nhưng là chuỗi khác, nên tìm kiếm, chống trùng và sắp xếp hụt.</li>
 *   <li>Bỏ ký tự vô hình (zero-width, BOM, gạch mềm) — dán từ web hay kéo theo, làm "P101" ≠ "P101".</li>
 *   <li>Bỏ khoảng trắng hai đầu.</li>
 * </ul>
 *
 * <p>Chuỗi rỗng vẫn là chuỗi rỗng, KHÔNG thành {@code null}: ở PATCH, {@code null} là "giữ nguyên" còn
 * {@code ""} là "xoá ô này".
 */
public final class TextNormalizer {

    private static final Pattern INVISIBLE = Pattern.compile("[\\u200B-\\u200D\\u2060\\uFEFF\\u00AD]");

    private TextNormalizer() {
    }

    public static String normalize(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        String s = Normalizer.isNormalized(value, Normalizer.Form.NFC)
                ? value
                : Normalizer.normalize(value, Normalizer.Form.NFC);
        if (INVISIBLE.matcher(s).find()) {
            s = INVISIBLE.matcher(s).replaceAll("");
        }
        return s.strip();
    }
}
