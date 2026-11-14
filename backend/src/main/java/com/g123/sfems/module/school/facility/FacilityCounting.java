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
            LEFT JOIN campuses own ON own.id = COALESCE(kr.campus_id, kb.campus_id)
                                  AND own.school_id = k.school_id AND own.active
            LEFT JOIN campuses main ON main.school_id = k.school_id AND main.is_primary AND main.active
            WHERE k.active
            GROUP BY k.school_id, COALESCE(own.id, main.id)""";

    private FacilityCounting() {
    }
}
