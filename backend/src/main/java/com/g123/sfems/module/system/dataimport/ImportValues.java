package com.g123.sfems.module.system.dataimport;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/**
 * Đổi chữ trong một ô thành giá trị, ghi lỗi bằng tiếng Việt vào danh sách thay
 * vì ném — một dòng có ba lỗi thì báo cả ba, không bắt người dùng sửa từng cái
 * một qua ba lần tải lên.
 */
final class ImportValues {

    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);

    private final Map<String, String> row;
    private final List<String> errors;

    ImportValues(Map<String, String> row, List<String> errors) {
        this.row = row;
        this.errors = errors;
    }

    String text(String key, String label, boolean required, int max) {
        String v = row.get(key);
        v = v == null ? null : v.trim();
        if (v == null || v.isEmpty()) {
            if (required) {
                errors.add("Thiếu " + label);
            }
            return null;
        }
        if (v.length() > max) {
            errors.add(label + " dài quá " + max + " ký tự");
            return v.substring(0, max);
        }
        return v;
    }

    Integer integer(String key, String label, Integer min, Integer max) {
        String v = text(key, label, false, 40);
        if (v == null) {
            return null;
        }
        try {
            int n = new BigDecimal(v.replace(" ", "")).intValueExact();
            if ((min != null && n < min) || (max != null && n > max)) {
                errors.add(label + " phải từ " + min + " đến " + max);
            }
            return n;
        } catch (NumberFormatException | ArithmeticException e) {
            errors.add(label + " không phải số nguyên: \"" + v + "\"");
            return null;
        }
    }

    BigDecimal money(String key, String label) {
        String v = text(key, label, false, 40);
        if (v == null) {
            return null;
        }
        String cleaned = v.replace(" ", "").replace("đ", "").replace("₫", "");
        // 12.500.000 hay 12,500,000 kiểu Việt: bỏ dấu phân cách hàng nghìn.
        if (cleaned.matches("\\d{1,3}([.,]\\d{3})+")) {
            cleaned = cleaned.replace(".", "").replace(",", "");
        }
        try {
            BigDecimal n = new BigDecimal(cleaned);
            if (n.signum() < 0) {
                errors.add(label + " không được âm");
            }
            return n;
        } catch (NumberFormatException e) {
            errors.add(label + " không phải số: \"" + v + "\"");
            return null;
        }
    }

    /** dd/MM/yyyy, yyyy-MM-dd, hoặc số ngày kiểu Excel. */
    LocalDate date(String key, String label) {
        String v = text(key, label, false, 40);
        if (v == null) {
            return null;
        }
        if (v.matches("\\d{4,6}(\\.\\d+)?")) {
            return EXCEL_EPOCH.plusDays((long) Double.parseDouble(v));
        }
        for (String pattern : List.of("d/M/yyyy", "yyyy-MM-dd", "d-M-yyyy", "d.M.yyyy")) {
            try {
                return LocalDate.parse(v, DateTimeFormatter.ofPattern(pattern));
            } catch (DateTimeParseException e) {
                // thử mẫu tiếp theo
            }
        }
        errors.add(label + " không phải ngày (dd/mm/yyyy): \"" + v + "\"");
        return null;
    }

    /**
     * Một giá trị liệt kê, nhận cả tên hằng lẫn nhãn tiếng Việt, không phân biệt
     * dấu và hoa thường — người nhập gõ "Tốt", "tot" hay "TOT" đều được.
     */
    <E extends Enum<E>> E choice(String key, String label, Class<E> type, Function<E, String> labelOf) {
        String v = text(key, label, false, 100);
        if (v == null) {
            return null;
        }
        String wanted = fold(v);
        for (E e : type.getEnumConstants()) {
            String display = labelOf == null ? null : labelOf.apply(e);
            if (fold(e.name()).equals(wanted) || (display != null && fold(display).equals(wanted))) {
                return e;
            }
        }
        errors.add(label + " không hợp lệ: \"" + v + "\"");
        return null;
    }

    static String fold(String s) {
        String n = Normalizer.normalize(s.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        return n.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }
}
