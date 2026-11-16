package com.g123.sfems.module.school.facilitystandard;

import com.g123.sfems.domain.catalog.facilitygroup.FacilityLevels;
import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chấm mức độ chuẩn CSVC của trường: đối chiếu phòng / hạng mục đang có với quy tắc chuẩn Sở khai
 * ({@code facility_standard_rules}, 203) theo cấp học của trường.
 *
 * <ul>
 *   <li>Chỉ các loại CSVC của Sở có áp cho cấp của trường ({@code room_types.levels}).</li>
 *   <li>Phòng được tính: {@link FacilityCounting#COUNTED_ROOM} (còn dùng, không "ngừng sử dụng"), loại
 *       chính hoặc loại dùng kết hợp ({@code combined_type_id}) là loại đang xét. CỐ Ý khác thông tin chung / biểu số
 *       liệu (chỉ đếm loại chính): dùng kết hợp cũng làm đạt chuẩn loại đó.</li>
 *   <li>Mức cộng dồn: một loại đạt mức độ 1 khi đạt mọi quy tắc tối thiểu VÀ mức độ 1 của nó; mức nào (và các mức
 *       dưới) không có quy tắc thì là "chưa có quy tắc".</li>
 *   <li>Khối đạt một mức khi mọi loại có quy tắc ở mức đó đều đạt. Trường đạt mức cao nhất mà mọi loại có quy tắc
 *       đều đạt.</li>
 *   <li>Số lớp, số học sinh: lớp năm học hiện hành ({@link FacilityCounting#CLASS_COUNTS}), không nguồn nào khác.
 *       Quy tắc cần số mà trường chưa có thì chưa đạt, kèm lời nhắc.</li>
 * </ul>
 *
 * Phạm vi: {@link VisibleSchools} — trường thấy trường mình, UBND địa bàn, Sở toàn ngành.
 */
@Service
@Transactional(readOnly = true)
public class FacilityStandardService {

    public static final String PASS = "PASS";
    public static final String FAIL = "FAIL";
    public static final String NONE = "NONE";

    /** Nhãn ba mức, theo thứ tự tăng dần. */
    public static final Map<String, String> TIER_LABELS = new LinkedHashMap<>();

    static {
        TIER_LABELS.put(FacilityStandardRule.MIN, "Tiêu chuẩn tối thiểu");
        TIER_LABELS.put(FacilityStandardRule.LEVEL1, "Tiêu chuẩn mức độ 1");
        TIER_LABELS.put(FacilityStandardRule.LEVEL2, "Tiêu chuẩn mức độ 2");
    }

    private static final Map<String, String> TIER_SHORT = Map.of(
            FacilityStandardRule.MIN, "tối thiểu",
            FacilityStandardRule.LEVEL1, "mức độ 1",
            FacilityStandardRule.LEVEL2, "mức độ 2");

    /** Thứ tự khối như mẫu "Đánh giá mức độ chuẩn" của Sở: học tập, hỗ trợ, phụ trợ, sân chơi, sinh hoạt, rồi còn lại. */
    private static final List<String> GROUP_ORDER = List.of("05", "06", "03", "07", "08", "04", "09");

    /** Mức trường đạt, theo người đọc. */
    public static String reachedLabel(String tier) {
        return tier == null ? "Chưa đạt tối thiểu" : switch (tier) {
            case FacilityStandardRule.MIN -> "Tối thiểu";
            case FacilityStandardRule.LEVEL1 -> "Mức độ 1";
            default -> "Mức độ 2";
        };
    }

    public record SchoolInfo(Long id, String code, String name, String levelCode, String levelName,
            String managingBody, Integer students, Integer classes, int classesMissingSize) {
    }

    /** Một mức trên toàn trường: số loại đạt / số loại có quy tắc. */
    public record TierSummary(String tier, String label, int passed, int total, boolean reached) {
    }

    /**
     * Một loại CSVC của trường. {@code status} theo mức (MIN / LEVEL1 / LEVEL2 → PASS / FAIL / NONE);
     * {@code shortfalls} các dòng "cảnh báo thiếu"; {@code requirements} quy tắc đang áp, để người xem biết chuẩn là gì.
     */
    public record Item(Long roomTypeId, String code, String name, String kind, int count, BigDecimal totalArea,
            BigDecimal smallestArea, Map<String, String> status, List<String> shortfalls, List<String> requirements,
            boolean hasRules) {
    }

    public record Group(String code, String name, Map<String, String> status, List<Item> items) {
    }

    public record Evaluation(SchoolInfo school, String schoolYear, List<TierSummary> tiers, String reached,
            String reachedLabel, List<String> warnings, List<Group> groups) {
    }

    /** Một dòng của bảng tổng hợp nhiều trường. */
    public record Summary(SchoolInfo school, List<TierSummary> tiers, String reached, String reachedLabel,
            int failedMinimum) {
    }

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public FacilityStandardService(JdbcTemplate jdbc, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.visible = visible;
    }

    /** Đánh giá một trường; trường ngoài phạm vi của người xem là 404. */
    public Evaluation evaluate(Long schoolId) {
        List<SchoolInfo> schools = schools(" AND s.id = " + schoolId.longValue() + " " + visible.sqlFilter("s.id"));
        if (schools.isEmpty()) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        SchoolInfo school = schools.getFirst();
        Catalog catalog = catalog();
        Map<Long, RoomStat> stats = roomStats(" AND r.school_id = " + school.id() + " ").getOrDefault(school.id(),
                Map.of());
        List<String> warnings = new ArrayList<>();
        if (school.levelCode() == null) {
            warnings.add("Trường chưa có cấp học — không chấm được.");
        }
        List<Group> groups = evaluate(school, catalog, stats);
        boolean needsClasses = false;
        boolean needsStudents = false;
        for (RuleRow rule : catalog.rulesFor(school.levelCode())) {
            needsClasses |= rule.countPerClass() != null;
            needsStudents |= rule.areaPerStudent() != null;
        }
        if ((needsClasses || needsStudents) && school.classes() == null) {
            warnings.add(FacilityCounting.NO_CLASSES + " — quy tắc tính theo lớp, học sinh chưa chấm được.");
        } else if (needsStudents && school.students() == null) {
            warnings.add("Các lớp chưa có sĩ số — quy tắc tính theo học sinh chưa chấm được.");
        } else if (needsStudents && school.classesMissingSize() > 0) {
            warnings.add(school.classesMissingSize() + " lớp chưa có sĩ số — số học sinh chưa đủ.");
        }
        List<TierSummary> tiers = summarize(groups);
        String reached = reached(tiers);
        return new Evaluation(school, currentSchoolYear(), tiers, reached, reachedLabel(reached), warnings, groups);
    }

    /**
     * Tổng hợp nhiều trường — một dòng mỗi trường. {@code schoolFilter} là mệnh đề SQL trên {@code s.id} (đã gồm
     * phạm vi {@link VisibleSchools}), chỉ ghép id số; luôn có khoảng trắng hai đầu.
     */
    public List<Summary> summaries(String schoolFilter) {
        List<SchoolInfo> schools = schools(schoolFilter);
        if (schools.isEmpty()) {
            return List.of();
        }
        Catalog catalog = catalog();
        Map<Long, Map<Long, RoomStat>> stats = roomStats(" AND r.school_id IN (SELECT s.id FROM schools s WHERE TRUE"
                + schoolFilter + ") ");
        List<Summary> out = new ArrayList<>();
        for (SchoolInfo school : schools) {
            List<Group> groups = evaluate(school, catalog, stats.getOrDefault(school.id(), Map.of()));
            List<TierSummary> tiers = summarize(groups);
            String reached = reached(tiers);
            int failedMinimum = 0;
            for (Group g : groups) {
                for (Item i : g.items()) {
                    if (FAIL.equals(i.status().get(FacilityStandardRule.MIN))) {
                        failedMinimum++;
                    }
                }
            }
            out.add(new Summary(school, tiers, reached, reachedLabel(reached), failedMinimum));
        }
        return out;
    }

    // ------------------------------------------------------------------ chấm

    private List<Group> evaluate(SchoolInfo school, Catalog catalog, Map<Long, RoomStat> stats) {
        String level = school.levelCode();
        Map<Long, List<RuleRow>> rulesByType = new HashMap<>();
        for (RuleRow rule : catalog.rulesFor(level)) {
            rulesByType.computeIfAbsent(rule.roomTypeId(), k -> new ArrayList<>()).add(rule);
        }
        Map<String, List<Item>> itemsByGroup = new LinkedHashMap<>();
        Map<String, String> groupNames = new HashMap<>();
        for (TypeRow type : catalog.types()) {
            List<RuleRow> rules = rulesByType.getOrDefault(type.id(), List.of());
            if (level == null || !FacilityLevels.applies(type.levels(), level) || (!type.standard() && rules.isEmpty())) {
                continue;
            }
            RoomStat stat = stats.getOrDefault(type.id(), RoomStat.EMPTY);
            itemsByGroup.computeIfAbsent(type.groupCode(), k -> new ArrayList<>())
                    .add(item(type, rules, stat, school));
            groupNames.putIfAbsent(type.groupCode(), type.groupName());
        }
        List<String> order = new ArrayList<>(itemsByGroup.keySet());
        order.sort((a, b) -> Integer.compare(groupRank(a), groupRank(b)));
        List<Group> groups = new ArrayList<>();
        for (String code : order) {
            List<Item> items = itemsByGroup.get(code);
            Map<String, String> status = new LinkedHashMap<>();
            for (String tier : FacilityStandardRule.TIERS) {
                String s = NONE;
                for (Item i : items) {
                    String v = i.status().get(tier);
                    if (FAIL.equals(v)) {
                        s = FAIL;
                        break;
                    }
                    if (PASS.equals(v)) {
                        s = PASS;
                    }
                }
                status.put(tier, s);
            }
            groups.add(new Group(code, groupNames.get(code) == null ? "Chưa xếp khối" : groupNames.get(code), status,
                    items));
        }
        return groups;
    }

    private static int groupRank(String code) {
        int i = code == null ? -1 : GROUP_ORDER.indexOf(code);
        return i < 0 ? GROUP_ORDER.size() : i;
    }

    /** Một điều kiện chưa đạt: loại điều kiện → (mức → mức đòi). */
    private Item item(TypeRow type, List<RuleRow> rules, RoomStat stat, SchoolInfo school) {
        Map<String, String> status = new LinkedHashMap<>();
        // Điều kiện chưa đạt, gom theo loại điều kiện để mỗi loại một cặp dòng "đang có / tiêu chuẩn".
        Map<String, Map<String, BigDecimal>> failing = new LinkedHashMap<>();
        boolean missingClasses = false;
        boolean missingStudents = false;
        boolean missingArea = false;
        boolean anyRule = false;
        boolean cumulativeFail = false;
        List<String> requirements = new ArrayList<>();
        for (String tier : FacilityStandardRule.TIERS) {
            RuleRow rule = rules.stream().filter(r -> r.tier().equals(tier)).findFirst().orElse(null);
            if (rule != null) {
                anyRule = true;
                requirements.add(TIER_SHORT.get(tier) + ": " + describeFor(rule, school.classes(), school.students()));
                // Số phòng
                BigDecimal needCount = null;
                if (rule.minCount() != null) {
                    needCount = BigDecimal.valueOf(rule.minCount());
                }
                if (rule.countPerClass() != null) {
                    if (school.classes() == null) {
                        missingClasses = true;
                        cumulativeFail = true;
                    } else {
                        BigDecimal perClass = rule.countPerClass().multiply(BigDecimal.valueOf(school.classes()))
                                .setScale(0, RoundingMode.CEILING);
                        needCount = needCount == null ? perClass : needCount.max(perClass);
                    }
                }
                if (needCount != null && BigDecimal.valueOf(stat.count()).compareTo(needCount) < 0) {
                    failing.computeIfAbsent("count", k -> new LinkedHashMap<>()).put(tier, needCount);
                    cumulativeFail = true;
                }
                // Diện tích mỗi phòng
                if (rule.minRoomArea() != null) {
                    if (stat.count() == 0 || stat.missingArea() > 0) {
                        missingArea |= stat.count() > 0;
                        failing.computeIfAbsent("room", k -> new LinkedHashMap<>()).put(tier, rule.minRoomArea());
                        cumulativeFail = true;
                    } else if (stat.smallest().compareTo(rule.minRoomArea()) < 0) {
                        failing.computeIfAbsent("room", k -> new LinkedHashMap<>()).put(tier, rule.minRoomArea());
                        cumulativeFail = true;
                    }
                }
                // Tổng diện tích
                BigDecimal needArea = rule.minTotalArea();
                if (rule.areaPerStudent() != null) {
                    if (school.students() == null) {
                        missingStudents = true;
                        cumulativeFail = true;
                    } else {
                        BigDecimal perStudent = rule.areaPerStudent().multiply(BigDecimal.valueOf(school.students()))
                                .setScale(2, RoundingMode.HALF_UP);
                        needArea = needArea == null ? perStudent : needArea.max(perStudent);
                    }
                }
                if (needArea != null && stat.total().compareTo(needArea) < 0) {
                    failing.computeIfAbsent("total", k -> new LinkedHashMap<>()).put(tier, needArea);
                    cumulativeFail = true;
                }
            }
            status.put(tier, !anyRule ? NONE : cumulativeFail ? FAIL : PASS);
        }
        List<String> lines = new ArrayList<>();
        if (failing.containsKey("count")) {
            lines.add("- Số phòng: " + stat.count());
            lines.add("- Số phòng tiêu chuẩn: " + requirementText(failing.get("count"), false));
        }
        if (failing.containsKey("room")) {
            // Không có phòng nào: dòng "Số phòng" (nếu có) đã nói — chỉ ghi mức đòi.
            if (stat.count() > 0 && stat.missingArea() == 0) {
                lines.add("- Diện tích phòng (m2): " + area(stat.smallest()));
            }
            lines.add("- Diện tích tiêu chuẩn mỗi phòng (m2): " + requirementText(failing.get("room"), true));
        }
        if (failing.containsKey("total")) {
            lines.add("- Tổng diện tích (m2): " + area(stat.total()));
            lines.add("- Diện tích tiêu chuẩn (m2): " + requirementText(failing.get("total"), true));
        }
        if (stat.missingArea() > 0 && (failing.containsKey("room") || failing.containsKey("total"))) {
            missingArea = true;
        }
        if (missingClasses) {
            lines.add("- Chưa có số lớp của trường");
        }
        if (missingStudents) {
            lines.add("- Chưa có số học sinh của trường");
        }
        if (missingArea) {
            lines.add("- " + stat.missingArea() + " phòng chưa có diện tích");
        }
        return new Item(type.id(), type.code(), type.name(), type.kind(), stat.count(), stat.total(),
                stat.count() == 0 || stat.missingArea() == stat.count() ? null : stat.smallest(), status, lines,
                requirements, anyRule);
    }

    /** "12 (tối thiểu), 20 (mức độ 1)" — chỉ ghi tên mức khi không phải mức duy nhất là tối thiểu. */
    private static String requirementText(Map<String, BigDecimal> byTier, boolean isArea) {
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> e : byTier.entrySet()) {
            String value = isArea ? area(e.getValue()) : e.getValue().toPlainString();
            parts.add(byTier.size() == 1 && FacilityStandardRule.MIN.equals(e.getKey()) ? value
                    : value + " (" + TIER_SHORT.get(e.getKey()) + ")");
        }
        return String.join(", ", parts);
    }

    /** Tóm tắt quy tắc cho người đọc: "≥ 1 phòng; 1 phòng/lớp; ≥ 45 m²/phòng; 0,6 m²/học sinh; tổng ≥ 60 m²". */
    public static String describe(RuleRow rule) {
        return describe(rule.minCount(), rule.countPerClass(), rule.minRoomArea(), rule.areaPerStudent(),
                rule.minTotalArea());
    }

    public static String describe(Integer minCount, BigDecimal perClass, BigDecimal roomArea, BigDecimal perStudent,
            BigDecimal totalArea) {
        List<String> parts = new ArrayList<>();
        if (minCount != null) {
            parts.add("≥ " + minCount + " phòng");
        }
        if (perClass != null) {
            parts.add(plain(perClass) + " phòng/lớp");
        }
        if (roomArea != null) {
            parts.add("≥ " + plain(roomArea) + " m²/phòng");
        }
        if (perStudent != null) {
            parts.add(plain(perStudent) + " m²/học sinh");
        }
        if (totalArea != null) {
            parts.add("tổng ≥ " + plain(totalArea) + " m²");
        }
        return String.join("; ", parts);
    }

    /**
     * Quy tắc tính ra số của ĐÚNG trường đang xem: "≥ 15 phòng (0,6 phòng/lớp × 24 lớp)" thay cho "0,6 phòng/lớp" —
     * tỉ lệ trần không nói trường cần bao nhiêu phòng. Chưa có số lớp / học sinh thì ghi tỉ lệ như {@link #describe}.
     */
    private static String describeFor(RuleRow rule, Integer classes, Integer students) {
        List<String> parts = new ArrayList<>();
        if (rule.countPerClass() != null && classes != null) {
            BigDecimal need = rule.countPerClass().multiply(BigDecimal.valueOf(classes)).setScale(0, RoundingMode.CEILING);
            if (rule.minCount() != null) {
                need = need.max(BigDecimal.valueOf(rule.minCount()));
            }
            parts.add("≥ " + need.toPlainString() + " phòng (" + plain(rule.countPerClass()) + " phòng/lớp × "
                    + grouped(classes) + " lớp)");
        } else {
            if (rule.minCount() != null) {
                parts.add("≥ " + rule.minCount() + " phòng");
            }
            if (rule.countPerClass() != null) {
                parts.add(plain(rule.countPerClass()) + " phòng/lớp");
            }
        }
        if (rule.minRoomArea() != null) {
            parts.add("≥ " + plain(rule.minRoomArea()) + " m²/phòng");
        }
        if (rule.areaPerStudent() != null && students != null) {
            // Cùng cách tính với cảnh báo thiếu (2 số lẻ, làm tròn nửa lên) để hai chỗ ra một số.
            BigDecimal need = rule.areaPerStudent().multiply(BigDecimal.valueOf(students)).setScale(2, RoundingMode.HALF_UP);
            if (rule.minTotalArea() != null) {
                need = need.max(rule.minTotalArea());
            }
            parts.add("tổng ≥ " + grouped(need) + " m² (" + plain(rule.areaPerStudent()) + " m²/học sinh × "
                    + grouped(students) + " học sinh)");
        } else {
            if (rule.areaPerStudent() != null) {
                parts.add(plain(rule.areaPerStudent()) + " m²/học sinh");
            }
            if (rule.minTotalArea() != null) {
                parts.add("tổng ≥ " + plain(rule.minTotalArea()) + " m²");
            }
        }
        return String.join("; ", parts);
    }

    /** 1000 → "1.000", 605.40 → "605,4" (cách viết số trên màn hình). */
    private static String grouped(long value) {
        return grouped(BigDecimal.valueOf(value));
    }

    private static String grouped(BigDecimal value) {
        DecimalFormatSymbols vi = DecimalFormatSymbols.getInstance(Locale.US);
        vi.setGroupingSeparator('.');
        vi.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.##", vi).format(value);
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString().replace('.', ',');
    }

    /** Diện tích theo cách ghi của mẫu Sở: {@code 1,594.50}. */
    static String area(BigDecimal value) {
        DecimalFormat format = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));
        return format.format(value == null ? BigDecimal.ZERO : value);
    }

    private static List<TierSummary> summarize(List<Group> groups) {
        List<TierSummary> out = new ArrayList<>();
        boolean below = true;
        for (String tier : FacilityStandardRule.TIERS) {
            int passed = 0;
            int total = 0;
            for (Group g : groups) {
                for (Item i : g.items()) {
                    String s = i.status().get(tier);
                    if (!NONE.equals(s)) {
                        total++;
                        if (PASS.equals(s)) {
                            passed++;
                        }
                    }
                }
            }
            boolean reached = below && total > 0 && passed == total;
            below = reached;
            out.add(new TierSummary(tier, TIER_LABELS.get(tier), passed, total, reached));
        }
        return out;
    }

    private static String reached(List<TierSummary> tiers) {
        String reached = null;
        for (TierSummary t : tiers) {
            if (t.reached()) {
                reached = t.tier();
            }
        }
        return reached;
    }

    // ------------------------------------------------------------------ đọc dữ liệu

    /** Quy tắc đang dùng (một dòng {@code facility_standard_rules}). */
    public record RuleRow(Long roomTypeId, String levelCode, String tier, Integer minCount, BigDecimal countPerClass,
            BigDecimal minRoomArea, BigDecimal areaPerStudent, BigDecimal minTotalArea) {
    }

    private record TypeRow(Long id, String code, String name, String kind, String levels, boolean standard,
            String groupCode, String groupName) {
    }

    private record RoomStat(int count, BigDecimal total, BigDecimal smallest, int missingArea) {
        static final RoomStat EMPTY = new RoomStat(0, BigDecimal.ZERO, BigDecimal.ZERO, 0);
    }

    private record Catalog(List<TypeRow> types, List<RuleRow> rules) {
        List<RuleRow> rulesFor(String level) {
            return level == null ? List.of() : rules.stream().filter(r -> r.levelCode().equals(level)).toList();
        }
    }

    private Catalog catalog() {
        List<TypeRow> types = jdbc.query("""
                SELECT rt.id, rt.code, rt.name, rt.kind, rt.levels, rt.standard, g.code AS group_code,
                       g.name AS group_name
                FROM room_types rt
                LEFT JOIN facility_groups g ON g.id = rt.group_id
                WHERE rt.active AND rt.school_id IS NULL
                ORDER BY g.sort_order NULLS LAST, rt.sort_order NULLS LAST, rt.name""",
                (rs, i) -> new TypeRow(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                        rs.getString("kind"), rs.getString("levels"), rs.getBoolean("standard"),
                        rs.getString("group_code"), rs.getString("group_name")));
        List<RuleRow> rules = jdbc.query("""
                SELECT room_type_id, level_code, tier, min_count, count_per_class, min_room_area, area_per_student,
                       min_total_area
                FROM facility_standard_rules
                WHERE active""",
                (rs, i) -> new RuleRow(rs.getLong("room_type_id"), rs.getString("level_code"), rs.getString("tier"),
                        (Integer) rs.getObject("min_count"), rs.getBigDecimal("count_per_class"),
                        rs.getBigDecimal("min_room_area"), rs.getBigDecimal("area_per_student"),
                        rs.getBigDecimal("min_total_area")));
        return new Catalog(types, rules);
    }

    private List<SchoolInfo> schools(String filter) {
        return jdbc.query("""
                SELECT s.id, s.code, s.name, lv.code AS level_code, lv.name AS level_name, d.name AS body,
                       cl.students, cl.classes, cl.missing_size
                FROM schools s
                LEFT JOIN education_levels lv ON lv.id = s.education_level_id
                LEFT JOIN departments_of_education d ON d.id = s.department_of_education_id
                LEFT JOIN (""" + FacilityCounting.CLASS_COUNTS + """
                ) cl ON cl.school_id = s.id
                WHERE TRUE""" + filter + " ORDER BY s.name, s.id",
                (rs, i) -> new SchoolInfo(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                        rs.getString("level_code"), rs.getString("level_name"), rs.getString("body"),
                        rs.getObject("students") == null ? null : rs.getInt("students"),
                        rs.getObject("classes") == null ? null : rs.getInt("classes"), rs.getInt("missing_size")));
    }

    /**
     * Số phòng, tổng / nhỏ nhất diện tích theo (trường, loại). Một phòng tính cho loại chính và loại dùng kết hợp
     * (một lần nếu hai loại trùng nhau).
     */
    private Map<Long, Map<Long, RoomStat>> roomStats(String filter) {
        Map<Long, Map<Long, RoomStat>> out = new HashMap<>();
        jdbc.query("""
                SELECT r.school_id, t.type_id, count(*) AS n, COALESCE(sum(r.area), 0) AS total,
                       min(r.area) AS smallest, count(*) FILTER (WHERE r.area IS NULL) AS no_area
                FROM rooms r
                CROSS JOIN LATERAL (SELECT DISTINCT x AS type_id
                                    FROM (VALUES (r.room_type_id), (r.combined_type_id)) v (x)
                                    WHERE x IS NOT NULL) t
                WHERE""" + FacilityCounting.COUNTED_ROOM + filter + """
                 GROUP BY r.school_id, t.type_id""",
                rs -> {
                    out.computeIfAbsent(rs.getLong("school_id"), k -> new HashMap<>()).put(rs.getLong("type_id"),
                            new RoomStat(rs.getInt("n"), rs.getBigDecimal("total"),
                                    rs.getBigDecimal("smallest") == null ? BigDecimal.ZERO
                                            : rs.getBigDecimal("smallest"),
                                    rs.getInt("no_area")));
                });
        return out;
    }

    private String currentSchoolYear() {
        List<String> years = jdbc.queryForList(
                "SELECT code FROM school_years WHERE is_current ORDER BY start_date DESC LIMIT 1", String.class);
        return years.isEmpty() ? null : years.getFirst();
    }
}
