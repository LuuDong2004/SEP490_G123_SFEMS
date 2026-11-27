package com.g123.sfems.shared.office;

import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.validation.FieldRule;
import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.web.multipart.MultipartFile;

/**
 * Phần chung của các màn "Nhập Excel" cập nhật một danh mục (danh sách trường, phường/xã): tệp mẫu, tìm trang
 * và dòng tiêu đề theo NHÃN cột (đổi thứ tự cột, thêm cột riêng, nhiều trang tính đều được), và kết quả xem trước
 * cùng một dạng để giao diện dùng một hộp thoại cho mọi loại.
 */
public final class SheetImport {

    private SheetImport() {
    }

    /** Một cột của tệp: khoá, nhãn trên tệp mẫu, các tên khác vẫn nhận. */
    public record Column(String key, String label, boolean required, String hint, List<String> aliases) {
    }

    /** Lỗi hoặc lưu ý của một dòng. */
    public record Issue(int row, String key, String name, List<String> messages) {
    }

    /** {@code kind}: CREATE, UPDATE, DEACTIVATE, KEEP (ngoài tệp nhưng còn được dùng nên giữ). */
    public record Change(String kind, Integer row, String code, String key, String name, List<String> fields) {
    }

    public record Result(int total, int outOfScope, int created, int updated, int unchanged, int deactivated,
            List<Issue> errors, List<Issue> warnings, List<Change> changes, boolean committed) {
    }

    /** Một dòng của lô chờ: id dòng chờ, số dòng trên tệp, giá trị theo khoá cột. */
    public record Input(long id, int row, Map<String, String> values) {
    }

    /**
     * Kết quả kiểm một dòng: {@code status} OK (sẽ thêm hoặc sửa), EXISTS (đã có, không đổi), WARNING (ghi được, có
     * lưu ý), ERROR (chặn ghi); {@code change} nói dòng sẽ làm gì ("Thêm mới", "Cập nhật: tên, phường/xã").
     */
    public record RowCheck(String status, List<String> errors, List<String> warnings, String change) {
    }

    /** Kiểm cả lô: kết quả tóm tắt, từng dòng theo id, lỗi của cả lô (không thuộc dòng nào). */
    public record Checked(Result result, Map<Long, RowCheck> rows, List<String> batchErrors) {
    }

    /** Một bản ghi lô đã sửa / ngừng: giá trị trước đó, để hoàn tác. */
    public record Snapshot(long recordId, String action, Map<String, Object> before) {
    }

    /** Lô danh mục đã ghi: bản ghi tạo mới và bản ghi đã sửa / ngừng. */
    public record Applied(List<Long> created, List<Snapshot> snapshots) {
    }

    /** Các dòng dữ liệu đã đọc (khoá theo {@link Column#key()}), kèm số dòng trên Excel. */
    public record Rows(List<Map<String, String>> values, List<Integer> excelRows) {
    }

    public static byte[] template(String title, List<Column> columns) {
        List<XlsxWriter.Column> cols = columns.stream()
                .map(c -> new XlsxWriter.Column(c.key(), c.label() + (c.required() ? " (*)" : ""), "text")).toList();
        Map<String, Object> hint = new HashMap<>();
        columns.forEach(c -> hint.put(c.key(), c.hint()));
        return XlsxWriter.write(new XlsxWriter.Sheet(title,
                "Cột có (*) là bắt buộc. Xoá dòng hướng dẫn này trước khi nhập.", cols, List.of(hint)));
    }

    /**
     * Đọc trang tính đầu tiên có dòng tiêu đề đủ các cột bắt buộc (tìm trong 10 dòng đầu). Bỏ dòng trống và dòng
     * hướng dẫn của tệp mẫu.
     */
    public static Rows read(String filename, byte[] content, List<Column> columns, int maxRows) {
        Map<String, String> byLabel = new HashMap<>();
        for (Column c : columns) {
            byLabel.put(fold(c.label()), c.key());
            c.aliases().forEach(a -> byLabel.put(fold(a), c.key()));
        }
        List<String> required = columns.stream().filter(Column::required).map(Column::key).toList();
        for (SpreadsheetReader.NamedSheet sheet : SpreadsheetReader.readAll(filename, content)) {
            List<List<String>> rows = sheet.rows();
            for (int i = 0; i < Math.min(rows.size(), 10); i++) {
                Map<Integer, String> keys = new LinkedHashMap<>();
                List<String> cells = rows.get(i);
                for (int c = 0; c < cells.size(); c++) {
                    String raw = cells.get(c);
                    String key = byLabel.get(fold(raw == null ? null : raw.replace("(*)", "")));
                    if (key != null && !keys.containsValue(key)) {
                        keys.put(c, key);
                    }
                }
                if (keys.values().containsAll(required)) {
                    return rows(rows, i, keys, columns, maxRows);
                }
            }
        }
        throw new FieldValidationException("file", "Không tìm thấy trang có dòng tiêu đề đủ các cột bắt buộc: "
                + String.join(", ", columns.stream().filter(Column::required).map(Column::label).toList()));
    }

    private static Rows rows(List<List<String>> sheet, int header, Map<Integer, String> keys, List<Column> columns,
            int maxRows) {
        List<Map<String, String>> values = new ArrayList<>();
        List<Integer> excelRows = new ArrayList<>();
        for (int i = header + 1; i < sheet.size(); i++) {
            List<String> cells = sheet.get(i);
            Map<String, String> v = new HashMap<>();
            for (Map.Entry<Integer, String> k : keys.entrySet()) {
                v.put(k.getValue(), k.getKey() < cells.size() ? clean(cells.get(k.getKey())) : null);
            }
            if (v.values().stream().allMatch(Objects::isNull)) {
                continue;
            }
            if (i == header + 1 && columns.stream().anyMatch(c -> !c.hint().isBlank() && c.hint().equals(v.get(c.key())))) {
                continue;
            }
            values.add(v);
            excelRows.add(i + 1);
        }
        if (values.isEmpty()) {
            throw new FieldValidationException("file", "Tệp không có dòng dữ liệu nào dưới dòng tiêu đề");
        }
        if (values.size() > maxRows) {
            throw new FieldValidationException("file",
                    "Tệp có %,d dòng, quá %,d dòng cho loại dữ liệu này — kiểm tra lại tệp".formatted(values.size(), maxRows));
        }
        return new Rows(values, excelRows);
    }

    /**
     * Kiểm một ô chữ: đúng kiểu dữ liệu chuẩn ({@link FieldRule}: độ dài, ký tự điều khiển…) và không giống công thức
     * Excel. Ô bắt đầu bằng {@code = + @} sẽ thành công thức khi dữ liệu được xuất lại ra Excel (chèn công thức),
     * nên từ chối ngay lúc nhập. Thêm lỗi vào {@code errors}, không ném.
     */
    public static void check(List<String> errors, String label, String value, FieldRule rule, int max) {
        if (value == null) {
            return;
        }
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '@') {
            errors.add(label + " bắt đầu bằng \"" + first + "\" — Excel sẽ hiểu là công thức");
            return;
        }
        String violation = rule.violation(value, max);
        if (violation != null) {
            errors.add(label + " " + violation);
        }
    }

    private static final long MAX_UPLOAD = 10L * 1024 * 1024;

    /** Nội dung tệp tải lên, tối đa 10 MB. */
    public static byte[] bytes(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new FieldValidationException("file", "Chọn tệp để nhập");
        }
        if (file.getSize() > MAX_UPLOAD) {
            throw new FieldValidationException("file", "Tệp tối đa 10 MB");
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
    }

    /**
     * Tra id theo TÊN: đúng tên có dấu trước (không phân biệt hoa thường), không dấu chỉ khi chỉ một tên khớp.
     * Tên địa danh khác nhau đúng ở dấu là chuyện có thật (Xã Thạnh An, Xã Thanh An), nên bỏ dấu ngay từ đầu sẽ gắn
     * nhầm.
     */
    public static final class NameIndex {
        private final Map<String, Long> exact = new HashMap<>();
        private final Map<String, Long> folded = new HashMap<>();
        private final java.util.Set<String> ambiguous = new java.util.HashSet<>();

        public void put(String name, long id) {
            String e = lower(name);
            String f = fold(name);
            if (e == null) {
                return;
            }
            exact.put(e, id);
            Long other = folded.putIfAbsent(f, id);
            if (other != null && other != id) {
                ambiguous.add(f);
            }
        }

        public Long get(String name) {
            String e = lower(name);
            if (e == null) {
                return null;
            }
            Long id = exact.get(e);
            if (id != null) {
                return id;
            }
            String f = fold(name);
            return ambiguous.contains(f) ? null : folded.get(f);
        }

        public boolean contains(String name) {
            return get(name) != null;
        }
    }

    /**
     * Hai chuỗi giống nhau khi đọc: cùng chữ sau khi chuẩn hoá Unicode (NFC). Chữ Việt có dấu viết được hai cách (dựng
     * sẵn và tổ hợp) trông y hệt nhau — so thẳng thì dữ liệu cũ và tệp mới bị coi là khác dù không ai sửa gì.
     */
    public static boolean same(String a, String b) {
        if (a == null || b == null) {
            return a == b;
        }
        return Normalizer.normalize(a, Normalizer.Form.NFC).equals(Normalizer.normalize(b, Normalizer.Form.NFC));
    }

    /** Chữ thường, gộp khoảng trắng, GIỮ dấu. */
    public static String lower(String value) {
        String t = clean(value);
        return t == null ? null : Normalizer.normalize(t, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }

    /** Bỏ khoảng trắng thừa; chuỗi rỗng thành {@code null}. */
    public static String clean(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim().replaceAll("\\s+", " ");
        return t.isEmpty() ? null : t;
    }

    /** Chữ thường, bỏ dấu, gộp khoảng trắng — để so tên không lệch vì gõ khác. */
    public static String fold(String value) {
        String t = clean(value);
        if (t == null) {
            return null;
        }
        return Normalizer.normalize(t.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }
}
