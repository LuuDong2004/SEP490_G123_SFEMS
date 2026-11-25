package com.g123.sfems.shared.data.rls;

import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Phạm vi trường mà PostgreSQL áp cho một lần mượn kết nối (lớp chặn thứ 4, docs/kien-truc/03 mục "Lớp CSDL").
 *
 * <ul>
 * <li>{@link Mode#BYPASS} — không có người dùng (job, khởi động, Liquibase, đăng nhập): chính sách cho qua hết.</li>
 * <li>{@link Mode#ALL} — quản trị, Sở: thấy mọi trường.</li>
 * <li>{@link Mode#SCHOOLS} — trường, UBND: chỉ dòng có {@code school_id} thuộc {@link #schoolIds}. Tập rỗng là
 * không thấy gì.</li>
 * </ul>
 */
public record DbRowScope(Mode mode, Set<Long> schoolIds) {

    public enum Mode {
        BYPASS("bypass"),
        ALL("all"),
        SCHOOLS("school");

        private final String setting;

        Mode(String setting) {
            this.setting = setting;
        }

        /** Giá trị ghi vào {@code app.rls_mode} — các hàm chính sách so đúng chuỗi này. */
        public String setting() {
            return setting;
        }
    }

    private static final DbRowScope BYPASS = new DbRowScope(Mode.BYPASS, Set.of());
    private static final DbRowScope ALL = new DbRowScope(Mode.ALL, Set.of());

    public DbRowScope {
        schoolIds = Set.copyOf(schoolIds);
    }

    public static DbRowScope bypass() {
        return BYPASS;
    }

    public static DbRowScope all() {
        return ALL;
    }

    public static DbRowScope schools(Set<Long> ids) {
        return new DbRowScope(Mode.SCHOOLS, ids);
    }

    public boolean restricted() {
        return mode == Mode.SCHOOLS;
    }

    /** Mảng PostgreSQL {@code {1,2,3}} cho {@code app.rls_school_ids}; chỉ ghép số. */
    public String schoolIdsLiteral() {
        return new TreeSet<>(schoolIds).stream().map(String::valueOf).collect(Collectors.joining(",", "{", "}"));
    }
}
