package com.g123.sfems.domain.catalog.facilitygroup;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Cấp áp dụng của khối / loại CSVC: lưu là chuỗi mã cấp học cách nhau dấu phẩy ({@code "TH,THCS"}), trống là mọi cấp.
 * Dự án chỉ có ba cấp phổ thông (mầm non đã bỏ), nên tập mã cố định ở đây.
 */
public final class FacilityLevels {

    public static final List<String> ALL = List.of("TH", "THCS", "THPT");
    private static final Set<String> KNOWN = Set.copyOf(ALL);

    private FacilityLevels() {
    }

    /** Danh sách mã → chuỗi lưu; đủ cả ba cấp hoặc trống thì {@code null} (mọi cấp). Mã lạ thì ném lỗi. */
    public static String join(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return null;
        }
        for (String code : codes) {
            if (!KNOWN.contains(code)) {
                throw new IllegalArgumentException(code);
            }
        }
        List<String> out = new ArrayList<>();
        for (String level : ALL) {
            if (codes.contains(level)) {
                out.add(level);
            }
        }
        return out.size() == ALL.size() ? null : String.join(",", out);
    }

    /** Chuỗi lưu → danh sách mã; trống là cả ba cấp. */
    public static List<String> split(String stored) {
        if (stored == null || stored.isBlank()) {
            return ALL;
        }
        return List.of(stored.split(","));
    }

    /** Khối / loại có áp cho cấp {@code level} không. */
    public static boolean applies(String stored, String level) {
        return stored == null || stored.isBlank() || split(stored).contains(level);
    }
}
