package com.g123.sfems.module.school.facility;

/**
 * MỘT định nghĩa cho mọi số tổng hợp CSVC — thông tin chung, biểu số liệu, mức độ chuẩn, đáp ứng thiết bị, báo cáo
 * phòng theo chuẩn. Đổi luật ở đây là đổi cho tất cả; không tự viết lại điều kiện ở nơi dùng.
 *
 * <ul>
 *   <li><b>Hạng mục được tính</b> ({@link #COUNTED_ROOM}): chưa xoá, không "ngừng sử dụng". (Cơ chế
 *       xác nhận hiện trạng của 202 đã bỏ — 240.) Danh sách kiểm kê, đặt phòng không dùng luật này (chúng cần mọi
 *       phòng còn dùng).</li>
 *   <li><b>Học sinh, lớp</b> ({@link #CLASS_COUNTS}, {@link #CLASS_COUNTS_BY_CAMPUS}): CHỈ từ các lớp đang dùng của
 *       năm học hiện hành ({@code school_classes}). Không có nguồn thứ hai: trường chưa có lớp năm nay thì số là
 *       {@code null} và nơi dùng báo {@link #NO_CLASSES}, không mượn số khác. Học sinh = cộng sĩ số đã khai (lớp sĩ
 *       số trống / 0 không cộng, đếm ở {@code missing_size}); chưa lớp nào có sĩ số thì {@code students} là null.</li>
 * </ul>
 */
public final class FacilityCounting {

    /** Hạng mục được tính (bí danh {@code r} = {@code rooms}); có khoảng trắng hai đầu. */
    public static final String COUNTED_ROOM =
            " r.active AND r.usage_status IS DISTINCT FROM 'NGUNG_SU_DUNG' ";

    /** Lời báo khi trường chưa có lớp năm học hiện hành. */
    public static final String NO_CLASSES = "Chưa có danh sách lớp năm học hiện hành";

    /**
     * Mỗi trường có lớp năm nay một dòng: {@code school_id, classes, students, missing_size}. Dùng như bảng con —
     * {@code LEFT JOIN (CLASS_COUNTS) cl ON cl.school_id = s.id}; trường không có dòng = chưa có lớp.
     */
    public static final String CLASS_COUNTS = """
            SELECT k.school_id, count(*) AS classes, sum(nullif(k.student_count, 0)) AS students,
                   count(*) FILTER (WHERE COALESCE(k.student_count, 0) = 0) AS missing_size
            FROM school_classes k
            JOIN school_years y ON y.id = k.school_year_id AND y.is_current
            WHERE k.active
            GROUP BY k.school_id""";

    /**
     * Cơ sở THỰC của một hạng mục (MỘT luật cho đếm lớp theo cơ sở, phạm vi cơ sở của tài khoản, bộ lọc Cơ sở): cơ sở
     * ghi trên nó ({@code campusIdExpr} — với phòng là {@code COALESCE(phòng, khối nhà)}) nếu cơ sở đó còn dùng và
     * cùng trường; không thì cơ sở chính của trường; trường chưa có cơ sở chính thì null (= trường chính). Hai bí danh
     * {@code own}, {@code main} — giá trị là {@link #EFFECTIVE_CAMPUS}.
     */
    public static String campusJoins(String campusIdExpr, String schoolIdExpr) {
        return " LEFT JOIN campuses own ON own.id = " + campusIdExpr + " AND own.school_id = " + schoolIdExpr
                + " AND own.active"
                + " LEFT JOIN campuses main ON main.school_id = " + schoolIdExpr + " AND main.is_primary AND main.active ";
    }

    /** Cơ sở thực sau {@link #campusJoins}. */
    public static final String EFFECTIVE_CAMPUS = "COALESCE(own.id, main.id)";

    /**
     * Chia theo cơ sở: {@code school_id, campus_id, classes, students, missing_size}. Cơ sở của lớp = cơ sở của phòng
     * học của lớp (ghi trên phòng, không thì của khối nhà). Lớp chưa gán phòng, phòng chưa có cơ sở hoặc cơ sở đã
     * xoá → cơ sở chính của trường; trường chưa có cơ sở chính thì {@code campus_id} null (= trường chính).
     * Cộng các dòng của một trường ra đúng số của {@link #CLASS_COUNTS}.
     */
    public static final String CLASS_COUNTS_BY_CAMPUS = """
            SELECT k.school_id, COALESCE(own.id, main.id) AS campus_id, count(*) AS classes,
                   sum(nullif(k.student_count, 0)) AS students,
                   count(*) FILTER (WHERE COALESCE(k.student_count, 0) = 0) AS missing_size
            FROM school_classes k
            JOIN school_years y ON y.id = k.school_year_id AND y.is_current
            LEFT JOIN rooms kr ON kr.id = k.room_id
            LEFT JOIN buildings kb ON kb.id = kr.building_id
            """ + campusJoins("COALESCE(kr.campus_id, kb.campus_id)", "k.school_id") + """
            WHERE k.active
            GROUP BY k.school_id, COALESCE(own.id, main.id)""";

    /** Mỗi phòng một dòng {@code room_id, school_id, campus_id} — cơ sở thực theo {@link #campusJoins}. */
    public static final String ROOM_CAMPUS = """
            SELECT kr.id AS room_id, kr.school_id, COALESCE(own.id, main.id) AS campus_id
            FROM rooms kr
            LEFT JOIN buildings kb ON kb.id = kr.building_id
            """ + campusJoins("COALESCE(kr.campus_id, kb.campus_id)", "kr.school_id");

    /** Mỗi khối nhà một dòng {@code building_id, school_id, campus_id}. */
    public static final String BUILDING_CAMPUS = """
            SELECT kb.id AS building_id, kb.school_id, COALESCE(own.id, main.id) AS campus_id
            FROM buildings kb
            """ + campusJoins("kb.campus_id", "kb.school_id");

    /** Mỗi cơ sở một dòng {@code campus_id (của chính nó), school_id, effective_id} — cơ sở đã xoá về cơ sở chính. */
    public static final String CAMPUS_CAMPUS = """
            SELECT kc.id AS campus_id, kc.school_id, COALESCE(own.id, main.id) AS effective_id
            FROM campuses kc
            """ + campusJoins("kc.id", "kc.school_id");

    /**
     * Biểu thức SQL: cơ sở thực của phòng {@code roomIdExpr} của một bản ghi thuộc trường {@code schoolIdExpr} —
     * phòng trống thì cơ sở chính. Câu con tương quan, cho SQL thuần lọc theo cơ sở (bảng thiết bị…).
     */
    public static String campusOfRoomSql(String roomIdExpr, String schoolIdExpr) {
        return "(SELECT COALESCE(own.id, main.id) FROM (SELECT 1) one"
                + " LEFT JOIN rooms kr ON kr.id = " + roomIdExpr
                + " LEFT JOIN buildings kb ON kb.id = kr.building_id"
                + campusJoins("COALESCE(kr.campus_id, kb.campus_id)", schoolIdExpr) + ")";
    }

    /**
     * Vế {@code AND …} lọc bản ghi (phòng {@code roomIdExpr}, trường {@code schoolIdExpr}) thuộc cơ sở
     * {@code campusParam} (một tham số, thường là {@code ?}); có khoảng trắng hai đầu.
     */
    public static String roomInCampusSql(String roomIdExpr, String schoolIdExpr, String campusParam) {
        return " AND " + campusOfRoomSql(roomIdExpr, schoolIdExpr) + " = " + campusParam + " ";
    }

    /**
     * Vế {@code AND …} lọc bản ghi mang cơ sở của chính nó ({@code campusIdExpr}: khối nhà, cơ sở, cán bộ — trống /
     * đã ngừng / khác trường → cơ sở chính) thuộc cơ sở {@code campusParam}; có khoảng trắng hai đầu.
     */
    public static String ownCampusInSql(String campusIdExpr, String schoolIdExpr, String campusParam) {
        return " AND (SELECT " + EFFECTIVE_CAMPUS + " FROM (SELECT 1) one" + campusJoins(campusIdExpr, schoolIdExpr)
                + ") = " + campusParam + " ";
    }

    /** {@link #CLASS_COUNTS} của một cơ sở ({@link #CLASS_COUNTS_BY_CAMPUS} lọc theo cơ sở) — cùng cột. */
    public static String classCountsOf(long campusId) {
        return "SELECT * FROM (" + CLASS_COUNTS_BY_CAMPUS + ") z WHERE z.campus_id = " + campusId;
    }

    private FacilityCounting() {
    }
}
