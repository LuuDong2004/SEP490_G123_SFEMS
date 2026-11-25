package com.g123.sfems.module.school.voucher;

import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.validation.TextNormalizer;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Trường chứng từ của phiếu — cột {@code details} — theo cấu hình
 * {@code resources/voucher-forms/<resource>.json}, sinh từ app Jmix cũ bằng
 * {@code backend/tools/jmix_voucher_forms.py}.
 *
 * <p>Cấu hình là một danh sách ĐÓNG: khoá không có trong cấu hình bị từ chối
 * (422) chứ không lặng lẽ lưu, để một lỗi chính tả ở client không thành một
 * trường ma ai cũng tưởng đã được ghi. Mỗi giá trị được đưa về đúng kiểu — ngày
 * ISO, số, enum trong danh sách — và tham chiếu (cán bộ, phòng, trường) được tra
 * lại tên từ id, trong đúng trường của phiếu: client gửi {@code {"id": 12}}, cột
 * lưu {@code {"id": 12, "name": "Nguyễn Văn A"}} để màn chi tiết và bản in đọc
 * được mà không phải tra thêm.
 *
 * <p>Trường bắt buộc chỉ bị đòi khi TRÌNH phiếu, không khi lưu nháp: phiếu nháp là
 * chỗ để điền dần.
 *
 * <p>Ngoại lệ duy nhất của danh sách đóng là {@code retired}: khoá đã từng có trong
 * cấu hình rồi bị gỡ. Phiếu cũ còn mang chúng, và màn sửa gửi lại nguyên
 * {@code details} của bản ghi — từ chối thì không ai sửa được phiếu nháp cũ nữa.
 * Chúng bị gạt đi (không lưu), không báo lỗi.
 */
@Component
public class VoucherForms {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final Map<String, Map<String, Object>> forms = new LinkedHashMap<>();
    private final JdbcTemplate jdbc;

    public VoucherForms(JdbcTemplate jdbc) throws IOException {
        this.jdbc = jdbc;
        for (Resource r : new PathMatchingResourcePatternResolver().getResources("classpath:voucher-forms/*.json")) {
            try (InputStream in = r.getInputStream()) {
                Map<String, Object> form = JSON.readValue(in, MAP);
                markOpenEnums(form);
                forms.put((String) form.get("resource"), form);
            }
        }
    }

    /**
     * Ô chọn KHÔNG gõ tay được: tình trạng thiết bị — là mã máy so sánh.
     * Mọi ô chọn khác của phần chứng từ đều chỉ để ghi lại, nên có mục "Khác" để gõ tay (cờ {@code other} gửi cho
     * màn hình qua {@code GET /api/voucher_forms}).
     */
    private static final Set<String> CLOSED_ENUMS = Set.of("EquipmentCondition");

    /** Chữ gõ tay ở mục "Khác" của một ô chọn — giới hạn như một ô chữ ngắn. */
    private static final int OTHER_MAX = 255;

    @SuppressWarnings("unchecked")
    private static void markOpenEnums(Map<String, Object> form) {
        List<Map<String, Object>> fields = new ArrayList<>();
        for (Object section : list(form.get("sections"))) {
            fields.addAll(list(((Map<String, Object>) section).get("fields")));
        }
        fields.addAll(list(form.get("line")));
        if (form.get("lineTables") instanceof Map<?, ?> tables) {
            for (Object table : tables.values()) {
                fields.addAll(list(table));
            }
        }
        for (Map<String, Object> field : fields) {
            if ("enum".equals(field.get("kind")) && !CLOSED_ENUMS.contains(String.valueOf(field.get("enum")))) {
                field.put("other", true);
            }
        }
    }

    // ------------------------------------------------------------------ đọc / ghi JSON

    public static Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        return JSON.readValue(json, MAP);
    }

    public static String write(Map<String, Object> value) {
        return JSON.writeValueAsString(value == null ? Map.of() : value);
    }

    public Map<String, Object> form(String resource) {
        Map<String, Object> form = forms.get(resource);
        if (form == null) {
            throw new ResourceNotFoundException("VoucherForm", resource);
        }
        return form;
    }

    @SuppressWarnings("unchecked")
    private Set<String> retired(String resource) {
        return new HashSet<>((List<String>) form(resource).getOrDefault("retired", List.of()));
    }

    public boolean has(String resource) {
        return forms.containsKey(resource);
    }

    // ------------------------------------------------------------------ đầu phiếu

    /** Chuẩn hoá phần đầu phiếu. */
    public String header(String resource, Map<String, Object> input, String existing, Long schoolId) {
        if (!has(resource)) {
            return existing == null ? "{}" : existing;
        }
        Map<String, Object> result = read(existing);
        Set<String> retired = retired(resource);
        result.keySet().removeAll(retired);
        if (input == null) {
            return write(result);
        }
        input = new LinkedHashMap<>(input);
        input.keySet().removeAll(retired);
        Map<String, Map<String, Object>> fields = headerFields(resource);
        for (String key : fields.keySet()) {
            result.remove(key);
        }
        Set<String> unknown = new HashSet<>(input.keySet());
        unknown.removeAll(fields.keySet());
        if (!unknown.isEmpty()) {
            throw new FieldValidationException("details", "Trường không hợp lệ: " + String.join(", ", unknown));
        }
        for (Map.Entry<String, Object> e : input.entrySet()) {
            Object value = coerce(resource, fields.get(e.getKey()), e.getValue(), schoolId, "details");
            if (value != null) {
                result.put(e.getKey(), value);
            }
        }
        return write(result);
    }

    public String line(String resource, Map<String, Object> input, Long schoolId, int lineNo) {
        if (!has(resource) || input == null || input.isEmpty()) {
            return "{}";
        }
        Map<String, Map<String, Object>> fields = new LinkedHashMap<>();
        for (Map<String, Object> f : list(form(resource).get("line"))) {
            fields.put((String) f.get("key"), f);
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> tables = (Map<String, Object>) form(resource).getOrDefault("lineTables", Map.of());
        Map<String, Object> result = new LinkedHashMap<>();
        String where = "Dòng " + lineNo;
        Set<String> retired = retired(resource);
        for (Map.Entry<String, Object> e : input.entrySet()) {
            if (retired.contains(e.getKey())) {
                continue;
            }
            if (tables.containsKey(e.getKey())) {
                result.put(e.getKey(), table(resource, list(tables.get(e.getKey())), e.getValue(), schoolId, where));
                continue;
            }
            Map<String, Object> field = fields.get(e.getKey());
            if (field == null) {
                throw new FieldValidationException("lines", where + ": trường không hợp lệ " + e.getKey());
            }
            Object value = coerce(resource, field, e.getValue(), schoolId, where);
            if (value != null) {
                result.put(e.getKey(), value);
            }
        }
        return write(result);
    }

    /** Khi trình: mọi trường bắt buộc phải có. */
    public void requireComplete(String resource, String json) {
        if (!has(resource)) {
            return;
        }
        Map<String, Object> values = read(json);
        List<String> missing = new ArrayList<>();
        for (Map<String, Object> section : list(form(resource).get("sections"))) {
            // Mục có điều kiện (phiếu ghi tăng: cấp trên mua tập trung): dịch vụ của loại phiếu tự kiểm.
            if (section.get("when") != null) {
                continue;
            }
            for (Map<String, Object> f : list(section.get("fields"))) {
                Object v = values.get((String) f.get("key"));
                if (Boolean.TRUE.equals(f.get("required")) && (v == null || "".equals(v))) {
                    missing.add((String) f.get("label"));
                }
            }
        }
        if (!missing.isEmpty()) {
            throw new FieldValidationException("details", "Còn thiếu: " + String.join(", ", missing));
        }
    }

    // ------------------------------------------------------------------ nội bộ

    private Map<String, Map<String, Object>> headerFields(String resource) {
        Map<String, Map<String, Object>> fields = new LinkedHashMap<>();
        for (Map<String, Object> section : list(form(resource).get("sections"))) {
            for (Map<String, Object> f : list(section.get("fields"))) {
                fields.put((String) f.get("key"), f);
            }
        }
        return fields;
    }

    /**
     * Như {@link #requireComplete} nhưng cho các trường của MỘT DÒNG.
     *
     * <p>Phải là một lời gọi riêng vì cấu hình có hai danh sách trường tách rời —
     * {@code sections} của đầu phiếu và {@code line} của từng dòng — và
     * {@code requireComplete} chỉ đi qua danh sách thứ nhất. Thiếu lời gọi này
     * thì cờ {@code required} ở cấp dòng chỉ vẽ ra dấu sao trên màn hình mà
     * không chặn gì: người dùng thấy một cái khoá không có lưỡi.
     */
    public void requireLineComplete(String resource, String json, int lineNo) {
        if (!has(resource)) {
            return;
        }
        Map<String, Object> values = read(json);
        List<String> missing = new ArrayList<>();
        for (Map<String, Object> f : list(form(resource).get("line"))) {
            Object v = values.get((String) f.get("key"));
            if (Boolean.TRUE.equals(f.get("required")) && (v == null || "".equals(v))) {
                missing.add((String) f.get("label"));
            }
        }
        if (!missing.isEmpty()) {
            throw new FieldValidationException("lines",
                    "Dòng %d còn thiếu: %s".formatted(lineNo, String.join(", ", missing)));
        }
    }

    private List<Map<String, Object>> table(String resource, List<Map<String, Object>> columns, Object value,
            Long schoolId, String where) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (!(value instanceof List<?> rows)) {
            return out;
        }
        for (Object row : rows) {
            if (!(row instanceof Map<?, ?> m)) {
                continue;
            }
            Map<String, Object> clean = new LinkedHashMap<>();
            for (Map<String, Object> c : columns) {
                Object v = coerce(resource, c, m.get(c.get("key")), schoolId, where);
                if (v != null) {
                    clean.put((String) c.get("key"), v);
                }
            }
            if (!clean.isEmpty()) {
                out.add(clean);
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Object coerce(String resource, Map<String, Object> field, Object value, Long schoolId, String where) {
        if (value == null || (value instanceof String s && s.isBlank())) {
            return null;
        }
        String label = (String) field.get("label");
        String kind = (String) field.get("kind");
        try {
            return switch (kind) {
                case "text", "textarea" -> {
                    // Cùng bộ quy tắc với ô của DTO: ký tự cho phép theo kiểu (cấu hình khai "rule", vd. PHONE;
                    // mặc định ô một dòng là SHORT_TEXT, ô nhiều dòng là LONG_TEXT), trần theo "max" của cấu hình.
                    String s = TextNormalizer.normalize(String.valueOf(value));
                    FieldRule rule = field.get("rule") instanceof String r ? FieldRule.valueOf(r)
                            : "textarea".equals(kind) ? FieldRule.LONG_TEXT : FieldRule.SHORT_TEXT;
                    int max = field.get("max") instanceof Number n ? n.intValue() : 4000;
                    // "min": độ dài tối thiểu khi có khai (vd. họ tên người giao 2–100).
                    int min = field.get("min") instanceof Number m ? m.intValue() : 0;
                    String problem = rule.violation(s, max, min);
                    if (problem != null) {
                        throw bad(where, label + " " + problem);
                    }
                    yield rule.normalize(s);
                }
                case "date" -> {
                    LocalDate d = LocalDate.parse(String.valueOf(value));
                    DateRule rule = "past".equals(field.get("date")) ? DateRule.PAST_OR_TODAY : DateRule.ANY;
                    String problem = rule.violation(d);
                    if (problem != null) {
                        throw bad(where, label + " " + problem);
                    }
                    yield d.toString();
                }
                case "time" -> LocalTime.parse(String.valueOf(value)).toString();
                case "integer" -> {
                    BigDecimal n = new BigDecimal(String.valueOf(value));
                    // Mọi trường số nguyên của chứng từ là một phép ĐẾM (số lượng, số tháng, tiết học, năm) —
                    // không có trường nào mang nghĩa khi âm. Kiểu tiền bên dưới đã kiểm; kiểu này từng không.
                    String problem = NumberRule.COUNT.violation(n);
                    if (problem != null) {
                        throw bad(where, label + " " + problem);
                    }
                    yield n.intValueExact();
                }
                case "money", "percent" -> {
                    BigDecimal n = new BigDecimal(String.valueOf(value));
                    String problem = ("percent".equals(kind) ? NumberRule.PERCENT : NumberRule.MONEY).violation(n);
                    if (problem != null) {
                        throw bad(where, label + " " + problem);
                    }
                    yield n;
                }
                case "boolean" -> value instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(value));
                case "enum" -> {
                    String v = String.valueOf(value);
                    Map<String, Object> enums = (Map<String, Object>) form(resource).get("enums");
                    List<Map<String, Object>> options = list(enums.get(field.get("enum")));
                    if (options.stream().noneMatch(o -> v.equals(o.get("value")))) {
                        // Mục "Khác": chữ gõ tay, nhận như một ô chữ ngắn.
                        String typed = Boolean.TRUE.equals(field.get("other")) ? v.strip() : null;
                        if (typed == null) {
                            throw bad(where, label + " không hợp lệ: " + v);
                        }
                        if (typed.length() > OTHER_MAX) {
                            throw bad(where, label + " dài quá " + OTHER_MAX + " ký tự");
                        }
                        yield typed.isEmpty() ? null : typed;
                    }
                    yield v;
                }
                case "staff", "room", "school", "ref" -> reference(field, value, schoolId, where);
                default -> throw bad(where, "Kiểu trường chưa hỗ trợ: " + kind);
            };
        } catch (NumberFormatException | ArithmeticException | DateTimeParseException e) {
            throw bad(where, label + " không đúng định dạng");
        }
    }

    /** Tham chiếu: nhận {@code {"id": n}} hoặc số; tra tên trong đúng phạm vi; lưu {id, name}. */
    private Map<String, Object> reference(Map<String, Object> field, Object value, Long schoolId, String where) {
        Object raw = value instanceof Map<?, ?> m ? m.get("id") : value;
        if (raw == null || "".equals(raw)) {
            return null;
        }
        long id = Long.parseLong(String.valueOf(raw));
        String label = (String) field.get("label");
        String kind = (String) field.get("kind");
        List<String> names = switch (kind) {
            case "staff" -> jdbc.queryForList("SELECT name FROM staff WHERE id = ? AND school_id = ?", String.class,
                    id, schoolId);
            case "room" -> jdbc.queryForList("SELECT name FROM rooms WHERE id = ? AND school_id = ?", String.class, id,
                    schoolId);
            case "school" -> jdbc.queryForList("SELECT name FROM schools WHERE id = ?", String.class, id);
            default -> jdbc.queryForList("SELECT name FROM " + safeTable((String) field.get("resource"))
                    + " WHERE id = ?", String.class, id);
        };
        if (names.isEmpty()) {
            throw bad(where, label + ": không tìm thấy (id " + id + ") trong trường của phiếu");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("name", names.get(0));
        return out;
    }

    /** Bảng tham chiếu danh mục — chỉ những tên có trong cấu hình, không bao giờ chữ người dùng gửi. */
    private static String safeTable(String resource) {
        if (!"movement_reasons".equals(resource)) {
            throw new IllegalStateException("Bảng tham chiếu không được phép: " + resource);
        }
        return resource;
    }

    private static FieldValidationException bad(String where, String message) {
        return new FieldValidationException("details", ("details".equals(where) ? "" : where + ": ") + message);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return value instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
    }
}
