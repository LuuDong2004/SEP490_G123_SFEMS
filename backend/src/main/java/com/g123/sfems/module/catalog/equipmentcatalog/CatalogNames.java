package com.g123.sfems.module.catalog.equipmentcatalog;

import com.g123.sfems.shared.web.ListParams;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * So tên thiết bị THEO TỪ — luật trùng tên của thiết bị ngoài danh mục, một chỗ cho cả ô kiểm lúc gõ lẫn lúc lưu.
 *
 * <p>So cả chuỗi thì chỉ bắt được tên gõ đúng từng ký tự: "Al bột", "Bột Al", "Al - Bột" đều lọt qua "Al (Bột)" và
 * trường thêm được một bản trùng. Ở đây bỏ dấu tiếng Việt, hoa thường và dấu câu, tách thành từ:
 * <ul>
 *   <li>CÙNG bộ từ (khác thứ tự, khác dấu câu) là TRÙNG — chặn;</li>
 *   <li>phần lớn từ chung ({@link #similarity} từ {@link #SIMILAR} trở lên) là GẦN GIỐNG — chỉ gợi ý.</li>
 * </ul>
 * Tên gọi khác hẳn (Al / nhôm) thì không bắt được — đó là việc của khung gợi ý và của người dùng.
 */
public final class CatalogNames {

    /** Ngưỡng gần giống: hệ số Dice của hai bộ từ. "Bột nhôm Al" với "Al (Bột)" = 0,8. */
    public static final double SIMILAR = 0.5;

    private CatalogNames() {
    }

    /** Các từ của tên, đã bỏ dấu và dấu câu, không lặp, giữ thứ tự. */
    public static Set<String> words(String name) {
        if (name == null) {
            return Set.of();
        }
        String plain = ListParams.fold(name).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        if (plain.isEmpty()) {
            return Set.of();
        }
        return new LinkedHashSet<>(Arrays.asList(plain.split(" ")));
    }

    /** Hai tên trùng: cùng một bộ từ. */
    public static boolean same(String a, String b) {
        Set<String> wa = words(a);
        return !wa.isEmpty() && wa.equals(words(b));
    }

    /** Độ giống của hai bộ từ (Dice): 2 × số từ chung / tổng số từ. 1 là cùng bộ từ, 0 là không chung từ nào. */
    public static double similarity(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        long common = a.stream().filter(b::contains).count();
        return 2.0 * common / (a.size() + b.size());
    }

    /**
     * Từ dùng để LỌC SƠ ứng viên trong CSDL: từ hai ký tự trở lên (từ một ký tự khớp gần như mọi tên); tên chỉ gồm
     * từ một ký tự thì lấy hết.
     */
    public static List<String> searchWords(Set<String> words) {
        List<String> longer = words.stream().filter(w -> w.length() >= 2).toList();
        return longer.isEmpty() ? List.copyOf(words) : longer;
    }
}
