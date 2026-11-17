package com.g123.sfems.module.report;

import com.g123.sfems.module.report.ReportService.Column;
import com.g123.sfems.module.report.ReportService.Definition;
import com.g123.sfems.module.report.ReportService.Params;
import com.g123.sfems.module.report.ReportService.Report;
import com.g123.sfems.module.school.facility.FacilityCounting;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Biểu số liệu cơ sở vật chất — đúng các dòng của mẫu Sở GDĐT TP.HCM
 * ({@code FileMau_BaoCaoSoLieu.xlsx}): phần A thông tin chung (học sinh, đất, điểm trường, lớp, nhân sự, chỗ ăn /
 * ở / đọc), phần B hiện trạng CSVC theo khối — mỗi loại CSVC một dòng, số lượng và diện tích chia theo kết cấu
 * (kiên cố, bán kiên cố, tạm, nhờ / mượn / thuê).
 *
 * <p>Số tính từ dữ liệu đã có, không nhập riêng, theo {@link FacilityCounting}: hạng mục CSVC được tính (còn dùng,
 * không ngừng sử dụng), loại CSVC ({@code room_types} —
 * dòng của mẫu nối theo MÃ loại ở {@link #BLOCKS}; một hạng mục tính MỘT lần theo loại chính, không thêm ở loại dùng
 * kết hợp), cơ sở ({@code campuses}: trường chính / phân hiệu / điểm trường), hồ sơ trường (diện tích), lớp năm học
 * hiện hành (học sinh, lớp — chia theo cơ sở của phòng học của lớp) và cán bộ. Một trường thì là biểu của
 * trường đó; không chọn trường thì cộng mọi trường trong phạm vi ({@link VisibleSchools} qua
 * {@link ReportService#scope}).
 *
 * <p>Hạng mục không có chỗ trên mẫu (loại riêng của trường ngoài khối "Phòng khác", phòng bộ môn THPT, loại cũ)
 * KHÔNG thành dòng mới của mẫu — chúng đứng ở dòng ghi chú dưới bảng ({@code kind = note}), cùng số hạng mục chưa
 * khai kết cấu (có trong Tổng số, không ở cột kết cấu nào).
 *
 * <p>Mỗi dòng mang {@code kind}: {@code section} (A, B), {@code group} (khối), {@code item}, {@code info} (dòng
 * phần A — các cột kết cấu là "x" trên mẫu), {@code note}.
 */
final class CsvcStatisticsReport {

    static final String NAME = "csvc-statistics";

    static final Definition DEFINITION = new Definition(NAME, "Biểu số liệu cơ sở vật chất",
            "Biểu số liệu CSVC theo mẫu của Sở: học sinh, đất, lớp, nhân sự và từng loại phòng, khu — số lượng, "
                    + "diện tích theo kết cấu kiên cố, bán kiên cố, tạm, nhờ / mượn / thuê.",
            false, false, List.of());

    /** Kết cấu theo mẫu CSDL HCM ({@code rooms.structure}) và tiền tố cột tương ứng. */
    static final List<String> STRUCTURES = List.of("KIEN_CO", "BAN_KIEN_CO", "TAM", "NHO_MUON_THUE");
    static final List<String> PREFIXES = List.of("kc", "bkc", "tam", "nmt");

    private static final List<String> MANAGERS = List.of("HIEU_TRUONG", "PHO_HIEU_TRUONG");

    /** Một dòng loại CSVC của mẫu: các mã loại cộng vào nó. */
    record Item(String stt, String text, String unit, List<String> codes) {
    }

    /** Một khối của mẫu (2.1 … 2.7) — {@code group} là mã khối CSVC ({@code facility_groups.code}). */
    record Block(String stt, String text, String unit, String group, List<Item> items) {
    }

    private static Item item(String stt, String text, String unit, String... codes) {
        return new Item(stt, text, unit, List.of(codes));
    }

    /**
     * Phần B theo đúng thứ tự, chữ và đơn vị của mẫu. Mẫu là của THCS: phòng Đội Thiếu niên (TH) và Đoàn Thanh niên
     * (THPT) vào dòng "Phòng Đoàn, Đội", hai loại phòng kết hợp tương ứng vào dòng kết hợp — cùng một thứ ở cấp khác.
     */
    static final List<Block> BLOCKS = List.of(
            new Block("2.1", "1. Khối phòng học tập", "phòng", "05", List.of(
                    item("2.1.1", "- Phòng học", "phòng", "PHONG_HOC"),
                    item("2.1.2", "- Phòng học bộ môn Âm nhạc", "phòng", "PHONG_HOC_BO_MON_AM_NHAC"),
                    item("2.1.3", "- Phòng học bộ môn Mỹ thuật", "phòng", "PHONG_HOC_BO_MON_MY_THUAT"),
                    item("2.1.4", "- Phòng học bộ môn Công nghệ", "phòng", "PHONG_HOC_BO_MON_CONG_NGHE"),
                    item("2.1.5", "- Phòng học bộ môn Khoa học tự nhiên", "phòng", "PHONG_HOC_BO_MON_KHOA_HOC_TU_NHIEN"),
                    item("2.1.6", "- Phòng học bộ môn Khoa học xã hội", "phòng", "PHONG_HOC_BO_MON_KHOA_HOC_XA_HOI"),
                    item("2.1.7", "- Phòng học bộ môn Tin học", "phòng", "PHONG_MAY"),
                    item("2.1.8", "- Phòng học bộ môn Ngoại ngữ", "phòng", "PHONG_HOC_BO_MON_NGOAI_NGU"),
                    item("2.1.9", "- Phòng đa chức năng", "phòng", "PHONG_CHUC_NANG"))),
            new Block("2.2", "2. Khối phòng hỗ trợ học tập", null, "06", List.of(
                    item("2.2.1", "- Thư viện", "phòng", "THU_VIEN"),
                    item("2.2.2", "- Phòng thiết bị giáo dục", "phòng", "KHO"),
                    item("2.2.3", "- Phòng tư vấn học đường và hỗ trợ giáo dục học sinh khuyết tật học hòa nhập",
                            "phòng", "PHONG_TU_VAN_HOC_DUONG_VA_HO_TRO_GIAO"),
                    item("2.2.4", "- Phòng truyền thống", "phòng", "PHONG_TRUYEN_THONG"),
                    item("2.2.5", "- Phòng Đoàn, Đội", "phòng", "PHONG_DOAN_DOI", "PHONG_DOI_THIEU_NIEN",
                            "PHONG_DOAN_THANH_NIEN"),
                    item("2.2.6", "Phòng kết hợp đoàn đội và truyền thống (nếu dùng chung)", "phòng",
                            "PHONG_KET_HOP_DOAN_DOI_VA_TRUYEN_THONG", "PHONG_KET_HOP_PHONG_DOI_THIEU_NIEN_VA",
                            "PHONG_KET_HOP_TRUYEN_THONG_VOI_PHONG"))),
            new Block("2.3", "3. Khối hành chính quản trị", null, "04", List.of(
                    item("2.3.1", "- Phòng Hiệu trưởng", "phòng", "PHONG_HIEU_TRUONG"),
                    item("2.3.2", "- Phòng Phó Hiệu trưởng", "phòng", "PHONG_PHO_HIEU_TRUONG"),
                    item("2.3.3", "- Văn phòng", "phòng", "VAN_PHONG_TRUONG"),
                    item("2.3.4", "- Phòng bảo vệ", "phòng", "PHONG_BAO_VE"),
                    item("2.3.5", "- Khu vệ sinh giáo viên, cán bộ, nhân viên", "khu",
                            "KHU_VE_SINH_GIAO_VIEN_CAN_BO_NHAN_VIEN"),
                    item("2.3.6", "- Khu để xe của giáo viên, cán bộ, nhân viên", "khu",
                            "KHU_DE_XE_CUA_GIAO_VIEN_CAN_BO_NHAN_VIEN"))),
            new Block("2.4", "4. Khối phụ trợ", null, "03", List.of(
                    item("2.4.1", "- Phòng họp toàn thể cán bộ, giáo viên và nhân viên nhà trường", "phòng",
                            "PHONG_HOP"),
                    item("2.4.2", "- Phòng các tổ chuyên môn", "phòng", "PHONG_CAC_TO_CHUYEN_MON"),
                    item("2.4.3", "- Phòng Y tế học đường", "phòng", "PHONG_Y_TE"),
                    item("2.4.4", "- Nhà kho", "nhà", "NHA_KHO"),
                    item("2.4.5", "- Khu để xe học sinh", "khu", "KHU_DE_XE_HOC_SINH"),
                    item("2.4.6", "- Khu vệ sinh học sinh", "khu", "KHU_VE_SINH_HOC_SINH"),
                    item("2.4.7", "- Phòng nghỉ giáo viên", "phòng", "PHONG_NGHI_GIAO_VIEN"),
                    item("2.4.8", "- Phòng giáo viên", "phòng", "PHONG_GIAO_VIEN"),
                    item("2.4.9", "- Cổng, hàng rào", "hạng mục", "CONG_HANG_RAO"))),
            new Block("2.5", "5. Khu sân chơi, thể dục thể thao", null, "07", List.of(
                    item("2.5.1", "- Sân chơi chung", "sân", "SAN_CHOI_CHUNG"),
                    item("2.5.2", "- Sân thể dục thể thao", "sân", "SAN_THE_DUC_THE_THAO"),
                    item("2.5.3", "- Nhà đa năng", "nhà", "NHA_DA_NANG"))),
            new Block("2.6", "6. Khối phục vụ sinh hoạt", null, "08", List.of(
                    item("2.6.1", "- Nhà bếp", "nhà", "NHA_BEP"),
                    item("2.6.2", "- Kho bếp thực phẩm", "kho", "KHO_BEP_THUC_PHAM"),
                    item("2.6.3", "- Kho bếp lương thực", "kho", "KHO_BEP_LUONG_THUC"),
                    item("2.6.4", "- Kho bếp kết hợp lương thực và thực phẩm", "kho",
                            "KHO_BEP_KET_HOP_LUONG_THUC_VA_THUC_PHAM"),
                    item("2.6.5", "- Nhà ăn", "nhà", "NHA_AN"),
                    item("2.6.6", "- Nhà ở nội trú học sinh", "nhà", "NHA_O_NOI_TRU"),
                    item("2.6.7", "- Phòng quản lý học sinh", "phòng", "PHONG_QUAN_LY_HOC_SINH"),
                    item("2.6.8", "- Phòng sinh hoạt chung", "phòng", "PHONG_SINH_HOAT_CHUNG"),
                    item("2.6.9", "- Nhà văn hóa", "nhà", "NHA_VAN_HOA"))),
            new Block("2.7", "7. Khối phòng khác", null, "09", List.of(
                    item("2.7.1", "- Nhà Công vụ (phòng)", "phòng", "NHA_CONG_VU"),
                    item("2.7.2", "- Bể bơi", "bể", "BE_BOI"),
                    item("2.7.3", "- Hội trường", "phòng", "HOI_TRUONG"),
                    item("2.7.4", "- Phòng khác", "phòng", "KHAC"))));

    /** Dòng "Phòng khác" — nhận cả loại riêng của trường xếp vào khối 09. */
    private static final String OTHER_ITEM = "2.7.4";

    /** Ba dòng chia phòng học theo cơ sở (2.1.1.1 … 2.1.1.3). */
    private static final List<String[]> CLASSROOM_SPLIT = List.of(
            new String[] {"MAIN", "2.1.1.1", "Chia ra: + Phòng học tại trường chính/phân hiệu chính"},
            new String[] {"BRANCH", "2.1.1.2", "             + Phòng học tại phân hiệu phụ"},
            new String[] {"SITE", "2.1.1.3", "             + Phòng học tại điểm trường"});

    private static final Map<String, String> ITEM_OF_CODE = new HashMap<>();

    static {
        for (Block block : BLOCKS) {
            for (Item it : block.items()) {
                for (String code : it.codes()) {
                    ITEM_OF_CODE.put(code, it.stt());
                }
            }
        }
    }

    /** Phần đầu của biểu: cơ quan chủ quản, đơn vị, năm học. */
    record Header(String body, String unit, String schoolYear) {
    }

    /** Cộng dồn của một dòng phần B: tổng số, và số lượng / diện tích theo từng kết cấu. */
    private static final class Tally {
        long total;
        final long[] count = new long[STRUCTURES.size()];
        final BigDecimal[] area = new BigDecimal[STRUCTURES.size()];

        void add(String structure, long n, BigDecimal a) {
            total += n;
            int i = structure == null ? -1 : STRUCTURES.indexOf(structure);
            if (i < 0) {
                return;
            }
            count[i] += n;
            if (a != null) {
                area[i] = area[i] == null ? a : area[i].add(a);
            }
        }

        void add(Tally other) {
            total += other.total;
            for (int i = 0; i < count.length; i++) {
                count[i] += other.count[i];
                if (other.area[i] != null) {
                    area[i] = area[i] == null ? other.area[i] : area[i].add(other.area[i]);
                }
            }
        }

        /** Ghi vào dòng; số 0 để trống như mẫu (ô trống = không có). */
        void into(Map<String, Object> row) {
            row.put("total", total == 0 ? null : total);
            for (int i = 0; i < count.length; i++) {
                row.put(PREFIXES.get(i) + "_count", count[i] == 0 ? null : count[i]);
                row.put(PREFIXES.get(i) + "_area", count[i] == 0 ? null : plain(area[i]));
            }
        }
    }

    private final JdbcTemplate jdbc;
    private final ReportService reports;

    CsvcStatisticsReport(JdbcTemplate jdbc, ReportService reports) {
        this.jdbc = jdbc;
        this.reports = reports;
    }

    static List<Column> columns() {
        List<Column> cols = new ArrayList<>(List.of(new Column("stt", "STT", "text"),
                new Column("content", "Nội dung", "text"), new Column("unit", "Đơn vị", "text"),
                new Column("total", "Tổng số", "number")));
        List<String> labels = List.of("Kiên cố", "Bán kiên cố", "Tạm", "Nhờ, mượn, thuê");
        for (int i = 0; i < PREFIXES.size(); i++) {
            cols.add(new Column(PREFIXES.get(i) + "_count", labels.get(i) + " - Số lượng", "number"));
            cols.add(new Column(PREFIXES.get(i) + "_area", labels.get(i) + " - Tổng diện tích (m²)", "number"));
        }
        return cols;
    }

    Report build(Params p) {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(row("section", "1", "A. THÔNG TIN CHUNG", null));
        general(p, rows);
        rows.add(row("section", "2", "B. HIỆN TRẠNG CƠ SỞ VẬT CHẤT", null));
        facilities(p, rows);
        return new Report(NAME, DEFINITION.title(), reports.subtitle(p, null), columns(), rows);
    }

    // ------------------------------------------------------------------ phần A

    private void general(Params p, List<Map<String, Object>> rows) {
        String sc = "SELECT s.id FROM schools s WHERE TRUE" + reports.scope("s.id", p);
        // Diện tích, số cơ sở: từ hồ sơ trường và danh sách cơ sở. Chưa khai cơ sở nào thì trường là một điểm.
        Map<String, Object> a = jdbc.queryForMap("""
                WITH sc AS (SELECT s.id, s.land_area, s.construction_area FROM schools s WHERE s.id IN (%s)),
                cp AS (SELECT c.school_id, COUNT(*) AS campuses,
                              COUNT(*) FILTER (WHERE NOT c.is_primary AND c.branch) AS branches
                       FROM campuses c WHERE c.active AND c.school_id IN (SELECT id FROM sc)%s GROUP BY c.school_id)
                SELECT COUNT(*) AS schools, %s
                       SUM(GREATEST(COALESCE(cp.campuses, 0), 1)) AS sites, SUM(COALESCE(cp.branches, 0)) AS branches
                FROM sc LEFT JOIN cp ON cp.school_id = sc.id
                """.formatted(sc, p.campusId() == null ? " " : " AND c.id = " + p.campusId().longValue() + " ",
                // Diện tích đất / xây dựng chỉ khai cho cả trường — lọc một cơ sở thì để trống, không chia.
                p.campusId() == null ? "SUM(sc.land_area) AS land_area, SUM(sc.construction_area) AS construction_area,"
                        : "NULL::numeric AS land_area, NULL::numeric AS construction_area,"));
        // Học sinh, lớp: CHỈ lớp năm học hiện hành, chia theo cơ sở của phòng học của lớp (FacilityCounting).
        // Trường chưa có lớp năm nay không vào số — báo ở ghi chú, không mượn số khác.
        Map<String, Object> k = jdbc.queryForMap("""
                WITH kc AS (SELECT x.school_id, x.classes, x.students, x.missing_size,
                                  CASE WHEN c.id IS NULL OR c.is_primary THEN 'MAIN'
                                       WHEN c.branch THEN 'BRANCH' ELSE 'SITE' END AS kind
                           FROM (%s) x LEFT JOIN campuses c ON c.id = x.campus_id
                           WHERE x.school_id IN (%s)%s)
                SELECT COUNT(DISTINCT school_id) AS with_classes, SUM(classes) AS classes, SUM(students) AS students,
                       COALESCE(SUM(missing_size), 0) AS missing_size,
                       SUM(students) FILTER (WHERE kind = 'MAIN') AS main_students,
                       SUM(students) FILTER (WHERE kind = 'BRANCH') AS branch_students,
                       SUM(students) FILTER (WHERE kind = 'SITE') AS site_students,
                       SUM(classes) FILTER (WHERE kind = 'MAIN') AS main_classes,
                       SUM(classes) FILTER (WHERE kind = 'BRANCH') AS branch_classes,
                       SUM(classes) FILTER (WHERE kind = 'SITE') AS site_classes
                FROM kc
                """.formatted(FacilityCounting.CLASS_COUNTS_BY_CAMPUS, sc,
                p.campusId() == null ? " " : " AND x.campus_id = " + p.campusId().longValue() + " "));
        String managers = "('" + String.join("', '", MANAGERS) + "')";
        Map<String, Object> staff = jdbc.queryForMap("SELECT"
                + " COUNT(*) FILTER (WHERE t.position IN " + managers + ") AS managers,"
                + " COUNT(*) FILTER (WHERE t.position IS DISTINCT FROM 'HIEU_TRUONG'"
                + "  AND t.position IS DISTINCT FROM 'PHO_HIEU_TRUONG' AND t.staff_type = 'TEACHER') AS teachers,"
                + " COUNT(*) FILTER (WHERE t.position IS DISTINCT FROM 'HIEU_TRUONG'"
                + "  AND t.position IS DISTINCT FROM 'PHO_HIEU_TRUONG' AND t.staff_type <> 'TEACHER') AS employees"
                + " FROM staff t WHERE t.active" + reports.scope("t.school_id", p)
                + reports.campusOwn("t.campus_id", "t.school_id", p));
        // Chỗ ngủ nội trú: thông số "beds" của hạng mục; chưa khai thì lấy sức chứa.
        Map<String, Object> seats = jdbc.queryForMap("SELECT"
                + " COALESCE(SUM(r.capacity) FILTER (WHERE rt.code = 'NHA_AN'), 0) AS dining,"
                + " COALESCE(SUM(CASE WHEN r.params ->> 'beds' ~ '^[0-9]+([.][0-9]+)?$'"
                + "   THEN (r.params ->> 'beds')::numeric ELSE r.capacity END) FILTER (WHERE rt.code = 'NHA_O_NOI_TRU'), 0)"
                + "   AS boarding,"
                + " COALESCE(SUM(r.capacity) FILTER (WHERE rt.code = 'THU_VIEN'), 0) AS library"
                + " FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id"
                + " WHERE" + FacilityCounting.COUNTED_ROOM + reports.scope("r.school_id", p)
                + reports.campusRoom("r.id", "r.school_id", p));

        BigDecimal students = decimal(k.get("students"));
        BigDecimal land = decimal(a.get("land_area"));
        BigDecimal perStudent = students == null || land == null || students.signum() == 0 ? null
                : land.divide(students, 2, RoundingMode.HALF_UP);
        rows.add(info("1.1", "Số học sinh", "HS", k.get("students")));
        rows.add(info("1.1.1", "Trong đó: +Số học sinh tại trường chính/phân hiệu chính", "HS", k.get("main_students")));
        rows.add(info("1.1.2", "                +Số học sinh tại phân hiệu phụ", "HS", k.get("branch_students")));
        rows.add(info("1.1.3", "                +Số học sinh tại điểm trường", "HS", k.get("site_students")));
        rows.add(info("1.2", "Diện tích đất", "m2", plain(land)));
        rows.add(info("1.3", "Diện tích đất/học sinh", "m2/học sinh", perStudent));
        rows.add(info("1.4", "Diên tích xây dựng", "m2", plain(decimal(a.get("construction_area")))));
        rows.add(info("1.5", "Số phân hiệu", "phân hiệu", a.get("branches")));
        rows.add(info("1.6", "Số điểm trường", "điểm", a.get("sites")));
        rows.add(info("1.7", "Số lớp", "lớp", k.get("classes")));
        rows.add(info("1.7.1", "Số lớp tại trường chính/phân hiệu chính", "lớp", k.get("main_classes")));
        rows.add(info("1.7.2", "Số lớp tại phân hiệu phụ", "lớp", k.get("branch_classes")));
        rows.add(info("1.7.3", "Số lớp tại điểm trường", "lớp", k.get("site_classes")));
        rows.add(info("1.8", "Số cán bộ quản lý", "CBQL", staff.get("managers")));
        rows.add(info("1.9", "Số giáo viên", "GV", staff.get("teachers")));
        rows.add(info("1.10", "Số nhân viên", "NV", staff.get("employees")));
        rows.add(info("1.11", "Số chỗ trong nhà ăn", "chỗ", seats.get("dining")));
        rows.add(info("1.12", "Số chỗ trong nhà ở nội trú", "chỗ", plain(decimal(seats.get("boarding")))));
        rows.add(info("1.13", "Số chỗ trong thư viện", "chỗ", seats.get("library")));
        long schoolCount = count(a.get("schools"));
        long noClasses = schoolCount - count(k.get("with_classes"));
        if (noClasses > 0) {
            rows.add(note(schoolCount == 1 ? FacilityCounting.NO_CLASSES + " — chưa có số học sinh, số lớp."
                    : noClasses + " trường chưa có danh sách lớp năm học hiện hành — không có trong số học sinh, số lớp."));
        }
        long missingSize = count(k.get("missing_size"));
        if (missingSize > 0) {
            rows.add(note(missingSize + " lớp chưa có sĩ số — số học sinh chỉ cộng các lớp đã có sĩ số."));
        }
    }

    // ------------------------------------------------------------------ phần B

    private void facilities(Params p, List<Map<String, Object>> rows) {
        // Cơ sở của hạng mục: cơ sở ghi trên hạng mục, không thì cơ sở của khối nhà; không có = trường chính.
        List<Map<String, Object>> found = jdbc.queryForList("SELECT rt.code, rt.name, g.code AS grp,"
                + " CASE WHEN c.id IS NULL OR c.is_primary THEN 'MAIN' WHEN c.branch THEN 'BRANCH' ELSE 'SITE' END AS campus,"
                + " r.structure, COUNT(*) AS n, SUM(r.area) AS area"
                + " FROM rooms r LEFT JOIN room_types rt ON rt.id = r.room_type_id"
                + " LEFT JOIN facility_groups g ON g.id = rt.group_id"
                + " LEFT JOIN buildings b ON b.id = r.building_id"
                + " LEFT JOIN campuses c ON c.id = COALESCE(r.campus_id, b.campus_id)"
                + " WHERE" + FacilityCounting.COUNTED_ROOM + reports.scope("r.school_id", p)
                + reports.campusRoom("r.id", "r.school_id", p)
                + " GROUP BY rt.code, rt.name, g.code, 4, r.structure");
        Map<String, Tally> byItem = new HashMap<>();
        Map<String, Tally> classrooms = new HashMap<>();
        Map<String, Tally> outside = new LinkedHashMap<>();
        long unstructured = 0;
        for (Map<String, Object> f : found) {
            String code = (String) f.get("code");
            String structure = (String) f.get("structure");
            long n = ((Number) f.get("n")).longValue();
            BigDecimal area = decimal(f.get("area"));
            if (structure == null) {
                unstructured += n;
            }
            String stt = code == null ? null : ITEM_OF_CODE.get(code);
            if (stt == null && code != null && "09".equals(f.get("grp"))) {
                stt = OTHER_ITEM;
            }
            if (stt == null) {
                String name = code == null ? "Chưa phân loại" : (String) f.get("name");
                outside.computeIfAbsent(name, k -> new Tally()).add(structure, n, area);
                continue;
            }
            byItem.computeIfAbsent(stt, k -> new Tally()).add(structure, n, area);
            if ("PHONG_HOC".equals(code)) {
                classrooms.computeIfAbsent((String) f.get("campus"), k -> new Tally()).add(structure, n, area);
            }
        }
        for (Block block : BLOCKS) {
            Tally sum = new Tally();
            List<Map<String, Object>> children = new ArrayList<>();
            for (Item it : block.items()) {
                Tally t = byItem.getOrDefault(it.stt(), new Tally());
                sum.add(t);
                Map<String, Object> r = row("item", it.stt(), it.text(), it.unit());
                t.into(r);
                children.add(r);
                if ("2.1.1".equals(it.stt())) {
                    for (String[] split : CLASSROOM_SPLIT) {
                        Map<String, Object> s = row("item", split[1], split[2], "phòng");
                        classrooms.getOrDefault(split[0], new Tally()).into(s);
                        children.add(s);
                    }
                }
            }
            Map<String, Object> g = row("group", block.stt(), block.text(), block.unit());
            sum.into(g);
            rows.add(g);
            rows.addAll(children);
        }
        if (unstructured > 0) {
            rows.add(note("Chưa khai kết cấu: " + unstructured
                    + " hạng mục — có trong Tổng số, không ở cột kết cấu nào."));
        }
        if (!outside.isEmpty()) {
            List<String> parts = new ArrayList<>();
            outside.forEach((name, t) -> parts.add(name + " (" + t.total + ")"));
            rows.add(note("Không có dòng trên biểu, không tính vào bảng: " + String.join(", ", parts) + "."));
        }
    }

    // ------------------------------------------------------------------ đầu biểu

    /**
     * Một trường: cơ quan chủ quản và tên trường. Nhiều trường: cơ quan quản lý chung (một địa bàn) hoặc Sở, và
     * "Tổng hợp n trường". Năm học = năm học hiện tại.
     */
    Header header(Params p) {
        List<Map<String, Object>> schools = jdbc.queryForList("SELECT s.name, d.name AS body"
                + " FROM schools s LEFT JOIN departments_of_education d ON d.id = s.department_of_education_id"
                + " WHERE TRUE" + reports.scope("s.id", p) + " LIMIT 2");
        List<String> years = jdbc.queryForList(
                "SELECT name FROM school_years WHERE is_current ORDER BY start_date DESC LIMIT 1", String.class);
        String year = years.isEmpty() ? "" : years.getFirst().replaceFirst("(?i)^\\s*năm học\\s*:?\\s*", "");
        if (schools.size() == 1) {
            Map<String, Object> s = schools.getFirst();
            return new Header(upper((String) s.get("body")), upper((String) s.get("name")), year);
        }
        List<String> bodies = jdbc.queryForList("SELECT DISTINCT d.name FROM schools s"
                + " JOIN departments_of_education d ON d.id = s.department_of_education_id"
                + " WHERE TRUE" + reports.scope("s.id", p) + " LIMIT 2", String.class);
        String body = bodies.size() == 1 ? bodies.getFirst()
                : jdbc.queryForList("SELECT name FROM departments_of_education WHERE type = 'SO' ORDER BY id LIMIT 1",
                        String.class).stream().findFirst().orElse("");
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM schools s WHERE TRUE" + reports.scope("s.id", p),
                Integer.class);
        return new Header(upper(body), "TỔNG HỢP " + (count == null ? 0 : count) + " TRƯỜNG", year);
    }

    // ------------------------------------------------------------------ tiện ích

    private static Map<String, Object> row(String kind, String stt, String content, String unit) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("kind", kind);
        r.put("stt", stt);
        r.put("content", content);
        r.put("unit", unit);
        return r;
    }

    private static Map<String, Object> info(String stt, String content, String unit, Object value) {
        Map<String, Object> r = row("info", stt, content, unit);
        r.put("total", value);
        return r;
    }

    private static Map<String, Object> note(String text) {
        return row("note", null, text, null);
    }

    private static long count(Object v) {
        return v == null ? 0 : ((Number) v).longValue();
    }

    private static BigDecimal decimal(Object v) {
        return switch (v) {
            case null -> null;
            case BigDecimal d -> d;
            case Number n -> new BigDecimal(n.toString());
            default -> null;
        };
    }

    /** Bỏ số 0 thừa sau dấu phẩy mà không ra dạng mũ (2.16E+3). */
    static BigDecimal plain(BigDecimal v) {
        return v == null ? null : new BigDecimal(v.stripTrailingZeros().toPlainString());
    }

    private static String upper(String s) {
        return s == null ? "" : s.toUpperCase(Locale.forLanguageTag("vi"));
    }
}
