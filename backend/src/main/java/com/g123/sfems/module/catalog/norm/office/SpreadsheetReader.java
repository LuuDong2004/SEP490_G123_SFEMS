package com.g123.sfems.module.catalog.norm.office;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Đọc trang tính đầu tiên (hoặc mọi trang — {@link #readAll}) của một tệp .xlsx,
 * hoặc một tệp .csv, thành các dòng chữ. Mỗi ô là chuỗi đúng như người dùng thấy: số nguyên không kèm ".0", còn ô
 * ngày của Excel là một SỐ NGÀY — cột nào là ngày thì người gọi tự đổi, vì chỉ
 * người gọi biết.
 *
 * <p>Tự viết trên StAX chứ không dùng Apache POI, cùng lý do với
 * {@link XlsxWriter}. Tắt DTD và thực thể ngoài: tệp do người dùng tải lên là dữ
 * liệu không tin cậy, và một XML có {@code <!DOCTYPE>} là cửa của XXE.
 */
public final class SpreadsheetReader {

    /** Trần kích thước sau giải nén — chặn "zip bomb" nở ra hàng GB. */
    private static final long MAX_UNCOMPRESSED = 50L * 1024 * 1024;
    private static final int MAX_ROWS = 20_000;
    /**
     * Trần số cột và độ dài một ô. Thiếu trần cột, một ô đặt ở cột XFD làm mỗi dòng đệm 16.384 ô trống —
     * 20.000 dòng như thế là vài GB bộ nhớ từ một tệp vài trăm KB.
     */
    private static final int MAX_COLUMNS = 200;
    private static final int MAX_CELL = 2_000;

    private SpreadsheetReader() {
    }

    public static List<List<String>> read(String filename, byte[] content) {
        String name = filename == null ? "" : filename.toLowerCase();
        if (name.endsWith(".csv")) {
            return csv(new String(content, StandardCharsets.UTF_8));
        }
        if (name.endsWith(".xlsx")) {
            return xlsx(content);
        }
        throw new FieldValidationException("file", "Chỉ nhận tệp .xlsx hoặc .csv");
    }

    /** Một trang tính: tên (như trên thẻ trang của Excel) và các dòng chữ. */
    public record NamedSheet(String name, List<List<String>> rows) {
    }

    /**
     * MỌI trang tính của tệp .xlsx, theo thứ tự trên thanh trang. Tệp .csv là một trang không tên.
     * Dùng cho tệp nhập nhiều loại dữ liệu cùng lúc (cơ sở, phòng, cán bộ, thiết bị…).
     */
    public static List<NamedSheet> readAll(String filename, byte[] content) {
        String name = filename == null ? "" : filename.toLowerCase();
        if (name.endsWith(".csv")) {
            return List.of(new NamedSheet("", csv(csvText(content))));
        }
        if (!name.endsWith(".xlsx")) {
            throw new FieldValidationException("file", "Chỉ nhận tệp .xlsx hoặc .csv");
        }
        Map<String, byte[]> parts = parts(content);
        List<String> shared = sharedStrings(parts.get("xl/sharedStrings.xml"));
        List<NamedSheet> result = new ArrayList<>();
        for (Map.Entry<String, String> sheet : sheets(parts).entrySet()) {
            byte[] xml = parts.get(sheet.getValue());
            if (xml != null) {
                result.add(new NamedSheet(sheet.getKey(), sheetRows(xml, shared)));
            }
        }
        if (result.isEmpty()) {
            throw new FieldValidationException("file", "Tệp Excel không có trang tính nào");
        }
        return result;
    }

    // ------------------------------------------------------------------ xlsx

    private static List<List<String>> xlsx(byte[] content) {
        Map<String, byte[]> parts = parts(content);
        String sheetPath = sheets(parts).values().stream().findFirst().orElse("xl/worksheets/sheet1.xml");
        byte[] sheet = parts.get(sheetPath);
        if (sheet == null) {
            throw new FieldValidationException("file", "Tệp Excel không có trang tính nào");
        }
        List<String> shared = sharedStrings(parts.get("xl/sharedStrings.xml"));
        return sheetRows(sheet, shared);
    }

    private static Map<String, byte[]> parts(byte[] content) {
        // .xlsx là tệp zip: bốn byte đầu phải là "PK". Tệp khác đổi đuôi thành .xlsx bị từ chối ngay.
        if (content.length < 4 || content[0] != 'P' || content[1] != 'K' || content[2] != 3 || content[3] != 4) {
            throw new FieldValidationException("file", "Tệp không phải Excel .xlsx thật — hãy lưu lại bằng Excel rồi tải lên");
        }
        Map<String, byte[]> parts = new HashMap<>();
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String n = entry.getName();
                if (!n.equals("xl/sharedStrings.xml") && !n.equals("xl/workbook.xml")
                        && !n.equals("xl/_rels/workbook.xml.rels") && !n.startsWith("xl/worksheets/sheet")) {
                    continue;
                }
                byte[] bytes = zip.readNBytes((int) Math.min(MAX_UNCOMPRESSED - total + 1, Integer.MAX_VALUE - 8));
                total += bytes.length;
                if (total > MAX_UNCOMPRESSED) {
                    throw new FieldValidationException("file", "Tệp quá lớn sau khi giải nén");
                }
                parts.put(n, bytes);
            }
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp Excel — tệp hỏng hoặc không phải .xlsx");
        }
        return parts;
    }

    /** Tên trang → đường dẫn phần XML của trang, theo thứ tự trên thanh trang. */
    private static Map<String, String> sheets(Map<String, byte[]> parts) {
        Map<String, String> ids = new LinkedHashMap<>();
        Map<String, String> result = new LinkedHashMap<>();
        try {
            XMLStreamReader x = reader(parts.get("xl/workbook.xml"));
            while (x != null && x.hasNext()) {
                if (x.next() == XMLStreamConstants.START_ELEMENT && "sheet".equals(x.getLocalName())) {
                    String sheetName = x.getAttributeValue(null, "name");
                    for (int i = 0; i < x.getAttributeCount(); i++) {
                        if ("id".equals(x.getAttributeLocalName(i))) {
                            ids.put(sheetName == null ? "" : sheetName, x.getAttributeValue(i));
                        }
                    }
                }
            }
            Map<String, String> targets = new HashMap<>();
            XMLStreamReader r = reader(parts.get("xl/_rels/workbook.xml.rels"));
            while (r != null && r.hasNext()) {
                if (r.next() == XMLStreamConstants.START_ELEMENT && "Relationship".equals(r.getLocalName())) {
                    String target = r.getAttributeValue(null, "Target");
                    targets.put(r.getAttributeValue(null, "Id"),
                            target.startsWith("/") ? target.substring(1) : "xl/" + target);
                }
            }
            ids.forEach((sheetName, rid) -> {
                if (targets.containsKey(rid)) {
                    result.put(sheetName, targets.get(rid));
                }
            });
        } catch (XMLStreamException e) {
            // rơi xuống mặc định
        }
        if (result.isEmpty()) {
            result.put("", "xl/worksheets/sheet1.xml");
        }
        return result;
    }

    private static List<String> sharedStrings(byte[] xml) {
        List<String> result = new ArrayList<>();
        if (xml == null) {
            return result;
        }
        try {
            XMLStreamReader x = reader(xml);
            StringBuilder current = null;
            boolean inPhonetic = false;
            while (x.hasNext()) {
                int ev = x.next();
                if (ev == XMLStreamConstants.START_ELEMENT) {
                    switch (x.getLocalName()) {
                        case "si" -> current = new StringBuilder();
                        case "rPh" -> inPhonetic = true;
                        case "t" -> {
                            if (current != null && !inPhonetic) {
                                current.append(x.getElementText());
                            }
                        }
                        default -> {
                        }
                    }
                } else if (ev == XMLStreamConstants.END_ELEMENT) {
                    if ("si".equals(x.getLocalName()) && current != null) {
                        result.add(current.toString());
                        current = null;
                    } else if ("rPh".equals(x.getLocalName())) {
                        inPhonetic = false;
                    }
                }
            }
        } catch (XMLStreamException e) {
            throw new FieldValidationException("file", "Tệp Excel hỏng (bảng chuỗi)");
        }
        return result;
    }

    private static List<List<String>> sheetRows(byte[] xml, List<String> shared) {
        List<List<String>> rows = new ArrayList<>();
        try {
            XMLStreamReader x = reader(xml);
            TreeMap<Integer, String> row = null;
            int rowNumber = 0;
            String ref = null;
            String type = null;
            String value = null;
            while (x.hasNext()) {
                int ev = x.next();
                if (ev == XMLStreamConstants.START_ELEMENT) {
                    switch (x.getLocalName()) {
                        case "row" -> {
                            row = new TreeMap<>();
                            String r = x.getAttributeValue(null, "r");
                            rowNumber = r != null && r.matches("\\d+") ? Integer.parseInt(r) : rows.size() + 1;
                        }
                        case "c" -> {
                            ref = x.getAttributeValue(null, "r");
                            type = x.getAttributeValue(null, "t");
                            value = null;
                        }
                        case "v" -> value = x.getElementText();
                        case "t" -> value = (value == null ? "" : value) + x.getElementText();
                        default -> {
                        }
                    }
                } else if (ev == XMLStreamConstants.END_ELEMENT) {
                    if ("c".equals(x.getLocalName()) && row != null) {
                        String text = cellText(type, value, shared);
                        int col = ref == null ? row.size() : column(ref);
                        if (text != null && !text.isEmpty()) {
                            if (col >= MAX_COLUMNS) {
                                throw new FieldValidationException("file",
                                        "Ô %s nằm ngoài %d cột đầu — xoá các cột thừa bên phải".formatted(ref, MAX_COLUMNS));
                            }
                            row.put(col, checkCell(text, ref));
                        }
                    } else if ("row".equals(x.getLocalName()) && row != null) {
                        // Excel không ghi dòng trống: chèn lại để vị trí trong danh sách đúng số dòng trên tệp —
                        // báo lỗi "dòng 134" phải là dòng 134 người dùng thấy.
                        while (rows.size() < rowNumber - 1 && rows.size() < MAX_ROWS) {
                            rows.add(new ArrayList<>());
                        }
                        List<String> cells = new ArrayList<>();
                        int max = row.isEmpty() ? -1 : row.lastKey();
                        for (int i = 0; i <= max; i++) {
                            cells.add(row.getOrDefault(i, ""));
                        }
                        rows.add(cells);
                        if (rows.size() > MAX_ROWS) {
                            throw new FieldValidationException("file", "Tệp có quá %d dòng — chia nhỏ ra".formatted(MAX_ROWS));
                        }
                        row = null;
                    }
                }
            }
        } catch (XMLStreamException e) {
            throw new FieldValidationException("file", "Tệp Excel hỏng (trang tính)");
        }
        return rows;
    }

    private static String cellText(String type, String value, List<String> shared) {
        if (value == null) {
            return null;
        }
        if ("s".equals(type)) {
            int i = Integer.parseInt(value.trim());
            return i >= 0 && i < shared.size() ? shared.get(i) : "";
        }
        if (type == null || "n".equals(type)) {
            try {
                BigDecimal n = new BigDecimal(value.trim());
                return n.stripTrailingZeros().toPlainString();
            } catch (NumberFormatException e) {
                return value;
            }
        }
        return value;
    }

    /** "C12" → 2. */
    private static String checkCell(String text, String where) {
        if (text.length() > MAX_CELL) {
            throw new FieldValidationException("file", "Ô %s dài quá %,d ký tự".formatted(where, MAX_CELL));
        }
        return text;
    }

    /** Văn bản của tệp .csv; tệp có byte 0 là tệp nhị phân đổi đuôi, không phải CSV. */
    private static String csvText(byte[] content) {
        for (byte b : content) {
            if (b == 0) {
                throw new FieldValidationException("file", "Tệp không phải CSV thật");
            }
        }
        return new String(content, StandardCharsets.UTF_8);
    }

    private static int column(String ref) {
        int col = 0;
        for (char ch : ref.toCharArray()) {
            if (Character.isLetter(ch)) {
                col = col * 26 + (Character.toUpperCase(ch) - 'A' + 1);
            } else {
                break;
            }
        }
        return col - 1;
    }

    private static XMLStreamReader reader(byte[] xml) throws XMLStreamException {
        if (xml == null) {
            return null;
        }
        XMLInputFactory f = XMLInputFactory.newFactory();
        f.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        f.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        InputStream in = new ByteArrayInputStream(xml);
        return f.createXMLStreamReader(in, "UTF-8");
    }

    // ------------------------------------------------------------------ csv

    private static List<List<String>> csv(String text) {
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        char sep = text.lines().findFirst().map(l -> l.chars().filter(c -> c == ';').count()
                > l.chars().filter(c -> c == ',').count() ? ';' : ',').orElse(',');
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    cell.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == sep) {
                row.add(checkCell(cell.toString(), "dòng " + (rows.size() + 1)));
                if (row.size() > MAX_COLUMNS) {
                    throw new FieldValidationException("file", "Dòng %d có quá %d cột".formatted(rows.size() + 1, MAX_COLUMNS));
                }
                cell.setLength(0);
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(checkCell(cell.toString(), "dòng " + (rows.size() + 1)));
                cell.setLength(0);
                rows.add(row);
                row = new ArrayList<>();
                if (rows.size() > MAX_ROWS) {
                    throw new FieldValidationException("file", "Tệp có quá %d dòng — chia nhỏ ra".formatted(MAX_ROWS));
                }
            } else {
                cell.append(ch);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }
}
