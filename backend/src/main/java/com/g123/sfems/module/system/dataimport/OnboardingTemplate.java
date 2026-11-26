package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.module.school.facilitystandard.FacilityStandardService;
import com.g123.sfems.module.school.procurement.AdequacyService;
import com.g123.sfems.module.school.procurement.AdequacyService.NormRow;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.office.XlsxWriter.Choice;
import com.g123.sfems.shared.office.XlsxWriter.Format;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tệp mẫu dữ liệu đầu vào ĐIỀN SẴN cho một trường — trường bổ sung chứ không khai từ đầu, để khỏi gõ sai tên, mã:
 * <ul>
 *   <li>Thiết bị: đủ danh mục tối thiểu của cấp học (mã DM, tên, môn, ĐVT, định mức, số phải có của trường) — trường
 *       chỉ ghi số lượng đang có, phòng, người quản lý…; dòng không ghi gì thêm thì bỏ qua khi nhập
 *       ({@link OnboardingService#detect}).</li>
 *   <li>Thiết bị ngoài danh mục: trang riêng có cột Môn.</li>
 *   <li>Phòng: mỗi loại CSVC chuẩn yêu cầu mà trường chưa có một dòng gợi ý (chỉ ghi loại) để không sót hạng mục.</li>
 *   <li>Cơ sở, cán bộ, khối nhà, phòng, lớp đã có trên hệ thống điền sẵn — nhập lại nhận ra dòng đã có, không tạo lại.</li>
 *   <li>Cột chỉ được chọn trong danh sách thành ô chọn (danh sách ở trang ẩn "Danh sách").</li>
 * </ul>
 * Không có trường (Sở, quản trị viên tải mẫu chung) thì chỉ có ô chọn, không điền sẵn.
 */
@Component
class OnboardingTemplate {

    private static final String LISTS = OnboardingService.TEMPLATE_MARK;
    private static final String STRICT = "!";

    private final JdbcTemplate jdbc;
    private final AdequacyService adequacy;
    private final FacilityStandardService facility;

    OnboardingTemplate(JdbcTemplate jdbc, AdequacyService adequacy, FacilityStandardService facility) {
        this.jdbc = jdbc;
        this.adequacy = adequacy;
        this.facility = facility;
    }

    @Transactional(readOnly = true)
    byte[] build(Long schoolId) {
        Lists lists = new Lists();
        Map<OnboardingSheet, List<Map<String, Object>>> rows = new LinkedHashMap<>();
        for (OnboardingSheet s : OnboardingSheet.values()) {
            rows.put(s, new ArrayList<>());
        }
        String schoolName = null;
        if (schoolId != null) {
            schoolName = jdbc.queryForList("SELECT name FROM schools WHERE id = ?", String.class, schoolId)
                    .stream().findFirst().orElse(null);
            prefillExisting(schoolId, rows);
            prefillEquipment(schoolId, rows.get(OnboardingSheet.EQUIPMENT));
            suggestRooms(schoolId, rows.get(OnboardingSheet.ROOM));
        } else {
            // Không biết trường (Sở, quản trị viên tải mẫu chung): vẫn điền sẵn đủ danh mục tối thiểu — trường chỉ ghi
            // số lượng, nguồn…; chỉ thiếu số "Phải có" (chưa biết lớp, giáo viên của trường nào).
            prefillCatalog(rows.get(OnboardingSheet.EQUIPMENT));
        }
        Map<OnboardingSheet, Map<String, Choice>> choices = choices(schoolId, lists);

        List<XlsxWriter.Tab> tabs = new ArrayList<>();
        for (OnboardingSheet s : OnboardingSheet.values()) {
            List<XlsxWriter.Column> columns = new ArrayList<>();
            Map<String, Object> hint = new HashMap<>();
            for (OnboardingSheet.Column c : s.columns()) {
                if (OMITTED.contains(s.name() + "." + c.key())) {
                    continue;
                }
                columns.add(new XlsxWriter.Column(c.key(), c.label() + (c.required() ? " (*)" : ""), "text"));
                hint.put(c.key(), HINTS.getOrDefault(s.name() + "." + c.key(), ""));
            }
            // Thiết bị: tên, mã DM, ĐVT của danh mục tối thiểu do hệ thống ghi sẵn (nền xám).
            Set<String> shaded = s == OnboardingSheet.EQUIPMENT ? Set.of("catalog", "name", "unit") : Set.of();
            List<Map<String, Object>> data = new ArrayList<>();
            data.add(hint);
            data.addAll(rows.get(s));
            String title = "Mẫu nhập: " + s.title() + (schoolName == null ? "" : " — " + schoolName);
            tabs.add(new XlsxWriter.Tab(s.title(), new XlsxWriter.Sheet(title, subtitle(s, schoolId != null), columns,
                    data, new Format(shaded, choices.getOrDefault(s, Map.of()), false, true))));
        }
        tabs.add(lists.tab());
        return XlsxWriter.writeAll(tabs);
    }

    /** Cột không đưa vào tệp mẫu (tệp khác có các cột này vẫn đọc được). */
    private static final Set<String> OMITTED = Set.of(
            "EQUIPMENT.legacy", "EQUIPMENT.tracking", "EQUIPMENT_OUTSIDE.legacy", "ROOM.unit");

    /**
     * Dòng hướng dẫn dưới tiêu đề của tệp mẫu — ngắn, kiểu biểu mẫu. Khi nhập, dòng có các chữ này được nhận ra là dòng
     * hướng dẫn và bỏ qua ({@link OnboardingService#detect}), cùng với chữ hướng dẫn của mẫu cũ.
     */
    static final Map<String, String> HINTS = Map.ofEntries(
            Map.entry("CAMPUS.code", "Vd: CS1"),
            Map.entry("CAMPUS.name", "Vd: Cơ sở chính"),
            Map.entry("CAMPUS.address", "Số nhà, đường, phường/xã"),
            Map.entry("CAMPUS.primary", "Có / Không"),
            Map.entry("STAFF.code", "Vd: CB0001"),
            Map.entry("STAFF.name", "Họ và tên đầy đủ"),
            Map.entry("STAFF.type", "Giáo viên / Cán bộ"),
            Map.entry("STAFF.position", "Chọn trong danh sách"),
            Map.entry("STAFF.team", "Vd: Tổ Toán"),
            Map.entry("STAFF.mainSubject", "Chọn trong danh sách"),
            Map.entry("STAFF.subjects", "Các môn, ngăn cách bằng dấu ;"),
            Map.entry("STAFF.department", "Đối với cán bộ, nhân viên"),
            Map.entry("BUILDING.code", "Vd: KA"),
            Map.entry("BUILDING.name", "Vd: Khối A"),
            Map.entry("BUILDING.campus", "Mã ở trang Cơ sở"),
            Map.entry("BUILDING.floors", "Số tầng"),
            Map.entry("BUILDING.year", "Vd: 2015"),
            Map.entry("BUILDING.area", "Đơn vị: m²"),
            Map.entry("BUILDING.condition", "Chọn trong danh sách"),
            Map.entry("BUILDING.manager", "Mã ở trang Cán bộ – giáo viên"),
            Map.entry("ROOM.code", "Vd: A.101"),
            Map.entry("ROOM.name", "Vd: Phòng học 101"),
            Map.entry("ROOM.building", "Mã ở trang Khối nhà"),
            Map.entry("ROOM.floor", "Vd: 1"),
            Map.entry("ROOM.roomType", "Chọn trong danh sách"),
            Map.entry("ROOM.structure", "Chọn trong danh sách"),
            Map.entry("ROOM.subject", "Đối với phòng học bộ môn"),
            Map.entry("ROOM.area", "Đơn vị: m²"),
            Map.entry("ROOM.capacity", "Số chỗ ngồi"),
            Map.entry("ROOM.condition", "Chọn trong danh sách"),
            Map.entry("ROOM.usage", "Chọn trong danh sách"),
            Map.entry("ROOM.manager", "Mã ở trang Cán bộ – giáo viên"),
            Map.entry("CLASS.code", "Vd: 10A1"),
            Map.entry("CLASS.grade", "Chọn trong danh sách"),
            Map.entry("CLASS.year", "Vd: 2026-2027"),
            Map.entry("CLASS.students", "Số học sinh"),
            Map.entry("CLASS.teacher", "Mã ở trang Cán bộ – giáo viên"),
            Map.entry("CLASS.room", "Mã ở trang Phòng"),
            Map.entry("STUDENT.code", "Vd: HS0001"),
            Map.entry("STUDENT.name", "Họ và tên đầy đủ"),
            Map.entry("STUDENT.class", "Mã ở trang Lớp học"),
            Map.entry("STUDENT.birthDate", "dd/mm/yyyy"),
            Map.entry("STUDENT.gender", "Nam / Nữ"),
            Map.entry("EQUIPMENT.name", "Theo danh mục"),
            Map.entry("EQUIPMENT.catalog", "Theo danh mục"),
            Map.entry("EQUIPMENT.quantity", "Số đang có; không có thì để trống"),
            Map.entry("EQUIPMENT.unit", "Theo danh mục"),
            Map.entry("EQUIPMENT.serial", "Khi số lượng là 1"),
            Map.entry("EQUIPMENT.room", "Mã ở trang Phòng; để trống là trong kho"),
            Map.entry("EQUIPMENT.manager", "Mã ở trang Cán bộ – giáo viên"),
            Map.entry("EQUIPMENT.originalValue", "Đồng / 1 cái"),
            Map.entry("EQUIPMENT.receivedDate", "dd/mm/yyyy"),
            Map.entry("EQUIPMENT.year", "Vd: 2020"),
            Map.entry("EQUIPMENT.origin", "Chọn trong danh sách"),
            Map.entry("EQUIPMENT.funding", "Chọn trong danh sách"),
            Map.entry("EQUIPMENT.condition", "Chọn trong danh sách"),
            Map.entry("EQUIPMENT_OUTSIDE.name", "Tên thiết bị"),
            Map.entry("EQUIPMENT_OUTSIDE.subject", "Chọn trong danh sách"),
            Map.entry("EQUIPMENT_OUTSIDE.quantity", "Để trống là 1"),
            Map.entry("EQUIPMENT_OUTSIDE.unit", "Bắt buộc với hóa chất, vật tư"),
            Map.entry("EQUIPMENT_OUTSIDE.tracking", "Từng cái / Theo lô"),
            Map.entry("EQUIPMENT_OUTSIDE.serial", "Khi số lượng là 1"),
            Map.entry("EQUIPMENT_OUTSIDE.room", "Mã ở trang Phòng; để trống là trong kho"),
            Map.entry("EQUIPMENT_OUTSIDE.manager", "Mã ở trang Cán bộ – giáo viên"),
            Map.entry("EQUIPMENT_OUTSIDE.originalValue", "Đồng / 1 cái"),
            Map.entry("EQUIPMENT_OUTSIDE.receivedDate", "dd/mm/yyyy"),
            Map.entry("EQUIPMENT_OUTSIDE.year", "Vd: 2020"),
            Map.entry("EQUIPMENT_OUTSIDE.origin", "Chọn trong danh sách"),
            Map.entry("EQUIPMENT_OUTSIDE.funding", "Chọn trong danh sách"),
            Map.entry("EQUIPMENT_OUTSIDE.condition", "Chọn trong danh sách"));

    /** Dòng 2 của trang — một câu ngắn. */
    private static String subtitle(OnboardingSheet s, boolean bySchool) {
        return switch (s) {
            case EQUIPMENT -> "Danh mục thiết bị tối thiểu đã ghi sẵn. Nhập số lượng thiết bị trường đang có; "
                    + "thiết bị không có thì để trống. Cột có dấu (*) là bắt buộc.";
            case EQUIPMENT_OUTSIDE -> "Thiết bị không có trong danh mục tối thiểu. Cột có dấu (*) là bắt buộc.";
            case ROOM -> bySchool
                    ? "Dòng chỉ có Loại CSVC là loại theo chuẩn trường chưa khai; nhập mã, tên để thêm, không có thì để "
                            + "trống. Cột có dấu (*) là bắt buộc."
                    : "Cột có dấu (*) là bắt buộc.";
            default -> "Cột có dấu (*) là bắt buộc.";
        };
    }

    // ------------------------------------------------------------------ điền sẵn

    /** Danh mục tối thiểu của cấp học trường, một dòng một thiết bị: tên, mã DM, ĐVT — xếp theo môn. */
    private void prefillEquipment(long schoolId, List<Map<String, Object>> out) {
        List<NormRow> norms = new ArrayList<>(adequacy.forSchool(schoolId).rows());
        norms.sort(Comparator.comparing((NormRow r) -> r.subjectName() == null ? "" : r.subjectName()));
        for (NormRow r : norms) {
            if (r.catalogCode() == null) {
                continue;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("catalog", r.catalogCode());
            row.put("name", r.normName());
            row.put("unit", r.unit());
            out.add(row);
        }
    }

    /**
     * Mẫu chung: danh mục tối thiểu của mọi bộ chuẩn đang áp dụng, một dòng một thiết bị (dòng của nhiều lớp / nhiều
     * mục cùng một thiết bị gộp lại): tên, mã DM, ĐVT — xếp theo cấp học rồi môn.
     */
    private void prefillCatalog(List<Map<String, Object>> out) {
        List<Map<String, Object>> norms = jdbc.queryForList("""
                SELECT DISTINCT ON (lv.code, c.id) lv.code AS level, c.code, c.name, sj.name AS subject,
                       COALESCE(nu.name, NULLIF(TRIM(n.unit_text), ''), cu.name) AS unit
                FROM equipment_norms n
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id
                JOIN equipment_catalogs c ON c.id = n.catalog_id
                LEFT JOIN subjects sj ON sj.id = n.subject_id
                LEFT JOIN units nu ON nu.id = n.unit_id
                LEFT JOIN units cu ON cu.id = c.unit_id
                WHERE n.active AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE)
                ORDER BY lv.code, c.id, n.optional, n.sort_order, n.id""");
        norms.sort(Comparator.comparing((Map<String, Object> n) -> (String) n.get("level"))
                .thenComparing(n -> n.get("subject") == null ? "" : (String) n.get("subject")));
        for (Map<String, Object> n : norms) {
            Map<String, Object> row = new HashMap<>();
            row.put("catalog", n.get("code"));
            row.put("name", n.get("name"));
            row.put("unit", n.get("unit"));
            out.add(row);
        }
    }

    /** Loại CSVC chuẩn yêu cầu mà trường chưa khai phòng nào: một dòng gợi ý (chỉ ghi loại). */
    private void suggestRooms(long schoolId, List<Map<String, Object>> out) {
        for (FacilityStandardService.Group g : facility.evaluate(schoolId).groups()) {
            for (FacilityStandardService.Item i : g.items()) {
                if (!i.hasRules() || i.count() > 0) {
                    continue;
                }
                Map<String, Object> row = new HashMap<>();
                row.put("roomType", i.name());
                out.add(row);
            }
        }
    }

    /** Dữ liệu trường đã có — nhập lại thì "đã có, không tạo lại", nên trường sửa / bổ sung trên chính các dòng này. */
    private void prefillExisting(long schoolId, Map<OnboardingSheet, List<Map<String, Object>>> rows) {
        jdbc.query("""
                SELECT code, name, address, phone, is_primary, note FROM campuses
                WHERE school_id = ? AND active ORDER BY is_primary DESC, code""", rs -> {
            Map<String, Object> r = new HashMap<>();
            r.put("code", rs.getString("code"));
            r.put("name", rs.getString("name"));
            r.put("address", rs.getString("address"));
            r.put("phone", rs.getString("phone"));
            r.put("primary", rs.getBoolean("is_primary") ? "Có" : "Không");
            r.put("note", rs.getString("note"));
            rows.get(OnboardingSheet.CAMPUS).add(r);
        }, schoolId);
        jdbc.query("""
                SELECT st.code, st.name, st.staff_type, st.position, st.department, st.phone, st.email, sj.name AS subject
                FROM staff st LEFT JOIN subjects sj ON sj.id = st.main_subject_id
                WHERE st.school_id = ? AND st.active ORDER BY st.code""", rs -> {
            Map<String, Object> r = new HashMap<>();
            r.put("code", rs.getString("code"));
            r.put("name", rs.getString("name"));
            r.put("type", "TEACHER".equals(rs.getString("staff_type")) ? "Giáo viên" : "Cán bộ");
            r.put("position", positionLabel(rs.getString("position")));
            r.put("mainSubject", rs.getString("subject"));
            r.put("department", rs.getString("department"));
            r.put("phone", rs.getString("phone"));
            r.put("email", rs.getString("email"));
            rows.get(OnboardingSheet.STAFF).add(r);
        }, schoolId);
        jdbc.query("""
                SELECT b.code, b.name, c.code AS campus, b.floor_count, b.built_year, b.floor_area, b.condition,
                       m.code AS manager
                FROM buildings b LEFT JOIN campuses c ON c.id = b.campus_id LEFT JOIN staff m ON m.id = b.managing_staff_id
                WHERE b.school_id = ? AND b.active ORDER BY b.code""", rs -> {
            Map<String, Object> r = new HashMap<>();
            r.put("code", rs.getString("code"));
            r.put("name", rs.getString("name"));
            r.put("campus", rs.getString("campus"));
            r.put("floors", rs.getObject("floor_count"));
            r.put("year", rs.getObject("built_year"));
            r.put("area", rs.getObject("floor_area"));
            r.put("condition", label(FACILITY, rs.getString("condition")));
            r.put("manager", rs.getString("manager"));
            rows.get(OnboardingSheet.BUILDING).add(r);
        }, schoolId);
        jdbc.query("""
                SELECT r.code, r.name, b.code AS building, r.floor, t.name AS room_type, r.structure, sj.name AS subject,
                       r.area, r.capacity, r.condition, r.usage_status, m.code AS manager, r.managing_unit, r.note
                FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id LEFT JOIN room_types t ON t.id = r.room_type_id
                LEFT JOIN subjects sj ON sj.id = r.subject_id LEFT JOIN staff m ON m.id = r.managing_staff_id
                WHERE r.school_id = ? AND r.active ORDER BY r.code""", rs -> {
            Map<String, Object> r = new HashMap<>();
            r.put("code", rs.getString("code"));
            r.put("name", rs.getString("name"));
            r.put("building", rs.getString("building"));
            r.put("floor", rs.getObject("floor"));
            r.put("roomType", rs.getString("room_type"));
            r.put("structure", label(STRUCTURE, rs.getString("structure")));
            r.put("subject", rs.getString("subject"));
            r.put("area", rs.getObject("area"));
            r.put("capacity", rs.getObject("capacity"));
            r.put("condition", label(FACILITY, rs.getString("condition")));
            r.put("usage", label(USAGE, rs.getString("usage_status")));
            r.put("manager", rs.getString("manager"));
            r.put("unit", rs.getString("managing_unit"));
            r.put("note", rs.getString("note"));
            rows.get(OnboardingSheet.ROOM).add(r);
        }, schoolId);
        jdbc.query("""
                SELECT k.name, g.name AS grade, y.code AS year_code, y.name AS year_name, k.student_count,
                       t.code AS teacher, r.code AS room, k.note
                FROM school_classes k JOIN grades g ON g.id = k.grade_id JOIN school_years y ON y.id = k.school_year_id
                LEFT JOIN staff t ON t.id = k.homeroom_teacher_id LEFT JOIN rooms r ON r.id = k.room_id
                WHERE k.school_id = ? AND k.active AND y.is_current ORDER BY g.sort_order, k.sort_order, k.name""", rs -> {
            Map<String, Object> r = new HashMap<>();
            r.put("code", rs.getString("name"));
            r.put("grade", rs.getString("grade"));
            r.put("year", OnboardingValidator.schoolYearLabel(rs.getString("year_code"), rs.getString("year_name")));
            r.put("students", rs.getObject("student_count"));
            r.put("teacher", rs.getString("teacher"));
            r.put("room", rs.getString("room"));
            r.put("note", rs.getString("note"));
            rows.get(OnboardingSheet.CLASS).add(r);
        }, schoolId);
    }

    private static final List<String> FACILITY = List.of("Tốt", "Bình thường", "Cần sửa chữa", "Xuống cấp", "Hư hỏng nặng");
    private static final List<String> STRUCTURE = List.of("Kiên cố", "Bán kiên cố", "Tạm", "Nhờ, mượn, thuê");
    private static final List<String> USAGE = List.of("Đang sử dụng", "Bỏ trống", "Đang sửa chữa", "Ngừng sử dụng");

    /** Mã lưu trong CSDL ("BAN_KIEN_CO") → chữ trên tệp ("Bán kiên cố"): mã là chữ đã bỏ dấu của nhãn. */
    private static String label(List<String> labels, String code) {
        if (code == null) {
            return null;
        }
        return labels.stream().filter(l -> OnboardingValidator.fold(l).replaceAll("^_|_$", "").equals(code))
                .findFirst().orElse(null);
    }

    private static String positionLabel(String code) {
        try {
            return code == null ? null : StaffPosition.valueOf(code).label();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ ô chọn

    private Map<OnboardingSheet, Map<String, Choice>> choices(Long schoolId, Lists lists) {
        List<String> subjects = jdbc.queryForList("SELECT name FROM subjects WHERE active ORDER BY name", String.class);
        List<String> staff = schoolId == null ? List.of()
                : jdbc.queryForList("SELECT code FROM staff WHERE school_id = ? AND active ORDER BY code", String.class, schoolId);
        List<String> rooms = schoolId == null ? List.of()
                : jdbc.queryForList("SELECT code FROM rooms WHERE school_id = ? AND active ORDER BY code", String.class, schoolId);
        Long level = schoolId == null ? null : jdbc.queryForList(
                "SELECT education_level_id FROM schools WHERE id = ?", Long.class, schoolId).stream().findFirst().orElse(null);
        // Không có trường (mẫu chung): mọi khối; tham số rỗng phải ép kiểu, không thì PostgreSQL không đoán được.
        List<String> grades = jdbc.queryForList("SELECT name FROM grades WHERE active"
                + " AND (CAST(? AS BIGINT) IS NULL OR education_level_id = CAST(? AS BIGINT))"
                + " ORDER BY sort_order, name", String.class, level, level);
        // Năm học: chỉ năm hiện hành — tệp khai dữ liệu đầu vào của năm đang làm việc.
        List<String> years = jdbc.query("SELECT code, name FROM school_years WHERE active AND is_current",
                (rs, i) -> OnboardingValidator.schoolYearLabel(rs.getString("code"), rs.getString("name")));
        List<String> roomTypes = jdbc.queryForList("SELECT name FROM room_types WHERE active AND (school_id IS NULL OR "
                + "school_id = CAST(? AS BIGINT)) ORDER BY sort_order, name", String.class, schoolId);
        List<String> funding = new ArrayList<>(Arrays.stream(FundingSource.values())
                .filter(FundingSource::selectable).map(FundingSource::label).toList());
        funding.add(FundingSource.UNDETERMINED.label());
        List<String> units = jdbc.queryForList("SELECT name FROM units WHERE active ORDER BY name", String.class);

        Map<OnboardingSheet, Map<String, Choice>> out = new LinkedHashMap<>();
        out.put(OnboardingSheet.CAMPUS, map("primary", lists.strict("Cơ sở chính", List.of("Có", "Không"))));
        out.put(OnboardingSheet.STAFF, map(
                "type", lists.strict("Loại cán bộ", List.of("Giáo viên", "Cán bộ")),
                "position", lists.strict("Chức vụ", Arrays.stream(StaffPosition.values()).map(StaffPosition::label).toList()),
                "mainSubject", lists.strict("Môn", subjects)));
        out.put(OnboardingSheet.BUILDING, map(
                "condition", lists.strict("Hiện trạng", FACILITY),
                "manager", lists.loose("Mã cán bộ", staff)));
        out.put(OnboardingSheet.ROOM, map(
                "roomType", lists.strict("Loại CSVC", roomTypes),
                "structure", lists.strict("Kết cấu", STRUCTURE),
                "subject", lists.strict("Môn", subjects),
                "condition", lists.strict("Hiện trạng", FACILITY),
                "usage", lists.strict("Tình trạng sử dụng", USAGE),
                "manager", lists.loose("Mã cán bộ", staff)));
        out.put(OnboardingSheet.CLASS, map(
                "grade", lists.strict("Khối lớp", grades),
                "year", lists.strict("Năm học", years),
                "teacher", lists.loose("Mã cán bộ", staff),
                "room", lists.loose("Mã phòng", rooms)));
        out.put(OnboardingSheet.STUDENT, map("gender", lists.strict("Giới tính", List.of("Nam", "Nữ"))));
        Map<String, Choice> equipment = new LinkedHashMap<>();
        equipment.put("unit", lists.strict("Đơn vị tính", units));
        equipment.put("tracking", lists.strict("Cách quản lý", List.of("Từng cái", "Theo lô")));
        equipment.put("room", lists.loose("Mã phòng", rooms));
        equipment.put("manager", lists.loose("Mã cán bộ", staff));
        equipment.put("origin", lists.strict("Nguồn hình thành", Arrays.stream(OriginRule.values()).map(OriginRule::label).toList()));
        equipment.put("funding", lists.strict("Nguồn kinh phí", funding));
        equipment.put("condition", lists.strict("Tình trạng", List.of("Tốt", "Khá", "Trung bình", "Kém", "Hỏng", "Không sử dụng")));
        out.put(OnboardingSheet.EQUIPMENT, equipment);
        Map<String, Choice> outside = new LinkedHashMap<>(equipment);
        outside.put("subject", lists.strict("Môn", subjects));
        out.put(OnboardingSheet.EQUIPMENT_OUTSIDE, outside);
        return out;
    }

    /** Bảng cột → ô chọn, bỏ cột không có danh sách (trường chưa có cán bộ, phòng…). */
    private static Map<String, Choice> map(Object... keyValues) {
        Map<String, Choice> out = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            if (keyValues[i + 1] != null) {
                out.put((String) keyValues[i], (Choice) keyValues[i + 1]);
            }
        }
        return out;
    }

    /**
     * Trang ẩn "Danh sách": mỗi danh sách một cột, tiêu đề ở dòng 1. Cùng tên thì dùng chung một cột. Danh sách rỗng
     * (trường chưa có cán bộ, phòng) thì không có ô chọn.
     */
    private static final class Lists {
        private final Map<String, List<String>> columns = new LinkedHashMap<>();

        Choice strict(String name, List<String> values) {
            return add(name + STRICT, values, true);
        }

        Choice loose(String name, List<String> values) {
            return add(name, values, false);
        }

        private Choice add(String key, List<String> values, boolean strict) {
            if (values.isEmpty()) {
                return null;
            }
            columns.putIfAbsent(key, values);
            int col = new ArrayList<>(columns.keySet()).indexOf(key);
            String letter = column(col);
            // Bộ ghi đặt tiêu đề ở dòng 4, dữ liệu từ dòng 5.
            return new Choice("'" + LISTS + "'!$" + letter + "$5:$" + letter + "$" + (values.size() + 4), strict);
        }

        XlsxWriter.Tab tab() {
            List<XlsxWriter.Column> cols = new ArrayList<>();
            int width = columns.values().stream().mapToInt(List::size).max().orElse(0);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (int i = 0; i < width; i++) {
                rows.add(new HashMap<>());
            }
            for (Map.Entry<String, List<String>> e : columns.entrySet()) {
                String key = e.getKey();
                cols.add(new XlsxWriter.Column(key, key.replace(STRICT, ""), "text"));
                for (int i = 0; i < e.getValue().size(); i++) {
                    rows.get(i).put(key, e.getValue().get(i));
                }
            }
            return new XlsxWriter.Tab(LISTS, new XlsxWriter.Sheet(null, null, cols, rows,
                    new Format(Set.of(), Map.of(), true, false)));
        }

        private static String column(int index) {
            StringBuilder name = new StringBuilder();
            int n = index + 1;
            while (n > 0) {
                int rem = (n - 1) % 26;
                name.insert(0, (char) ('A' + rem));
                n = (n - 1) / 26;
            }
            return name.toString();
        }
    }
}
