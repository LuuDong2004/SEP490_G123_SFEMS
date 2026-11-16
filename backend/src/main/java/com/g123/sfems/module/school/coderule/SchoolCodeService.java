package com.g123.sfems.module.school.coderule;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.coderule.SchoolCodeRule;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.persistence.Table;
import java.time.Year;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mã tự sinh cho dữ liệu trường tự lập — phòng, khối nhà, cơ sở, cán bộ — theo quy tắc của TỪNG
 * trường ({@link SchoolCodeRule}), không có thì theo mặc định.
 *
 * <p><b>Không có bộ đếm.</b> Số kế tiếp = số lớn nhất đang có cùng ký hiệu đầu + 1, không nhỏ hơn
 * số bắt đầu. Xem trước ({@link #next}) và lúc lưu ({@link #resolveOnCreate}) đều tính lại từ dữ
 * liệu, nên mã gõ tay, mã nhập từ tệp hay một dòng bị xoá không làm lệch gì. Hai người lưu cùng lúc
 * ra cùng một số thì unique {@code (school_id, code)} của bảng chặn người sau (409) — hiếm, và bấm
 * lưu lại là ra số mới.
 *
 * <p>Mặc định theo "Tùy chỉnh mã danh mục tự động" của bản Jmix: phòng PH0001, cán bộ CB0001 —
 * ký hiệu + số thứ tự liên tục; khối nhà NHA-01, cơ sở CS01 (Jmix không có hai loại này).
 */
@Service
public class SchoolCodeService {

    /** Bảng của từng loại — tên bảng cũng là tên resource. Danh sách đóng: tên đi thẳng vào SQL. */
    public static final Map<String, String> TARGETS = new LinkedHashMap<>();

    static {
        TARGETS.put("rooms", "Phòng");
        TARGETS.put("buildings", "Khối nhà");
        TARGETS.put("campuses", "Cơ sở");
        TARGETS.put("staff", "Cán bộ, giáo viên");
        TARGETS.put("subject_teams", "Tổ bộ môn");
        TARGETS.put("facility_works", "Sửa chữa, cải tạo công trình");
        TARGETS.put("maintenance_plans", "Kế hoạch bảo trì");
    }

    private static final Pattern SAFE_PREFIX = Pattern.compile("^[A-Za-z0-9._-]{0,20}$");

    private final SchoolCodeRuleRepository rules;
    private final SchoolService schools;
    private final JdbcTemplate jdbc;

    public SchoolCodeService(SchoolCodeRuleRepository rules, SchoolService schools, JdbcTemplate jdbc) {
        this.rules = rules;
        this.schools = schools;
        this.jdbc = jdbc;
    }

    /** Quy tắc đang áp cho một loại: của trường, hoặc mặc định ({@code custom = false}). */
    public record Effective(String target, String label, String prefix, int numberLength, int startNumber, boolean custom) {
    }

    /** Quy tắc kèm mã kế tiếp của trường lúc này — cho màn quản lý quy tắc. */
    public record RuleView(
            String target, String label, String prefix, int numberLength, int startNumber, boolean custom, String next) {
    }

    private RuleView view(Long schoolId, Effective e) {
        return new RuleView(e.target(), e.label(), e.prefix(), e.numberLength(), e.startNumber(), e.custom(),
                compute(schoolId, e.target()));
    }

    // ------------------------------------------------------------------ đọc / sửa quy tắc

    @Transactional(readOnly = true)
    public List<RuleView> rulesOf(Long schoolId) {
        schools.get(schoolId);
        Map<String, SchoolCodeRule> own = new LinkedHashMap<>();
        rules.findBySchoolId(schoolId).forEach(r -> own.put(r.getTarget(), r));
        return TARGETS.keySet().stream().map(t -> view(schoolId, effective(t, own.get(t)))).toList();
    }

    @Transactional
    public RuleView save(Long schoolId, String target, String prefix, Integer numberLength, Integer startNumber) {
        requireTarget(target);
        School school = schools.get(schoolId);
        String cleaned = prefix == null ? null : prefix.trim();
        if (cleaned != null && !SAFE_PREFIX.matcher(cleaned).matches()) {
            throw new FieldValidationException("prefix", "Ký hiệu chỉ gồm chữ không dấu, số và . _ - (tối đa 20 ký tự)");
        }
        int length = numberLength == null ? 2 : numberLength;
        if (length < 1 || length > 6) {
            throw new FieldValidationException("numberLength", "Độ dài phần số từ 1 đến 6");
        }
        int start = startNumber == null ? 1 : startNumber;
        if (start < 0) {
            throw new FieldValidationException("startNumber", "Số bắt đầu không được âm");
        }
        SchoolCodeRule rule = rules.findBySchoolIdAndTarget(schoolId, target).orElseGet(SchoolCodeRule::new);
        rule.setSchool(school);
        rule.setTarget(target);
        rule.setPrefix(cleaned == null || cleaned.isEmpty() ? null : cleaned);
        rule.setNumberLength(length);
        rule.setStartNumber(start);
        rules.saveAndFlush(rule);
        return view(schoolId, effective(target, rule));
    }

    /** Bỏ quy tắc riêng — trường quay về cách đặt mặc định. */
    @Transactional
    public RuleView reset(Long schoolId, String target) {
        requireTarget(target);
        schools.get(schoolId);
        rules.findBySchoolIdAndTarget(schoolId, target).ifPresent(rules::delete);
        rules.flush();
        return view(schoolId, effective(target, null));
    }

    // ------------------------------------------------------------------ cấp mã

    /** Mã kế tiếp để điền sẵn form — không giữ chỗ gì. */
    @Transactional(readOnly = true)
    public String next(Long schoolId, String target) {
        requireTarget(target);
        schools.get(schoolId);
        return compute(schoolId, target);
    }

    /**
     * Mã sẽ lưu cho bản ghi mới: để trống thì cấp mã kế tiếp; có mã thì giữ đúng mã đó — và mã đã có
     * trong trường thì BÁO TRÙNG ngay ở ô Mã, kèm mã kế tiếp còn trống. Không lặng lẽ đổi sang số khác:
     * người dùng phải thấy mã mình lưu ra sao (trước đây mã trùng được tự nhảy số, không một lời báo).
     */
    public String resolveOnCreate(SchoolOwnedEntity item, String requested) {
        String target = targetOf(item);
        if (target == null || item.getSchool() == null) {
            return requested;
        }
        Long schoolId = item.getSchool().getId();
        // Không có bộ đếm, nên hai lần tạo song song cùng đọc một "số lớn nhất" và cùng ra PH0013 — người sau vấp
        // unique và nhận 409 chung chung. Khoá tư vấn theo (loại, trường) tới hết giao dịch: lần sau chờ lần trước
        // commit rồi mới tính, nên thấy mã vừa cấp. Chỉ khoá một loại của một trường, không chặn gì khác.
        jdbc.queryForList("SELECT 1 FROM pg_advisory_xact_lock(hashtext(?), ?)", Integer.class,
                "school_code:" + target, Math.toIntExact(schoolId));
        String fresh = compute(schoolId, target);
        if (fresh == null) {
            return requested;
        }
        if (requested == null || requested.isBlank()) {
            return fresh;
        }
        boolean taken = codesStartingWith(schoolId, target, requested.trim()).stream()
                .anyMatch(c -> c.equalsIgnoreCase(requested.trim()));
        if (taken) {
            throw new FieldValidationException("code",
                    "Mã %s đã có trong trường — mã kế tiếp còn trống là %s.".formatted(requested.trim(), fresh));
        }
        return requested;
    }

    private String compute(Long schoolId, String target) {
        Effective rule = effective(target, rules.findBySchoolIdAndTarget(schoolId, target).orElse(null));
        String prefix = nullToEmpty(rule.prefix());
        int next = Math.max(rule.startNumber(), maxNumber(schoolId, target, prefix) + 1);
        return prefix + pad(next, rule.numberLength());
    }

    private int maxNumber(Long schoolId, String target, String prefix) {
        Pattern tail = Pattern.compile("^" + Pattern.quote(prefix.toUpperCase(Locale.ROOT)) + "(\\d{1,9})$");
        int max = 0;
        for (String code : codesStartingWith(schoolId, target, prefix)) {
            Matcher m = tail.matcher(code);
            if (m.matches()) {
                max = Math.max(max, Integer.parseInt(m.group(1)));
            }
        }
        return max;
    }

    private List<String> codesStartingWith(Long schoolId, String target, String prefix) {
        // `target` đã qua requireTarget / targetOf — chỉ là một trong bốn tên bảng cố định.
        return jdbc.queryForList(
                "SELECT upper(code) FROM " + target + " WHERE school_id = ? AND upper(code) LIKE ? ESCAPE '\\'",
                String.class,
                schoolId,
                escapeLike(prefix.toUpperCase(Locale.ROOT)) + "%");
    }

    // ------------------------------------------------------------------ mặc định

    private Effective effective(String target, SchoolCodeRule own) {
        String label = TARGETS.get(target);
        if (own != null) {
            return new Effective(target, label, own.getPrefix(), own.getNumberLength(), own.getStartNumber(), true);
        }
        return switch (target) {
            case "rooms" -> new Effective(target, label, "PH", 4, 1, false);
            case "buildings" -> new Effective(target, label, "NHA-", 2, 1, false);
            case "campuses" -> new Effective(target, label, "CS", 2, 1, false);
            case "subject_teams" -> new Effective(target, label, "TO", 2, 1, false);
            case "facility_works" -> new Effective(target, label, "SC", 3, 1, false);
            // Theo năm: BT-2026-001, sang năm đánh số lại từ 001.
            case "maintenance_plans" -> new Effective(target, label, "BT-" + Year.now() + "-", 3, 1, false);
            default -> new Effective(target, label, "CB", 4, 1, false);
        };
    }

    private static String targetOf(SchoolOwnedEntity item) {
        Table table = item.getClass().getAnnotation(Table.class);
        String name = table == null ? null : table.name();
        return name != null && TARGETS.containsKey(name) ? name : null;
    }

    private static void requireTarget(String target) {
        if (!TARGETS.containsKey(target)) {
            throw new FieldValidationException("target", "Loại này không có quy tắc mã của trường");
        }
    }

    private static String pad(int n, int length) {
        String s = String.valueOf(n);
        return s.length() >= length ? s : "0".repeat(length - s.length()) + s;
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
