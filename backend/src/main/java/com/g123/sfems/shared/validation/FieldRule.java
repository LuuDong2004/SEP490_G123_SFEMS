package com.g123.sfems.shared.validation;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Bộ quy tắc CHUẨN cho trường chữ — một chỗ duy nhất nói "tên dài tối đa bao nhiêu, mã gồm ký tự gì".
 *
 * <p>Mỗi trường chữ của một payload thuộc một kiểu ở đây và khai bằng {@link Text}. Độ dài mặc định của kiểu là
 * trần chung; cột nào trong CSDL ngắn hơn thì khai {@code max} riêng ở {@code @Text} — không bao giờ dài hơn cột,
 * nếu không chuỗi dài lọt qua kiểm tra rồi vỡ ở lúc ghi (500 trần thay vì 422 gọi đúng ô).
 *
 * <p>Frontend đọc cùng bộ này từ {@code frontend/src/shared/lib/field-rules.json} — tệp đó SINH từ enum này
 * ({@code FieldRulesExportTest}); sửa ở đây rồi chạy lại test với {@code UPDATE_FIELD_RULES=1}.
 * Biểu thức chính quy vì thế phải viết sao cho cả Java lẫn JavaScript (cờ {@code u}) hiểu như nhau.
 */
public enum FieldRule {

    /** Mã: không dấu, không khoảng trắng. 64 = độ dài cột mã của mọi bảng. */
    CODE(64, "^[A-Za-z0-9._-]*$", "chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch nối", null),

    /**
     * Số serial của nhà sản xuất: chữ không dấu, số và vài dấu ngăn thường gặp; tối đa 50 (serial của hãng thường 8–20).
     * Khoảng trắng bỏ đi rồi mới kiểm; lưu chữ HOA ({@link #normalize}).
     */
    SERIAL(50, "^[A-Za-z0-9./_-]*$", "chỉ gồm chữ không dấu, số, dấu chấm, gạch chéo, gạch dưới, gạch nối", "\\s"),

    /** Số hoá đơn: chữ không dấu, số, dấu / - . và khoảng trắng; tối đa 30 (cả ký hiệu lẫn số hoá đơn điện tử). */
    INVOICE_NO(30, "^[A-Za-z0-9/. -]*$", "chỉ gồm chữ không dấu, số, dấu / - . và khoảng trắng", null),

    /**
     * Tên một thứ (thiết bị, phòng, trường, năm học…): có ít nhất một chữ cái, bắt đầu bằng chữ / số / ngoặc / nháy,
     * chỉ gồm chữ, số, khoảng trắng và dấu câu của tên thật — {@code , . : ; / ( ) - – ' " & + % ° …} (dữ liệu thật
     * 27/11/2026: "Video/clip/…", "Sở GD&ĐT", "TT 37/2021 + 26/2023"). Chặn ký hiệu không có trong tên:
     * {@code @ # $ ^ * = < > { } [ ] | ~ ! ?} (trưởng nhóm: năm học tên "@@@@@123" từng lưu được).
     */
    NAME(255, "^(?=.*\\p{L})[\\p{L}\\p{N}(\"'][\\p{L}\\p{M}\\p{N} .,:;/()'\"&+%°…–_-]*$",
            "phải có chữ cái, chỉ gồm chữ, số, khoảng trắng và các dấu , . : ; / ( ) - ' \" & + %", null),

    /** Họ tên một người. */
    PERSON_NAME(100, "^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]*$", "chỉ gồm chữ cái, khoảng trắng, dấu nháy và gạch nối", null),

    /** Chữ ngắn một dòng: số hoá đơn, nhãn hiệu, model, người giao… */
    SHORT_TEXT(255, "^[^\\p{Cc}]*$", "không được chứa ký tự điều khiển", null),

    /** Ghi chú, lý do: nhiều dòng. */
    NOTE(500, "^[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$", "không được chứa ký tự điều khiển", null),

    /** Đoạn văn dài: mô tả chi tiết, nội dung biên bản. */
    LONG_TEXT(4000, "^[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$", "không được chứa ký tự điều khiển", null),

    ADDRESS(500, "^[^\\p{Cc}]*$", "không được chứa ký tự điều khiển", null),

    /**
     * Số văn bản: công văn, quyết định, biên bản, chứng từ ("125/QĐ-SGDĐT", "1234/SGDĐT-KHTC", "HD123") — có ít nhất
     * một chữ số, bắt đầu bằng chữ hoặc số, chỉ gồm chữ (kể cả Đ), số và {@code / - . _} khoảng trắng.
     */
    DOC_NO(50, "^(?=.*\\p{N})[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}/._ -]*$", "phải có chữ số, chỉ gồm chữ, số và / - . _", null),

    /**
     * Lý do, ý kiến bắt buộc (lý do đề xuất, trả lại, từ chối): như ghi chú nhiều dòng nhưng phải có chữ cái —
     * "....." hay "@@@" không phải một lý do (rà soát 27/11/2026). Kèm {@code min} ở chỗ dùng.
     */
    REASON(1000, "^(?=.*\\p{L})[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$", "phải có chữ, không chứa ký tự điều khiển", null),

    // Trần theo RFC 5321: cả địa chỉ 254, phần trước @ 64 ký tự. Phần trước @ không mở / đóng bằng dấu chấm, không hai
    // dấu chấm liền; mỗi nhãn tên miền không mở / đóng bằng gạch nối; đuôi 2–6 chữ cái (.vn, .com, .edu, .online) —
    // chặn "gmail.commmmm" (trưởng nhóm 27/11/2026).
    EMAIL(254, "^$|^(?!\\.)(?!.*\\.\\.)[A-Za-z0-9._%+-]{1,64}(?<!\\.)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,6}$",
            "không đúng định dạng (vd. ten@truong.edu.vn)", null),

    /**
     * Số điện thoại Việt Nam: bỏ khoảng trắng, chấm, gạch, ngoặc rồi phải là 0 hoặc +84 và 9–10 chữ số
     * (di động 10 số, cố định 11 số).
     */
    PHONE(20, "^$|^(\\+84|0)[0-9]{9,10}$", "không hợp lệ (vd. 0912 345 678)", "[ .()-]"),

    /** Mã số thuế: 10 số, chi nhánh thêm -3 số. */
    TAX_CODE(14, "^$|^[0-9]{10}(-[0-9]{3})?$", "không hợp lệ (10 số, chi nhánh thêm -3 số)", null),

    USERNAME(64, "^[A-Za-z0-9._-]*$", "chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch nối", null),

    URL(500, "^$|^https?://[^\\s]+$", "phải bắt đầu bằng http:// hoặc https://", null);

    private final int max;
    private final Pattern pattern;
    private final String regex;
    private final String patternMessage;
    private final String strip;

    FieldRule(int max, String regex, String patternMessage, String strip) {
        this.max = max;
        this.regex = regex;
        this.pattern = Pattern.compile(regex, Pattern.DOTALL);
        this.patternMessage = patternMessage;
        this.strip = strip;
    }

    public int max() {
        return max;
    }

    public String regex() {
        return regex;
    }

    public String patternMessage() {
        return patternMessage;
    }

    /** Ký tự bỏ đi trước khi so biểu thức (SĐT gõ "0912 345 678"); {@code null} là không bỏ gì. */
    public String strip() {
        return strip;
    }

    /**
     * Lỗi của {@code value} theo kiểu này, gắn sau nhãn ô ("tối đa 255 ký tự"), hoặc {@code null} khi hợp lệ.
     * Chuỗi rỗng / {@code null} luôn hợp lệ — bắt buộc hay không là việc của {@code @NotBlank}.
     */
    public String violation(String value, int maxOverride) {
        return violation(value, maxOverride, 0);
    }

    /** Như {@link #violation(String, int)}, thêm độ dài tối thiểu (đếm sau khi bỏ khoảng trắng hai đầu). */
    public String violation(String value, int maxOverride, int min) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        int limit = maxOverride > 0 ? maxOverride : max;
        if (value.codePointCount(0, value.length()) > limit) {
            return "tối đa " + limit + " ký tự";
        }
        String trimmed = value.strip();
        if (min > 0 && !trimmed.isEmpty() && trimmed.codePointCount(0, trimmed.length()) < min) {
            return "tối thiểu " + min + " ký tự";
        }
        String checked = strip == null ? value : value.replaceAll(strip, "");
        // "((((((" bỏ hết dấu ngăn cách thì thành rỗng — rỗng sau khi bỏ không phải là "không khai".
        if (checked.isEmpty()) {
            return patternMessage;
        }
        return pattern.matcher(checked).matches() ? null : patternMessage;
    }

    /** Giá trị đem lưu: SĐT bỏ dấu ngăn cách, email chữ thường, số serial bỏ khoảng trắng và viết hoa; kiểu khác giữ nguyên. */
    public String normalize(String value) {
        if (value == null) {
            return null;
        }
        return switch (this) {
            case PHONE -> value.replaceAll(strip, "").replaceFirst("^\\+84", "0");
            case EMAIL -> value.toLowerCase(Locale.ROOT);
            case SERIAL -> value.replaceAll(strip, "").toUpperCase(Locale.ROOT);
            default -> value;
        };
    }
}
