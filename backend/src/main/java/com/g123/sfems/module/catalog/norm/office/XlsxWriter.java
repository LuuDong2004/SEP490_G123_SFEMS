package com.g123.sfems.module.catalog.norm.office;

import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Ghi một bảng — tiêu đề, dòng phụ, cột có kiểu, các dòng — ra tệp Excel (.xlsx).
 * Báo cáo, mẫu nhập liệu và bản xuất toàn bộ dữ liệu đều đi qua đây.
 *
 * <p>Tự viết chứ không kéo Apache POI vào: một bảng tính một trang, chữ đậm ở
 * hàng tiêu đề, số là số thật (cộng, lọc, sắp xếp được trong Excel), ngày là ngày
 * thật — chừng đó là vài trăm dòng XML, còn POI là hơn chục MB thư viện cho một
 * việc báo cáo không cần gì hơn. Chuỗi viết inline nên không cần bảng
 * sharedStrings.
 *
 * <p>Ba kiểu ô: {@code 1} tiêu đề (đậm, nền xám), {@code 2} số có phân cách hàng
 * nghìn, {@code 3} ngày dd/mm/yyyy; {@code 4} là dòng tên báo cáo (đậm, cỡ lớn).
 */
public final class XlsxWriter {

    /** Kiểu cột: {@code text}, {@code number}, {@code money}, {@code date}, {@code id} (số không phân cách). */
    public record Column(String key, String label, String type) {
    }

    public record Sheet(String title, String subtitle, List<Column> columns, List<Map<String, Object>> rows) {
    }

    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);

    private XlsxWriter() {
    }

    /** Một trang tính có tên — cho tệp nhiều trang (vd. mỗi trường một trang). */
    public record Tab(String name, Sheet sheet) {
    }

    public static byte[] write(Sheet report) {
        return writeAll(List.of(new Tab("Bao cao", report)));
    }

    /**
     * Tệp nhiều trang tính, theo đúng thứ tự truyền vào. Tên trang được làm sạch theo luật của Excel (tối đa
     * 31 ký tự, không có {@code [ ] : * ? / \}, không trùng nhau) — tên sai luật là tệp Excel từ chối mở.
     */
    public static byte[] writeAll(List<Tab> tabs) {
        List<String> names = sheetNames(tabs);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            packageParts(zip, names);
            for (int i = 0; i < tabs.size(); i++) {
                entry(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", sheet(tabs.get(i).sheet()));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    /** Các phần chung của gói .xlsx (kiểu nội dung, sổ, quan hệ, kiểu ô) cho {@code names.size()} trang tính. */
    private static void packageParts(ZipOutputStream zip, List<String> names) throws IOException {
        StringBuilder overrides = new StringBuilder();
        StringBuilder sheets = new StringBuilder();
        StringBuilder rels = new StringBuilder();
        for (int i = 1; i <= names.size(); i++) {
            overrides.append("<Override PartName=\"/xl/worksheets/sheet").append(i)
                    .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
            sheets.append("<sheet name=\"").append(escape(names.get(i - 1))).append("\" sheetId=\"").append(i)
                    .append("\" r:id=\"rId").append(i).append("\"/>");
            rels.append("<Relationship Id=\"rId").append(i)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                    .append(i).append(".xml\"/>");
        }
        String stylesId = "rId" + (names.size() + 1);
        entry(zip, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                <Default Extension="xml" ContentType="application/xml"/>
                <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                %s
                <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>""".formatted(overrides));
        entry(zip, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>""");
        entry(zip, "xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheets>%s</sheets>
                </workbook>""".formatted(sheets));
        entry(zip, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                %s
                <Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>""".formatted(rels, stylesId));
        entry(zip, "xl/styles.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.0#"/></numFmts>
                <fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
                <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/></patternFill></fill></fills>
                <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
                <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                <cellXfs count="8">
                <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>
                <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf>
                <xf numFmtId="3" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
                <xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
                <xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
                <xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>
                </cellXfs>
                </styleSheet>""");
    }

    /**
     * Một tệp .xlsx một trang tính ghi THẲNG ra {@code out}, từng dòng một — không giữ dòng nào trong bộ nhớ, cho
     * bảng hàng triệu dòng (xuất toàn bộ dữ liệu). Khác {@link #write}: bề rộng cột đoán theo kiểu và tiêu đề vì
     * chưa thấy dữ liệu, và dòng phụ phải biết trước. {@link SheetStream#close} kết thúc tệp nhưng KHÔNG đóng
     * {@code out} — nó có thể là một mục trong tệp .zip lớn hơn.
     */
    public static SheetStream stream(OutputStream out, String title, String subtitle, List<Column> columns) {
        try {
            return new SheetStream(out, title, subtitle, columns);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Excel nhận tối đa 1.048.576 dòng một trang; trừ bốn dòng đầu (tên, dòng phụ, dòng trống, tiêu đề cột). */
    public static final int MAX_DATA_ROWS = 1_048_576 - 4;

    public static final class SheetStream implements Closeable {

        private final ZipOutputStream zip;
        private final Writer xml;
        private final List<Column> columns;
        private int row;
        private int written;

        private SheetStream(OutputStream out, String title, String subtitle, List<Column> columns) throws IOException {
            // Đóng gói .xlsx không được đóng luồng bên ngoài: close() của zip gọi close() của luồng nó bọc.
            this.zip = new ZipOutputStream(new FilterOutputStream(out) {
                @Override
                public void write(byte[] b, int off, int len) throws IOException {
                    out.write(b, off, len);
                }

                @Override
                public void close() throws IOException {
                    flush();
                }
            });
            this.columns = columns;
            packageParts(zip, List.of("Bao cao"));
            zip.putNextEntry(new ZipEntry("xl/worksheets/sheet1.xml"));
            this.xml = new BufferedWriter(new OutputStreamWriter(zip, StandardCharsets.UTF_8), 64 * 1024);
            xml.write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                    + "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><cols>");
            for (int i = 0; i < columns.size(); i++) {
                xml.write("<col min=\"" + (i + 1) + "\" max=\"" + (i + 1) + "\" width=\""
                        + guessWidth(columns.get(i)) + "\" customWidth=\"1\"/>");
            }
            xml.write("</cols><sheetData>");
            row = 1;
            xml.write("<row r=\"1\">" + text(0, 1, title, 4) + "</row>");
            row = 2;
            xml.write("<row r=\"2\">" + text(0, 2, subtitle, 5) + "</row>");
            row = 4;
            StringBuilder header = new StringBuilder("<row r=\"4\">");
            for (int i = 0; i < columns.size(); i++) {
                header.append(text(i, row, columns.get(i).label(), 1));
            }
            xml.write(header.append("</row>").toString());
        }

        /** Một dòng, giá trị theo thứ tự cột. */
        public void row(Object[] values) {
            if (written >= MAX_DATA_ROWS) {
                throw new IllegalStateException("Trang tính đã đủ " + MAX_DATA_ROWS + " dòng");
            }
            row++;
            written++;
            StringBuilder line = new StringBuilder(64 + columns.size() * 24).append("<row r=\"").append(row)
                    .append("\">");
            for (int i = 0; i < columns.size(); i++) {
                line.append(cell(i, row, columns.get(i).type(), values[i]));
            }
            try {
                xml.write(line.append("</row>").toString());
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        public int rows() {
            return written;
        }

        @Override
        public void close() throws IOException {
            xml.write("</sheetData></worksheet>");
            xml.flush();
            zip.closeEntry();
            zip.finish();
            zip.close();
        }

        private static int guessWidth(Column column) {
            int label = column.label() == null ? 0 : column.label().length();
            return switch (column.type()) {
                case "id" -> Math.max(10, Math.min(label, 14) + 3);
                case "date" -> 12;
                case "number", "money" -> Math.max(14, Math.min(label, 14) + 3);
                default -> Math.max(20, Math.min(60, label + 3));
            };
        }
    }

    private static List<String> sheetNames(List<Tab> tabs) {
        List<String> out = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (Tab tab : tabs) {
            String base = (tab.name() == null || tab.name().isBlank() ? "Trang" : tab.name())
                    .replaceAll("[\\[\\]:*?/\\\\]", " ").trim();
            base = base.length() > 31 ? base.substring(0, 31).trim() : base;
            String name = base;
            for (int n = 2; !used.add(name.toLowerCase(Locale.ROOT)); n++) {
                String suffix = " (" + n + ")";
                name = (base.length() + suffix.length() > 31 ? base.substring(0, 31 - suffix.length()) : base) + suffix;
            }
            out.add(name);
        }
        return out;
    }

    private static String sheet(Sheet report) {
        List<Column> columns = report.columns();
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
                .append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">")
                .append("<cols>");
        for (int i = 0; i < columns.size(); i++) {
            int width = width(columns.get(i), report.rows());
            xml.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1).append("\" width=\"")
                    .append(width).append("\" customWidth=\"1\"/>");
        }
        xml.append("</cols><sheetData>");
        int row = 1;
        xml.append("<row r=\"").append(row).append("\">").append(text(0, row, report.title(), 4)).append("</row>");
        row++;
        xml.append("<row r=\"").append(row).append("\">").append(text(0, row, report.subtitle(), 5)).append("</row>");
        row += 2;
        xml.append("<row r=\"").append(row).append("\">");
        for (int i = 0; i < columns.size(); i++) {
            xml.append(text(i, row, columns.get(i).label(), 1));
        }
        xml.append("</row>");
        for (Map<String, Object> values : report.rows()) {
            row++;
            xml.append("<row r=\"").append(row).append("\">");
            for (int i = 0; i < columns.size(); i++) {
                Column c = columns.get(i);
                Object v = values.get(c.key());
                xml.append(cell(i, row, c.type(), v));
            }
            xml.append("</row>");
        }
        xml.append("</sheetData></worksheet>");
        return xml.toString();
    }

    /**
     * Bề rộng cột theo NỘI DUNG của nó: dài bằng dòng dài nhất (kể cả tiêu đề), trong khoảng 8 – 60 ký tự.
     * Bề rộng cố định làm cột mã rộng thừa còn cột tên thiết bị bị cắt.
     */
    private static int width(Column column, List<Map<String, Object>> rows) {
        // Tiêu đề tự xuống dòng, nên ở cột số nó không được kéo cả cột rộng ra theo một tiêu đề dài.
        int label = column.label() == null ? 0 : column.label().length();
        int longest = "text".equals(column.type()) ? label : Math.min(label, 14);
        for (Map<String, Object> values : rows) {
            Object v = values.get(column.key());
            if (v == null) {
                continue;
            }
            // Số: độ dài phần nguyên cộng dấu ngăn hàng nghìn và hai chữ số lẻ; ngày: dd/mm/yyyy.
            int length = v instanceof Number n ? String.valueOf(n.longValue()).length() * 4 / 3 + 3
                    : v instanceof LocalDate || v instanceof java.util.Date ? 10
                    : String.valueOf(v).length();
            longest = Math.max(longest, length);
        }
        return Math.max(8, Math.min(60, longest + 3));
    }

    private static String cell(int col, int row, String type, Object value) {
        if (value == null) {
            // Ô trống vẫn phải có khung. Kiểu 0 là kiểu MẶC ĐỊNH của sổ: Excel không vẽ viền cho ô trống mang
            // kiểu mặc định, nên ô trống dùng một kiểu riêng (7) giống hệt nó.
            return "<c r=\"" + ref(col, row) + "\" s=\"7\"/>";
        }
        if (value instanceof Number n && "id".equals(type)) {
            return "<c r=\"" + ref(col, row) + "\" s=\"0\"><v>" + n + "</v></c>";
        }
        if (value instanceof Number n && !"text".equals(type)) {
            // Ô số là SỐ THẬT, có ngăn hàng nghìn theo máy người mở (15.750 ở máy tiếng Việt). Số có phần lẻ
            // (kg, lít) dùng kiểu riêng — "#,##0" làm tròn mất phần lẻ.
            boolean fraction = new BigDecimal(n.toString()).stripTrailingZeros().scale() > 0;
            return "<c r=\"" + ref(col, row) + "\" s=\"" + (fraction ? 6 : 2) + "\"><v>" + n + "</v></c>";
        }
        LocalDate date = switch (value) {
            case LocalDate d -> d;
            case java.sql.Date d -> d.toLocalDate();
            case java.sql.Timestamp t -> t.toLocalDateTime().toLocalDate();
            default -> null;
        };
        if (date != null) {
            return "<c r=\"" + ref(col, row) + "\" s=\"3\"><v>" + ChronoUnit.DAYS.between(EXCEL_EPOCH, date)
                    + "</v></c>";
        }
        return text(col, row, String.valueOf(value), 0);
    }

    private static String text(int col, int row, String value, int style) {
        return "<c r=\"" + ref(col, row) + "\" t=\"inlineStr\" s=\"" + style + "\"><is><t xml:space=\"preserve\">"
                + escape(value == null ? "" : value) + "</t></is></c>";
    }

    private static String ref(int col, int row) {
        StringBuilder name = new StringBuilder();
        int n = col + 1;
        while (n > 0) {
            int rem = (n - 1) % 26;
            name.insert(0, (char) ('A' + rem));
            n = (n - 1) / 26;
        }
        return name.toString() + row;
    }

    private static String escape(String s) {
        StringBuilder out = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                default -> {
                    if (ch >= 0x20 || ch == '\t' || ch == '\n' || ch == '\r') {
                        out.append(ch);
                    }
                }
            }
        }
        return out.toString();
    }

    private static void entry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
