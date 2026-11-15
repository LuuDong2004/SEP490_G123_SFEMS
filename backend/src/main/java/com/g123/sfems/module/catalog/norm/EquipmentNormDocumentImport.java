package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.norm.AppendixParser.Row;
import com.g123.sfems.module.catalog.norm.AppendixParser.Section;
import com.g123.sfems.module.catalog.standard.EquipmentStandardService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.DocxReader;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đưa PHỤ LỤC của thông tư (tệp Word) vào một bộ: đọc ({@link AppendixParser}), so với các dòng đang có của bộ
 * theo từng môn — Mới / Đổi / Không đổi / Bỏ — và, khi không phải xem thử, THAY các môn có trong văn bản bằng dòng
 * vừa đọc ({@link EquipmentNormService#replaceSubjects}). Môn không có trong văn bản giữ nguyên, nên tải từng môn
 * (tệp Word riêng mỗi môn) hay cả phụ lục đều được.
 */
@Service
public class EquipmentNormDocumentImport {

    private static final int MAX_CHANGES = 300;

    private final EquipmentNormService norms;
    private final EquipmentStandardService standards;
    private final JdbcTemplate jdbc;

    public EquipmentNormDocumentImport(EquipmentNormService norms, EquipmentStandardService standards, JdbcTemplate jdbc) {
        this.norms = norms;
        this.standards = standards;
        this.jdbc = jdbc;
    }

    /** Một môn của văn bản và kết quả so với bộ. {@code subjectId} null = không nhận ra môn — không nhập được. */
    public record SubjectResult(String heading, Long subjectId, String subjectName, boolean perRoom,
            String perRoomSource, int rows, int perRoomRows, int noQuantity, int added, int changed, int unchanged,
            int removed) {
    }

    /**
     * Một dòng khác bộ: {@code ADDED} (văn bản có, bộ chưa có), {@code CHANGED} (cùng thiết bị + chủ đề, khác phần
     * tính số lượng), {@code REMOVED} (bộ có, văn bản không còn).
     */
    public record Change(String kind, String subjectName, String name, String topic, String before, String after) {
    }

    private record Old(String name, String topic, String calc, Long catalogId) {
    }

    public record Result(boolean dryRun, String level, int rows, List<SubjectResult> subjects, List<Change> changes,
            int created, int deleted) {
    }

    @Transactional
    public Result run(Long standardId, String filename, byte[] content, boolean dryRun) {
        String name = filename == null ? "" : filename.toLowerCase();
        if (!name.endsWith(".docx")) {
            throw new FieldValidationException("file", "Chỉ nhận tệp Word .docx — tệp .doc cũ hãy mở bằng Word rồi lưu lại dạng .docx");
        }
        EquipmentStandard standard = standards.get(standardId);
        String level = standard.getEducationLevel() == null ? "" : standard.getEducationLevel().getCode();
        List<DocxReader.Block> blocks = DocxReader.read(content);
        // Thông tư SỬA ĐỔI, BỔ SUNG (TT 26/2023) chỉ chép các dòng được sửa, gộp nhiều cấp — đọc nó như phụ lục đầy đủ
        // thì mọi dòng khác của môn thành "bỏ" và bước thay môn xoá sạch chúng. Văn bản hợp nhất (VBHN) đã gộp sẵn sửa
        // đổi vào danh mục đầy đủ — đọc nó.
        boolean amendment = blocks.stream().limit(200)
                .anyMatch(b -> b instanceof DocxReader.Paragraph p
                        && AppendixParser.fold(p.text()).trim().matches("^dieu 1\\.?\\s*sua doi,? bo sung.*"));
        if (amendment) {
            throw new FieldValidationException("file", "Đây là thông tư sửa đổi, bổ sung — nó chỉ chép các dòng được sửa, "
                    + "đọc vào sẽ bỏ mất các dòng còn lại của môn. Đọc văn bản hợp nhất (VBHN) đã gộp sửa đổi đó, "
                    + "hoặc sửa tay từng dòng trong bản nháp.");
        }
        AppendixParser.Result parsed = AppendixParser.parse(blocks, level);
        if (parsed.rows().isEmpty()) {
            throw new FieldValidationException("file",
                    "Không thấy bảng phụ lục nào — tệp phải có tiêu đề \"Thiết bị dạy học tối thiểu cấp …\" và bảng có cột \"Tên thiết bị\"");
        }

        Map<String, Long> subjectIds = new HashMap<>();
        Map<Long, String> subjectNames = new HashMap<>();
        Map<Long, String> subjectCodes = new HashMap<>();
        jdbc.query("SELECT id, code, name FROM subjects", rs -> {
            subjectIds.putIfAbsent(AppendixParser.fold(rs.getString("name")), rs.getLong("id"));
            subjectNames.put(rs.getLong("id"), rs.getString("name"));
            subjectCodes.put(rs.getLong("id"), rs.getString("code"));
        });
        Map<String, Long> units = new HashMap<>();
        jdbc.query("SELECT id, name FROM units", rs -> {
            units.putIfAbsent(AppendixParser.fold(rs.getString("name")), rs.getLong("id"));
        });
        Map<String, Long> catalogs = new HashMap<>();
        jdbc.query("""
                SELECT id, subject_id, name FROM equipment_catalogs
                WHERE owner_school_id IS NULL AND subject_id IS NOT NULL AND code LIKE ?""",
                rs -> {
                    catalogs.putIfAbsent(rs.getLong("subject_id") + "|" + AppendixParser.fold(rs.getString("name")),
                            rs.getLong("id"));
                }, level + "-%");

        // Dòng đang có của bộ, theo môn, theo thứ tự phụ lục.
        Map<Long, List<Old>> existing = new HashMap<>();
        Map<Long, Integer> firstSort = new HashMap<>();
        int[] maxSort = {0};
        jdbc.query("""
                SELECT subject_id, catalog_id, name, topic, quantity_text, min_quantity, norm_basis, basis_size, grade_levels,
                       optional, sort_order
                FROM equipment_norms WHERE standard_id = ? ORDER BY sort_order, id""", rs -> {
            long subject = rs.getLong("subject_id");
            int sort = rs.getInt("sort_order");
            maxSort[0] = Math.max(maxSort[0], sort);
            firstSort.merge(subject, sort, Math::min);
            existing.computeIfAbsent(subject, k -> new ArrayList<>())
                    .add(new Old(rs.getString("name"), rs.getString("topic"), calc(rs.getBigDecimal("min_quantity"),
                            rs.getString("norm_basis"), (Integer) rs.getObject("basis_size"), rs.getString("grade_levels"),
                            rs.getBoolean("optional"), rs.getString("quantity_text")),
                            (Long) rs.getObject("catalog_id", Long.class)));
        }, standardId);

        // Môn của từng bảng → id; nhiều bảng cùng môn (Công nghệ THPT hai bảng) gộp một môn.
        Map<Long, int[]> stats = new LinkedHashMap<>();
        Map<Long, Section> firstSection = new LinkedHashMap<>();
        List<Section> unknown = new ArrayList<>();
        Map<Integer, Long> sectionSubject = new HashMap<>();
        for (Section s : parsed.sections()) {
            Long id = s.subjectKey() == null ? null : subjectIds.get(AppendixParser.SUBJECT_NAMES.get(s.subjectKey()));
            sectionSubject.put(s.index(), id);
            if (id == null) {
                unknown.add(s);
            } else {
                firstSection.putIfAbsent(id, s);
                stats.computeIfAbsent(id, k -> new int[7]);
            }
        }

        List<Change> changes = new ArrayList<>();
        List<EquipmentNormRequest> requests = new ArrayList<>();
        Map<Long, Integer> seq = new HashMap<>();
        Map<Row, Long> rowSubject = new java.util.IdentityHashMap<>(); // hai dòng y hệt nhau vẫn là hai dòng
        Map<Long, List<Row>> incoming = new LinkedHashMap<>();
        for (Row r : parsed.rows()) {
            Long subject = r.subjectKey() == null ? sectionSubject.get(r.section())
                    : subjectIds.getOrDefault(AppendixParser.SUBJECT_NAMES.get(r.subjectKey()), sectionSubject.get(r.section()));
            if (subject == null) {
                continue;
            }
            rowSubject.put(r, subject);
            incoming.computeIfAbsent(subject, k -> new ArrayList<>()).add(r);
            firstSection.putIfAbsent(subject, parsed.sections().get(r.section()));
            int[] st = stats.computeIfAbsent(subject, k -> new int[7]);
            st[0]++;
            if (r.normBasis() == NormBasis.PER_ROOM) {
                st[1]++;
            }
            if (r.minQuantity() == null && !r.optional()) {
                st[2]++;
            }
        }

        // Ghép dòng văn bản với dòng của bộ, chặt tới lỏng: tên + chủ đề → tên → tên gần giống (vài ký tự: hai nguồn
        // chép thông tư khác nhau ở lỗi gõ — "CaCI2" / "CaCl2", "Hydroca rbon" / "Hydrocarbon").
        Map<Row, Old> matched = new java.util.IdentityHashMap<>();
        for (Map.Entry<Long, List<Row>> e : incoming.entrySet()) {
            Long subject = e.getKey();
            List<Row> rows = e.getValue();
            List<Old> olds = new ArrayList<>(existing.getOrDefault(subject, List.of()));
            Old[] match = new Old[rows.size()];
            pair(rows, olds, match, (r, o) -> squash(r.name()).equals(squash(o.name()))
                    && squash(r.topic()).equals(squash(o.topic())));
            pair(rows, olds, match, (r, o) -> squash(r.name()).equals(squash(o.name())));
            pair(rows, olds, match, (r, o) -> near(squash(r.name()), squash(o.name())));
            int[] st = stats.get(subject);
            for (int i = 0; i < rows.size(); i++) {
                Row r = rows.get(i);
                Old old = match[i];
                if (old != null) {
                    matched.put(r, old);
                }
                String now = calc(r.minQuantity(), r.normBasis() == null ? null : r.normBasis().name(), r.basisSize(),
                        r.gradeLevels(), r.optional(), r.quantityText());
                if (old == null) {
                    st[3]++;
                    if (changes.size() < MAX_CHANGES) {
                        changes.add(new Change("ADDED", subjectNames.get(subject), r.name(), r.topic(), null, describe(now)));
                    }
                    continue;
                }
                boolean renamed = !squash(r.name()).equals(squash(old.name()));
                if (old.calc().equals(now) && !renamed) {
                    st[5]++;
                } else {
                    st[4]++;
                    if (changes.size() < MAX_CHANGES) {
                        changes.add(new Change("CHANGED", subjectNames.get(subject), r.name(), r.topic(),
                                describe(old.calc()) + (renamed ? " · tên cũ: " + old.name() : ""), describe(now)));
                    }
                }
            }
            // Bỏ: dòng đang có của môn mà văn bản không còn.
            for (Old o : olds) {
                st[6]++;
                if (changes.size() < MAX_CHANGES) {
                    changes.add(new Change("REMOVED", subjectNames.get(subject), o.name(), o.topic(), describe(o.calc()), null));
                }
            }
        }

        List<SubjectResult> subjects = new ArrayList<>();
        for (Map.Entry<Long, int[]> e : stats.entrySet()) {
            Section s = firstSection.get(e.getKey());
            int[] st = e.getValue();
            boolean perRoom = parsed.sections().stream()
                    .anyMatch(x -> x.perRoom() && Objects.equals(sectionSubject.get(x.index()), e.getKey()));
            String source = parsed.sections().stream()
                    .filter(x -> x.perRoom() && Objects.equals(sectionSubject.get(x.index()), e.getKey()))
                    .map(Section::perRoomSource).findFirst().orElse(null);
            subjects.add(new SubjectResult(s == null ? null : s.heading(), e.getKey(), subjectNames.get(e.getKey()),
                    perRoom, source, st[0], st[1], st[2], st[3], st[4], st[5], st[6]));
        }
        for (Section s : unknown) {
            subjects.add(new SubjectResult(s.heading(), null, null, s.perRoom(), s.perRoomSource(), s.rows(), 0, 0, 0,
                    0, 0, 0));
        }

        if (dryRun) {
            return new Result(true, level, rowSubject.size(), subjects, changes, 0, 0);
        }
        if (!unknown.isEmpty()) {
            throw new FieldValidationException("file", "Không nhận ra môn của bảng: "
                    + String.join("; ", unknown.stream().map(Section::heading).toList())
                    + " — chưa dòng nào được ghi");
        }
        for (Row r : parsed.rows()) {
            Long subject = rowSubject.get(r);
            if (subject == null) {
                continue;
            }
            int n = seq.merge(subject, 1, Integer::sum);
            // Môn đã có: chen vào chỗ cũ của môn; môn mới: xếp sau cùng.
            int base = firstSort.computeIfAbsent(subject, k -> maxSort[0] += 10_000);
            int sort = base + n - 1;
            String code = "DM-" + level + "-" + subjectCodes.get(subject) + "-%03d".formatted(n);
            Long unit = r.unitText() == null ? null : units.get(AppendixParser.fold(r.unitText()));
            // Thiết bị: của dòng cũ đã ghép (kể cả khi văn bản gõ khác tên — "CaCI2"), không thì tìm theo tên. Không
            // gắn được thì lúc áp dụng bộ mới tạo thiết bị — gắn ở đây để lỗi gõ không đẻ thiết bị trùng.
            Old old = matched.get(r);
            Long catalog = old != null && old.catalogId() != null ? old.catalogId()
                    : catalogs.get(subject + "|" + AppendixParser.fold(r.name()));
            requests.add(new EquipmentNormRequest(code, r.name(), sort, Boolean.TRUE, cut(r.note(), 500),
                    new IdRef(standardId), catalog == null ? null : new IdRef(catalog), null, new IdRef(subject), null,
                    null, r.minQuantity(), unit == null ? null : new IdRef(unit), r.normBasis(), r.basisSize(),
                    r.quantityText(), unit == null ? r.unitText() : null, r.gradeLevels(), r.itemNo(), r.sectionName(),
                    r.topic(), cut(r.purpose(), 20_000), cut(r.description(), 20_000), r.forTeacher(), r.forStudent(),
                    r.optional(), null));
        }
        int deleted = norms.replaceSubjects(standardId, stats.keySet(), requests);
        return new Result(false, level, requests.size(), subjects, changes, requests.size(), deleted);
    }

    /** Ghép mỗi dòng văn bản chưa có cặp với dòng đầu tiên của bộ thoả {@code same}; dòng đã ghép bị lấy ra. */
    private static void pair(List<Row> rows, List<Old> olds, Old[] match, java.util.function.BiPredicate<Row, Old> same) {
        for (int i = 0; i < rows.size(); i++) {
            if (match[i] != null) {
                continue;
            }
            for (java.util.Iterator<Old> it = olds.iterator(); it.hasNext(); ) {
                Old o = it.next();
                if (same.test(rows.get(i), o)) {
                    match[i] = o;
                    it.remove();
                    break;
                }
            }
        }
    }

    /** Không dấu, chỉ chữ và số — "Hydroca rbon" và "Hydrocarbon" là một. */
    private static String squash(String s) {
        return AppendixParser.fold(s).replaceAll("[^a-z0-9]", "");
    }

    /** Tên gần giống: lệch tối đa 2 ký tự (hoặc 1/10 độ dài với tên dài) — lỗi gõ giữa hai bản chép thông tư. */
    private static boolean near(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) {
            return false;
        }
        int limit = Math.max(2, Math.min(a.length(), b.length()) / 10);
        if (Math.abs(a.length() - b.length()) > limit) {
            return false;
        }
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            int best = cur[0];
            for (int j = 1; j <= b.length(); j++) {
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
                best = Math.min(best, cur[j]);
            }
            if (best > limit) {
                return false;
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.length()] <= limit;
    }

    /** Phần tính số lượng của một dòng, viết thành chuỗi để so và để hiện "trước → sau". */
    private static String calc(BigDecimal qty, String basis, Integer size, String grades, boolean optional,
            String text) {
        String q = qty == null ? "?" : qty.stripTrailingZeros().toPlainString();
        String b = basis == null ? "?" : switch (basis.toUpperCase()) {
            case "PER_ROOM" -> "phòng";
            case "PER_TEACHER" -> "GV";
            case "PER_CLASS" -> "lớp";
            case "PER_STUDENT" -> "HS";
            default -> "trường";
        };
        return q + " × " + b + (size != null && size > 1 ? " ÷ " + size : "")
                + (grades == null || grades.isBlank() ? "" : " · lớp " + grades)
                + (optional ? " · tự chọn" : "") + "\u0000" + (text == null ? "" : text.trim());
    }

    /** Phần hiểu được ("7 × phòng · lớp 10"); nguyên văn chỉ để so, không hiện — nó thường y hệt ở hai bên. */
    private static String describe(String calc) {
        int i = calc.indexOf('\u0000');
        return i < 0 ? calc : calc.substring(0, i);
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
