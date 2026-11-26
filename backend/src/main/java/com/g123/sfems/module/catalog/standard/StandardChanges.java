package com.g123.sfems.module.catalog.standard;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiPredicate;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * So dòng phụ lục của một bộ với bộ trước nó: thêm / đổi / bỏ. Bộ nháp so ngay để xem trước; lúc áp dụng thì ghi lại
 * ({@code equipment_standard_changes}) để về sau tra "văn bản X đã đổi những gì".
 *
 * <p>Ghép dòng theo NỘI DUNG chứ không theo mã: bản nháp có thể thay cả môn bằng cách đọc văn bản (.docx), mã dòng
 * khi đó sinh lại. Trong cùng một môn: giống hệt mọi phần thông tư quy định → không đổi; cùng tên + chủ đề, rồi cùng tên
 * → đổi; còn lại là thêm (bộ này) / bỏ (bộ trước).
 */
@Component
class StandardChanges {

    private final JdbcTemplate jdbc;

    StandardChanges(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Một dòng phụ lục, chỉ những phần thông tư quy định (không mã, không thứ tự). */
    private record Row(long id, Long subjectId, String subjectName, String name, String topic, String purpose,
            String description, String quantityText, BigDecimal minQuantity, String normBasis, Integer basisSize,
            String gradeLevels, Long unitId, String unitText, boolean forTeacher, boolean forStudent, boolean optional,
            String sectionName) {

        String nameKey() {
            return squash(name);
        }

        String topicKey() {
            return squash(topic);
        }
    }

    /** Kết quả so: danh sách để hiện / ghi, và id các dòng của bộ này đã thêm hoặc đổi (để gắn căn cứ). */
    record Diff(List<StandardChange> changes, List<Long> touchedNormIds, Map<Long, Long> pairs) {

        Diff(List<StandardChange> changes, List<Long> touchedNormIds) {
            this(changes, touchedNormIds, Map.of());
        }
    }

    Diff compare(long standardId, Long previousId) {
        List<Row> now = rows(standardId);
        List<Row> before = previousId == null ? List.of() : rows(previousId);
        Map<Long, List<Row>> nowBySubject = bySubject(now);
        Map<Long, List<Row>> beforeBySubject = bySubject(before);
        List<Long> subjects = new ArrayList<>(nowBySubject.keySet());
        beforeBySubject.keySet().stream().filter(s -> !nowBySubject.containsKey(s)).forEach(subjects::add);

        List<StandardChange> changes = new ArrayList<>();
        List<Long> touched = new ArrayList<>();
        // Dòng đổi: id dòng của bộ này → id dòng tương ứng của bộ trước.
        Map<Long, Long> pairs = new LinkedHashMap<>();
        for (Long subject : subjects) {
            List<Row> rows = nowBySubject.getOrDefault(subject, List.of());
            List<Row> olds = new ArrayList<>(beforeBySubject.getOrDefault(subject, List.of()));
            Row[] match = new Row[rows.size()];
            pair(rows, olds, match, (r, o) -> diffFields(o, r).isEmpty());
            pair(rows, olds, match, (r, o) -> r.nameKey().equals(o.nameKey()) && r.topicKey().equals(o.topicKey()));
            pair(rows, olds, match, (r, o) -> r.nameKey().equals(o.nameKey()));
            for (int i = 0; i < rows.size(); i++) {
                Row r = rows.get(i);
                Row o = match[i];
                if (o == null) {
                    changes.add(new StandardChange("ADDED", r.subjectId(), r.subjectName(), r.id(), r.name(), r.topic(),
                            null, null, quantity(r)));
                    touched.add(r.id());
                    continue;
                }
                List<String> fields = diffFields(o, r);
                if (fields.isEmpty()) {
                    continue;
                }
                pairs.put(r.id(), o.id());
                boolean qty = fields.contains("số lượng") || fields.contains("khối lớp");
                changes.add(new StandardChange("CHANGED", r.subjectId(), r.subjectName(), r.id(), r.name(), r.topic(),
                        String.join(", ", fields), qty ? quantity(o) : null, qty ? quantity(r) : null));
                touched.add(r.id());
            }
            for (Row o : olds) {
                // Dòng bị bỏ mang id dòng của BỘ TRƯỚC: màn danh mục mở lại được nội dung cũ của nó.
                changes.add(new StandardChange("REMOVED", o.subjectId(), o.subjectName(), o.id(), o.name(), o.topic(),
                        null, quantity(o), null));
            }
        }
        return new Diff(changes, touched, pairs);
    }

    /** Ghi danh sách lúc áp dụng — thay danh sách cũ nếu có. */
    void record(long standardId, List<StandardChange> changes) {
        jdbc.update("DELETE FROM equipment_standard_changes WHERE standard_id = ?", standardId);
        int order = 0;
        for (StandardChange c : changes) {
            jdbc.update("""
                    INSERT INTO equipment_standard_changes (standard_id, change_kind, subject_id, norm_id, name, topic,
                        fields, before_text, after_text, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    standardId, c.kind(), c.subjectId(), c.normId(), cut(c.name(), 500), cut(c.topic(), 1000),
                    cut(c.fields(), 500), cut(c.before(), 500), cut(c.after(), 500), ++order);
        }
    }

    /** Danh sách đã ghi; {@code null} khi bộ chưa có (chưa áp dụng, hoặc áp dụng trước khi có bảng này). */
    List<StandardChange> recorded(long standardId) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM equipment_standard_changes WHERE standard_id = ?",
                Integer.class, standardId);
        if (count == null || count == 0) {
            return null;
        }
        return jdbc.query("""
                SELECT c.change_kind, c.subject_id, s.name AS subject_name, c.norm_id, c.name, c.topic, c.fields,
                       c.before_text, c.after_text
                FROM equipment_standard_changes c LEFT JOIN subjects s ON s.id = c.subject_id
                WHERE c.standard_id = ? ORDER BY c.sort_order""",
                (rs, i) -> new StandardChange(rs.getString("change_kind"), (Long) rs.getObject("subject_id", Long.class),
                        rs.getString("subject_name"), (Long) rs.getObject("norm_id", Long.class), rs.getString("name"),
                        rs.getString("topic"), rs.getString("fields"), rs.getString("before_text"),
                        rs.getString("after_text")),
                standardId);
    }

    /** Gắn văn bản sửa đổi làm căn cứ cho các dòng đã thêm / đổi. */
    void tagSource(List<Long> normIds, long documentId) {
        for (Long id : normIds) {
            jdbc.update("UPDATE equipment_norms SET source_document_id = ?, updated_at = now() WHERE id = ?", documentId, id);
        }
    }

    private List<Row> rows(long standardId) {
        return jdbc.query("""
                SELECT n.id, n.subject_id, s.name AS subject_name, n.name, n.topic, n.purpose, n.description,
                       n.quantity_text, n.min_quantity, n.norm_basis, n.basis_size, n.grade_levels, n.unit_id,
                       n.unit_text, n.for_teacher, n.for_student, n.optional, n.section_name
                FROM equipment_norms n LEFT JOIN subjects s ON s.id = n.subject_id
                WHERE n.standard_id = ? AND n.active ORDER BY n.sort_order, n.id""", StandardChanges::row, standardId);
    }

    private static Row row(ResultSet rs, int i) throws SQLException {
        return new Row(rs.getLong("id"), (Long) rs.getObject("subject_id", Long.class), rs.getString("subject_name"),
                rs.getString("name"), rs.getString("topic"), rs.getString("purpose"), rs.getString("description"),
                rs.getString("quantity_text"), rs.getBigDecimal("min_quantity"), rs.getString("norm_basis"),
                (Integer) rs.getObject("basis_size", Integer.class), rs.getString("grade_levels"),
                (Long) rs.getObject("unit_id", Long.class), rs.getString("unit_text"), rs.getBoolean("for_teacher"),
                rs.getBoolean("for_student"), rs.getBoolean("optional"), rs.getString("section_name"));
    }

    private static Map<Long, List<Row>> bySubject(List<Row> rows) {
        Map<Long, List<Row>> map = new LinkedHashMap<>();
        for (Row r : rows) {
            map.computeIfAbsent(r.subjectId() == null ? -1L : r.subjectId(), k -> new ArrayList<>()).add(r);
        }
        return map;
    }

    /** Những phần thông tư quy định mà hai dòng khác nhau, bằng chữ cho người đọc. */
    private static List<String> diffFields(Row a, Row b) {
        List<String> out = new ArrayList<>();
        if (!a.nameKey().equals(b.nameKey())) {
            out.add("tên");
        }
        if (!a.topicKey().equals(b.topicKey())) {
            out.add("chủ đề");
        }
        if (!same(a.sectionName(), b.sectionName())) {
            out.add("nhóm");
        }
        if (!same(a.purpose(), b.purpose())) {
            out.add("mục đích");
        }
        if (!same(a.description(), b.description())) {
            out.add("mô tả");
        }
        // Đã đọc ra con số thì so con số + cách tính; nguyên văn ("05/GV" / "5/GV") chỉ so khi cả hai không có số.
        boolean rawOnly = a.minQuantity() == null && b.minQuantity() == null;
        if ((rawOnly && !same(a.quantityText(), b.quantityText())) || !sameNumber(a.minQuantity(), b.minQuantity())
                || !Objects.equals(a.normBasis(), b.normBasis()) || !Objects.equals(size(a), size(b))
                || a.optional() != b.optional()) {
            out.add("số lượng");
        }
        if (!same(a.gradeLevels(), b.gradeLevels())) {
            out.add("khối lớp");
        }
        // Đơn vị: cả hai đã gắn danh mục đơn vị thì so mã; chữ đơn vị chỉ là bản ghi kèm (dữ liệu cũ có, đọc .docx thì không).
        boolean unitSame = a.unitId() != null && b.unitId() != null ? a.unitId().equals(b.unitId())
                : Objects.equals(a.unitId(), b.unitId()) && same(a.unitText(), b.unitText());
        if (!unitSame) {
            out.add("đơn vị");
        }
        if (a.forTeacher() != b.forTeacher() || a.forStudent() != b.forStudent()) {
            out.add("đối tượng");
        }
        return out;
    }

    private static Integer size(Row r) {
        return r.basisSize() == null || r.basisSize() <= 1 ? null : r.basisSize();
    }

    private static void pair(List<Row> rows, List<Row> olds, Row[] match, BiPredicate<Row, Row> same) {
        for (int i = 0; i < rows.size(); i++) {
            if (match[i] != null) {
                continue;
            }
            for (Iterator<Row> it = olds.iterator(); it.hasNext(); ) {
                Row o = it.next();
                if (same.test(rows.get(i), o)) {
                    match[i] = o;
                    it.remove();
                    break;
                }
            }
        }
    }

    /** Phần số lượng đọc được: "1 × lớp ÷ 2 · lớp 1, 2 · tự chọn". */
    private static String quantity(Row r) {
        String q = r.minQuantity() == null ? (r.quantityText() == null ? "?" : r.quantityText().trim())
                : r.minQuantity().stripTrailingZeros().toPlainString();
        String b = r.normBasis() == null ? "" : switch (r.normBasis()) {
            case "PER_ROOM" -> " × phòng";
            case "PER_ROOM_STUDENT" -> " × HS/phòng";
            case "PER_TEACHER" -> " × GV";
            case "PER_CLASS" -> " × lớp";
            case "PER_STUDENT" -> " × HS";
            default -> " × trường";
        };
        return q + b + (size(r) == null ? "" : " ÷ " + size(r))
                + (r.gradeLevels() == null || r.gradeLevels().isBlank() ? "" : " · lớp " + r.gradeLevels().trim())
                + (r.optional() ? " · tự chọn" : "");
    }

    private static boolean same(String a, String b) {
        return squashSpace(a).equals(squashSpace(b));
    }

    private static boolean sameNumber(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    /**
     * Hai bản chép một văn bản (thông tư gốc, văn bản hợp nhất, mỗi nơi đăng một bản) lệch nhau ở thứ không phải nội dung:
     * khoảng trắng, xuống dòng, dấu câu, gạch đầu dòng ("a) …" / "- …"), kiểu đặt dấu thanh ("hoà" / "hòa"), i / y
     * ("lí" / "lý"), lỗi gõ dấu ("bằng" / "bảng"). So nội dung chữ dài trên dạng không dấu, chỉ chữ và số.
     */
    private static String squashSpace(String s) {
        return squash(s);
    }

    /** Không dấu, i = y, chỉ chữ và số — để ghép tên / chủ đề và so chữ giữa hai bản chép. */
    private static String squash(String s) {
        if (s == null) {
            return "";
        }
        String n = Normalizer.normalize(s.toLowerCase(Locale.ROOT).replace('đ', 'd'), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}", "").replace('y', 'i').replaceAll("[^a-z0-9]", "");
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
