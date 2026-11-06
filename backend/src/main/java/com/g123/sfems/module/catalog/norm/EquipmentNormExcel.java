package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.EquipmentNorm;
import com.g123.sfems.domain.catalog.standard.EquipmentStandard;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.standard.EquipmentStandardService;
import com.g123.sfems.module.catalog.standard.StandardDocumentService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.module.catalog.norm.office.SpreadsheetReader;
import com.g123.sfems.module.catalog.norm.office.XlsxWriter;
import com.g123.sfems.shared.web.ListParams;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xuất / nhập Excel của danh mục thiết bị tối thiểu, theo ĐÚNG hình phụ lục thông tư: STT · Môn học ·
 * Chủ đề dạy học · Tên thiết bị · Mục đích sử dụng · Mô tả chi tiết · Đối tượng sử dụng · Đơn vị ·
 * Số lượng · Ghi chú. Tệp xuất ra nhập lại được (cùng tiêu đề cột), nên "xuất — sửa trong Excel —
 * nhập vào bộ nháp" là một vòng khép kín.
 *
 * <p>Nhập: tất cả hoặc không gì. Mọi dòng lỗi được gom lại báo một lần ("Dòng 12: không có môn …"),
 * chưa dòng nào được ghi. Môn, đơn vị, thiết bị trong danh mục tra theo TÊN không dấu — giống tệp nhập
 * của các loại dữ liệu khác (`module/system/dataimport`, đọc bằng SQL thuần cho các bảng tham chiếu).
 * Thiết bị chưa có trong danh mục thì dòng định mức không gắn thiết bị (tên nằm trên dòng) — tạo thiết
 * bị mới cần mã theo chuẩn của bộ sinh phụ lục, để người khai danh mục làm có chủ đích.
 */
@Component
public class EquipmentNormExcel {

    private static final int MAX_REPORTED = 20;
    /** "01/lớp", "01 bộ/5 lớp", "01/GV", "01/6HS", "03/trường", "01/phòng". */
    private static final Pattern QUANTITY = Pattern.compile(
            "^\\s*0*(\\d+)\\s*[\\p{L} ]*?/\\s*(\\d+)?\\s*([\\p{L} ]+?)\\s*$");
    private static final Pattern GRADES = Pattern.compile("lớp\\s*([0-9][0-9 ,;và\\-]*)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final EquipmentNormService norms;
    private final EquipmentStandardService standards;
    private final StandardDocumentService documents;
    private final JdbcTemplate jdbc;

    public EquipmentNormExcel(EquipmentNormService norms, EquipmentStandardService standards,
            StandardDocumentService documents, JdbcTemplate jdbc) {
        this.norms = norms;
        this.standards = standards;
        this.documents = documents;
        this.jdbc = jdbc;
    }

    private static final List<XlsxWriter.Column> COLUMNS = List.of(
            new XlsxWriter.Column("stt", "STT", "number"),
            new XlsxWriter.Column("subject", "Môn học", "string"),
            new XlsxWriter.Column("topic", "Chủ đề dạy học", "text"),
            new XlsxWriter.Column("name", "Tên thiết bị", "text"),
            new XlsxWriter.Column("purpose", "Mục đích sử dụng", "text"),
            new XlsxWriter.Column("description", "Mô tả chi tiết thiết bị dạy học", "text"),
            new XlsxWriter.Column("audience", "Đối tượng sử dụng (Giáo viên / Học sinh)", "string"),
            new XlsxWriter.Column("unit", "Đơn vị", "string"),
            new XlsxWriter.Column("quantity", "Số lượng", "string"),
            new XlsxWriter.Column("note", "Ghi chú", "text"));

    /** Tệp Excel của mọi dòng khớp bộ lọc (không phân trang). */
    @Transactional(readOnly = true)
    public Export export(ListParams params, Long standardId) {
        EquipmentStandard standard = standards.get(standardId);
        List<Map<String, Object>> rows = new ArrayList<>();
        int stt = 0;
        for (EquipmentNorm n : norms.listAll(params)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("stt", ++stt);
            row.put("subject", n.getSubject() == null ? null : n.getSubject().getName());
            row.put("topic", topicOf(n));
            row.put("name", n.getName());
            row.put("purpose", n.getPurpose());
            row.put("description", n.getDescription());
            row.put("audience", audience(n.isForTeacher(), n.isForStudent()));
            row.put("unit", n.getUnit() != null ? n.getUnit().getName() : n.getUnitText());
            row.put("quantity", n.getQuantityText() != null ? n.getQuantityText()
                    : n.getMinQuantity() == null ? null : n.getMinQuantity().stripTrailingZeros().toPlainString());
            row.put("note", n.getNote() != null ? n.getNote() : gradesRemark(n.getGradeLevels()));
            rows.add(row);
        }
        String level = standard.getEducationLevel() == null ? "" : standard.getEducationLevel().getName();
        String sources = documents.list(standardId).stream()
                .map(d -> d.documentNo())
                .collect(Collectors.joining(", "));
        byte[] body = XlsxWriter.write(new XlsxWriter.Sheet(
                "Danh mục thiết bị dạy học tối thiểu cấp " + level,
                sources.isEmpty() ? "" : "Nguồn: " + sources,
                COLUMNS, rows));
        String code = standard.getEducationLevel() == null ? "bo" : standard.getEducationLevel().getCode();
        return new Export(body, "Danh mục tối thiểu - " + ascii(code) + ".xlsx");
    }

    public record Export(byte[] body, String filename) {
    }

    /** Nhập tệp vào bộ NHÁP {@code standardId}; trả số dòng đã tạo. */
    @Transactional
    public int importFile(Long standardId, String filename, byte[] content) {
        EquipmentStandard standard = standards.get(standardId);
        List<List<String>> sheet = SpreadsheetReader.read(filename, content);

        int headerAt = -1;
        Map<String, Integer> cols = Map.of();
        for (int r = 0; r < Math.min(10, sheet.size()) && headerAt < 0; r++) {
            Map<String, Integer> found = headerColumns(sheet.get(r));
            if (found.containsKey("subject") && found.containsKey("name")) {
                headerAt = r;
                cols = found;
            }
        }
        if (headerAt < 0) {
            throw new FieldValidationException("file",
                    "Không tìm thấy dòng tiêu đề — tệp phải có cột \"Môn học\" và \"Tên thiết bị\" trong 10 dòng đầu");
        }

        Map<String, Long> subjects = byFoldedName("SELECT id, name FROM subjects");
        Map<String, Long> units = byFoldedName("SELECT id, name FROM units");
        String prefix = (standard.getEducationLevel() == null ? "" : standard.getEducationLevel().getCode()) + "-";
        Map<String, Long> catalogs = new HashMap<>();
        jdbc.query("""
                SELECT id, subject_id, name FROM equipment_catalogs
                WHERE owner_school_id IS NULL AND subject_id IS NOT NULL AND code LIKE ?""",
                rs -> {
                    catalogs.putIfAbsent(rs.getLong("subject_id") + "|" + fold(rs.getString("name")), rs.getLong("id"));
                }, prefix + "%");

        List<EquipmentNormRequest> requests = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        String batchCode = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        for (int r = headerAt + 1; r < sheet.size(); r++) {
            List<String> cells = sheet.get(r);
            Map<String, String> v = new HashMap<>();
            cols.forEach((key, idx) -> v.put(key, idx < cells.size() ? blankToNull(cells.get(idx)) : null));
            if (v.values().stream().allMatch(x -> x == null) || onlyStt(v)) {
                continue;
            }
            int line = r + 1;
            List<String> rowErrors = new ArrayList<>();
            String name = v.get("name");
            if (name == null) {
                rowErrors.add("thiếu tên thiết bị");
            }
            Long subject = null;
            if (v.get("subject") == null) {
                rowErrors.add("thiếu môn học");
            } else {
                subject = subjects.get(fold(v.get("subject")));
                if (subject == null) {
                    rowErrors.add("không có môn \"" + v.get("subject") + "\"");
                }
            }
            check(rowErrors, name, 255, "tên thiết bị");
            check(rowErrors, v.get("topic"), 500, "chủ đề");
            check(rowErrors, v.get("note"), 500, "ghi chú");
            check(rowErrors, v.get("quantity"), 100, "số lượng");
            Long unit = v.get("unit") == null ? null : units.get(fold(v.get("unit")));
            String unitText = unit == null ? v.get("unit") : null;
            check(rowErrors, unitText, 50, "đơn vị");
            if (!rowErrors.isEmpty()) {
                errors.add("Dòng " + line + ": " + String.join(", ", rowErrors));
                continue;
            }
            Long catalog = catalogs.get(subject + "|" + fold(name));
            String audience = v.get("audience") == null ? "" : fold(v.get("audience"));
            Quantity q = parseQuantity(v.get("quantity"));
            requests.add(new EquipmentNormRequest("DM-THPT-I-" + batchCode + "-" + line,
                    name, null, Boolean.TRUE, v.get("note"),
                    new IdRef(standardId), catalog == null ? null : new IdRef(catalog), null, null,
                    new IdRef(subject), null, null, q.min(), q.size(), v.get("quantity"), unitText,
                    unit == null ? null : new IdRef(unit), q.basis(), null, parseGrades(v.get("note")),
                    null, v.get("topic"), v.get("purpose"), v.get("description"),
                    audience.contains("GIAO_VIEN"), audience.contains("HOC_SINH"), Boolean.FALSE));
        }
        if (!errors.isEmpty()) {
            String shown = String.join("; ", errors.subList(0, Math.min(MAX_REPORTED, errors.size())));
            throw new FieldValidationException("file", "Chưa dòng nào được ghi — " + shown
                    + (errors.size() > MAX_REPORTED ? "; và " + (errors.size() - MAX_REPORTED) + " lỗi khác" : ""));
        }
        if (requests.isEmpty()) {
            throw new FieldValidationException("file", "Tệp không có dòng dữ liệu nào dưới dòng tiêu đề");
        }
        return norms.importRows(standardId, requests);
    }

    // ------------------------------------------------------------------ đọc tiêu đề, giá trị

    /** Cột theo tiêu đề không dấu — nhận cả tiêu đề của tệp xuất và các cách viết của phụ lục. */
    private static Map<String, Integer> headerColumns(List<String> cells) {
        Map<String, Integer> found = new HashMap<>();
        for (int i = 0; i < cells.size(); i++) {
            String h = cells.get(i) == null ? "" : fold(cells.get(i));
            String key = h.equals("STT") ? "stt"
                    : h.startsWith("MON_HOC") || h.equals("MON") ? "subject"
                    : h.startsWith("CHU_DE") ? "topic"
                    : h.startsWith("TEN_THIET_BI") || h.equals("TEN") ? "name"
                    : h.startsWith("MUC_DICH") ? "purpose"
                    : h.startsWith("MO_TA") ? "description"
                    : h.startsWith("DOI_TUONG") ? "audience"
                    : h.startsWith("DON_VI") ? "unit"
                    : h.startsWith("SO_LUONG") ? "quantity"
                    : h.startsWith("GHI_CHU") ? "note"
                    : null;
            if (key != null) {
                found.putIfAbsent(key, i);
            }
        }
        return found;
    }

    private record Quantity(BigDecimal min, NormBasis basis, Integer size) {
    }

    /**
     * Phần hiểu được của số lượng nguyên văn — cùng cách hiểu với bộ sinh phụ lục: "01/lớp" theo lớp,
     * "01 bộ/5 lớp" theo lớp cỡ 5, "01/GV" theo giáo viên, "01/6HS" theo học sinh cỡ 6, "03/trường",
     * "01/phòng". Không hiểu thì để trống — không tính tự động, như dòng phụ lục không ghi số.
     */
    static Quantity parseQuantity(String text) {
        if (text == null) {
            return new Quantity(null, null, null);
        }
        Matcher m = QUANTITY.matcher(text);
        if (!m.matches()) {
            return new Quantity(null, null, null);
        }
        BigDecimal min = new BigDecimal(m.group(1));
        Integer size = m.group(2) == null ? null : Integer.valueOf(m.group(2));
        String per = fold(m.group(3));
        NormBasis basis = switch (per) {
            case "LOP" -> NormBasis.PER_CLASS;
            case "GV", "GIAO_VIEN" -> NormBasis.PER_TEACHER;
            case "HS", "HOC_SINH" -> NormBasis.PER_STUDENT;
            case "TRUONG" -> NormBasis.PER_SCHOOL;
            case "PHONG" -> NormBasis.PER_ROOM;
            default -> null;
        };
        if (basis == null) {
            return new Quantity(null, null, null);
        }
        return new Quantity(min, basis, size == null || size <= 1 ? null : size);
    }

    /** "Dùng cho lớp 1, 2" → "1,2"; không ghi lớp thì để trống (mọi lớp). */
    static String parseGrades(String note) {
        if (note == null) {
            return null;
        }
        Matcher m = GRADES.matcher(note);
        if (!m.find()) {
            return null;
        }
        String grades = Arrays.stream(m.group(1).split("[^0-9]+"))
                .filter(g -> !g.isEmpty() && Integer.parseInt(g) >= 10 && Integer.parseInt(g) <= 12)
                .distinct()
                .collect(Collectors.joining(","));
        return grades.isEmpty() ? null : grades;
    }

    private static String topicOf(EquipmentNorm n) {
        if (n.getTopic() != null) {
            return n.getTopic();
        }
        if (n.getSectionName() == null) {
            return null;
        }
        return Arrays.stream(n.getSectionName().split(" › "))
                .map(String::trim)
                .filter(p -> p.toLowerCase(Locale.ROOT).startsWith("chủ đề"))
                .findFirst().orElse(null);
    }

    private static String audience(boolean teacher, boolean student) {
        if (teacher && student) {
            return "Giáo viên, Học sinh";
        }
        return teacher ? "Giáo viên" : student ? "Học sinh" : null;
    }

    private static String gradesRemark(String gradeLevels) {
        return gradeLevels == null || gradeLevels.isBlank() ? null
                : "Dùng cho lớp " + gradeLevels.replace(",", ", ");
    }

    private Map<String, Long> byFoldedName(String sql) {
        Map<String, Long> map = new HashMap<>();
        jdbc.query(sql, rs -> {
            map.putIfAbsent(fold(rs.getString("name")), rs.getLong("id"));
        });
        return map;
    }

    private static boolean onlyStt(Map<String, String> v) {
        return v.entrySet().stream().allMatch(e -> e.getKey().equals("stt") || e.getValue() == null);
    }

    private static void check(List<String> errors, String value, int max, String label) {
        if (value != null && value.length() > max) {
            errors.add(label + " dài quá " + max + " ký tự");
        }
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    static String fold(String s) {
        String n = Normalizer.normalize(s == null ? "" : s.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        return n.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }

    private static String ascii(String s) {
        return fold(s).toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
