package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.coderule.SchoolCodeRule;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.coderule.SchoolCodeRuleRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mã tự sinh cho PHÒNG theo quy tắc của từng trường (TS-05 cho phòng, dùng ở DM-04 và form phòng TC-02).
 *
 * <p><b>Không có bộ đếm.</b> Số kế tiếp = số lớn nhất đang có cùng ký hiệu đầu + 1, không nhỏ hơn số bắt
 * đầu. Xem trước ({@link #next}) và lúc lưu ({@link #resolveOnCreate}) đều tính lại từ dữ liệu, nên mã gõ
 * tay, mã nhập từ tệp hay một dòng bị xoá không làm lệch gì. Hai người lưu cùng lúc ra cùng một số thì
 * unique {@code (school_id, code)} của bảng chặn người sau — nhưng {@link #resolveOnCreate} khoá tư vấn
 * tới hết giao dịch nên gần như luôn ra số khác nhau.
 *
 * <p>Mặc định: {@code PH0001} — ký hiệu + số thứ tự liên tục.
 *
 * <p>Chỉ có {@code rooms}: phần số của mã TÀI SẢN (target {@code equipment}) do
 * {@link com.g123.sfems.module.school.coderule.AssetCodeService} giữ, còn các loại khác của bản gốc
 * (khối nhà, cơ sở, cán bộ, tổ bộ môn…) chưa có bảng trong đồ án nên không khai — khai mà không có bảng
 * là một đường {@code next} trả 500.
 */
@Service
public class RoomCodeService {

    /** Loại duy nhất được cấp mã ở đây — tên đi thẳng vào SQL nên phải là danh sách đóng. */
    public static final String TARGET = "rooms";

    private static final Map<String, String> TARGETS = Map.of(TARGET, "Phòng");

    private static final Pattern SAFE_PREFIX = Pattern.compile("^[A-Za-z0-9._-]{0,20}$");

    private final SchoolCodeRuleRepository rules;
    private final SchoolService schools;
    private final JdbcTemplate jdbc;

    public RoomCodeService(SchoolCodeRuleRepository rules, SchoolService schools, JdbcTemplate jdbc) {
        this.rules = rules;
        this.schools = schools;
        this.jdbc = jdbc;
    }

    /** Quy tắc đang áp cho phòng của một trường. */
    public record Effective(String target, String label, String prefix, int numberLength, int startNumber,
            boolean custom) {
    }

    /** Quy tắc kèm mã kế tiếp của trường lúc này — cho màn quản lý quy tắc. */
    public record RuleView(String target, String label, String prefix, int numberLength, int startNumber,
            boolean custom, String next) {
    }

    // ------------------------------------------------------------------ đọc / sửa quy tắc

    @Transactional(readOnly = true)
    public List<RuleView> rulesOf(Long schoolId) {
        schools.get(schoolId);
        return List.of(view(schoolId, effective(own(schoolId))));
    }

    @Transactional
    public RuleView save(Long schoolId, String target, String prefix, Integer numberLength, Integer startNumber) {
        requireTarget(target);
        School school = schools.get(schoolId);
        String cleaned = prefix == null ? null : prefix.trim();
        if (cleaned != null && !SAFE_PREFIX.matcher(cleaned).matches()) {
            throw new FieldValidationException("prefix", "Ký hiệu chỉ gồm chữ không dấu, số và . _ - (tối đa 20 ký tự)");
        }
        int length = numberLength == null ? 4 : numberLength;
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
        return view(schoolId, effective(rule));
    }

    /** Bỏ quy tắc riêng — trường quay về cách đặt mặc định. */
    @Transactional
    public RuleView reset(Long schoolId, String target) {
        requireTarget(target);
        schools.get(schoolId);
        rules.findBySchoolIdAndTarget(schoolId, target).ifPresent(rules::delete);
        rules.flush();
        return view(schoolId, effective(null));
    }

    // ------------------------------------------------------------------ cấp mã

    /** Mã kế tiếp để điền sẵn form — không giữ chỗ gì. */
    @Transactional(readOnly = true)
    public String next(Long schoolId, String target) {
        requireTarget(target);
        schools.get(schoolId);
        return compute(schoolId);
    }

    /**
     * Mã sẽ lưu cho phòng mới: để trống thì cấp mã kế tiếp; có mã thì giữ đúng mã đó — và mã đã có trong
     * trường thì BÁO TRÙNG ngay ở ô Mã, kèm mã kế tiếp còn trống. Không lặng lẽ đổi sang số khác: người dùng
     * phải thấy mã mình lưu ra sao.
     */
    public String resolveOnCreate(Room room, String requested) {
        if (room.getSchool() == null) {
            return requested;
        }
        Long schoolId = room.getSchool().getId();
        // Không có bộ đếm, nên hai lần tạo song song cùng đọc một "số lớn nhất" và cùng ra PH0013 — người sau vấp
        // unique và nhận 409 chung chung. Khoá tư vấn theo (loại, trường) tới hết giao dịch: lần sau chờ lần trước
        // commit rồi mới tính, nên thấy mã vừa cấp. Chỉ khoá một loại của một trường, không chặn gì khác.
        jdbc.queryForList("SELECT 1 FROM pg_advisory_xact_lock(hashtext(?), ?)", Integer.class,
                "school_code:" + TARGET, Math.toIntExact(schoolId));
        String fresh = compute(schoolId);
        if (requested == null || requested.isBlank()) {
            return fresh;
        }
        boolean taken = codesStartingWith(schoolId, ruleOf(schoolId).prefix())
                .stream().anyMatch(c -> c.equalsIgnoreCase(requested.trim()));
        if (taken) {
            throw new FieldValidationException("code",
                    "Mã %s đã có trong trường — mã kế tiếp còn trống là %s.".formatted(requested.trim(), fresh));
        }
        return requested;
    }

    private Effective ruleOf(Long schoolId) {
        return effective(own(schoolId));
    }

    private SchoolCodeRule own(Long schoolId) {
        return rules.findBySchoolIdAndTarget(schoolId, TARGET).orElse(null);
    }

    private String compute(Long schoolId) {
        Effective rule = ruleOf(schoolId);
        String prefix = nullToEmpty(rule.prefix());
        int next = Math.max(rule.startNumber(), maxNumber(schoolId, prefix) + 1);
        return prefix + pad(next, rule.numberLength());
    }

    private int maxNumber(Long schoolId, String prefix) {
        Pattern tail = Pattern.compile("^" + Pattern.quote(prefix.toUpperCase(Locale.ROOT)) + "(\\d{1,9})$");
        int max = 0;
        for (String code : codesStartingWith(schoolId, prefix)) {
            Matcher m = tail.matcher(code);
            if (m.matches()) {
                max = Math.max(max, Integer.parseInt(m.group(1)));
            }
        }
        return max;
    }

    private List<String> codesStartingWith(Long schoolId, String prefix) {
        return jdbc.queryForList(
                "SELECT upper(code) FROM rooms WHERE school_id = ? AND upper(code) LIKE ? ESCAPE '\\'",
                String.class,
                schoolId,
                escapeLike(prefix.toUpperCase(Locale.ROOT)) + "%");
    }

    private RuleView view(Long schoolId, Effective e) {
        return new RuleView(e.target(), e.label(), e.prefix(), e.numberLength(), e.startNumber(), e.custom(),
                compute(schoolId));
    }

    // ------------------------------------------------------------------ mặc định

    private Effective effective(SchoolCodeRule own) {
        String label = TARGETS.get(TARGET);
        if (own != null) {
            return new Effective(TARGET, label, own.getPrefix(), own.getNumberLength(), own.getStartNumber(), true);
        }
        return new Effective(TARGET, label, "PH", 4, 1, false);
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
