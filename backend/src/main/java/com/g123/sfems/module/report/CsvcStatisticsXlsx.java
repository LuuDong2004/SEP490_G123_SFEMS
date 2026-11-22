package com.g123.sfems.module.report;

import com.g123.sfems.module.report.CsvcStatisticsReport.Header;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Tệp Excel của biểu số liệu CSVC, đúng bố cục mẫu Sở ({@code FileMau_BaoCaoSoLieu.xlsx}): cơ quan chủ quản và
 * đơn vị ở A1, A2 (gộp A:C), tên biểu A3, năm học A4 (gộp A:L), tiêu đề bảng ba hàng 5–7 có ô gộp, phần A với "x"
 * ở các cột kết cấu, khối in đậm, ô "Người lập biểu" gộp J:L — cùng phông Times New Roman, bề rộng cột và chiều cao
 * hàng của mẫu.
 *
 * <p>Viết riêng thay vì qua {@code XlsxWriter}: bộ ghi chung chỉ có một hàng tiêu đề, không gộp ô. Số là số thật
 * (ngăn hàng nghìn theo máy người mở), như bộ ghi chung. Không đọc tệp mẫu lúc chạy.
 */
final class CsvcStatisticsXlsx {

    // Kiểu ô (chỉ số trong cellXfs bên dưới).
    private static final int S_BODY = 1;
    private static final int S_UNIT = 2;
    private static final int S_TITLE = 3;
    private static final int S_YEAR = 4;
    private static final int S_HEAD = 5;
    private static final int S_TEXT = 6;
    private static final int S_BOLD = 7;
    private static final int S_CENTER = 8;
    private static final int S_INT = 9;
    private static final int S_DEC = 10;
    private static final int S_X = 11;
    private static final int S_SIGN = 12;
    private static final int S_NOTE = 13;

    private static final double[] WIDTHS = {7.11, 65.78, 10.66, 8.66, 8.33, 10.66, 8.33, 10.66, 8.33, 18.38, 8.33, 10.66};

    private CsvcStatisticsXlsx() {
    }

    static byte[] write(Header header, List<Map<String, Object>> rows) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            parts(zip);
            entry(zip, "xl/worksheets/sheet1.xml", sheet(header, rows));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    private static String sheet(Header header, List<Map<String, Object>> rows) {
        StringBuilder data = new StringBuilder();
        List<String> merges = new ArrayList<>(List.of("A1:C1", "A2:C2", "A3:L3", "A4:L4", "A5:A7", "B5:B7", "C5:C7",
                "D5:D7", "E5:L5", "E6:F6", "G6:H6", "I6:J6", "K6:L6"));
        data.append(row(1, 18, text(0, 1, header.body(), S_BODY)));
        data.append(row(2, 18, text(0, 2, header.unit(), S_UNIT)));
        data.append(row(3, 25.5, text(0, 3, "DANH SÁCH BÁO CÁO SỐ LIỆU", S_TITLE)));
        data.append(row(4, 15.75, text(0, 4, header.schoolYear().isBlank() ? "" : "Năm học: " + header.schoolYear(),
                S_YEAR)));
        // Ô nằm trong vùng gộp vẫn phải ghi (rỗng, cùng kiểu) — không thì Excel bỏ viền ở phần đó.
        String[][] head = {
            {"STT", "Nội dung", "Đơn vị", "Tổng số", "Hiện trạng", "", "", "", "", "", "", ""},
            {"", "", "", "", "Kiên cố", "", "Bán kiên cố", "", "Tạm", "", "Nhờ, mượn, thuê", ""},
            {"", "", "", "", "Số \nlượng", "Tổng diện tích (m2)", "Số \nlượng", "Tổng diện tích (m2)", "Số \nlượng",
                "Tổng diện tích (m2)", "Số\n lượng", "Tổng diện tích (m2)"}};
        double[] heights = {15.75, 15.75, 31.2};
        for (int h = 0; h < head.length; h++) {
            StringBuilder cells = new StringBuilder();
            for (int c = 0; c < 12; c++) {
                cells.append(text(c, 5 + h, head[h][c], S_HEAD));
            }
            data.append(row(5 + h, heights[h], cells.toString()));
        }
        int r = 8;
        List<Map<String, Object>> notes = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String kind = String.valueOf(row.get("kind"));
            if ("note".equals(kind)) {
                notes.add(row);
                continue;
            }
            boolean bold = "section".equals(kind) || "group".equals(kind);
            StringBuilder cells = new StringBuilder();
            cells.append(text(0, r, str(row.get("stt")), S_TEXT));
            cells.append(text(1, r, str(row.get("content")), bold ? S_BOLD : S_TEXT));
            cells.append(text(2, r, str(row.get("unit")), S_CENTER));
            cells.append(number(3, r, row.get("total")));
            for (int i = 0; i < CsvcStatisticsReport.PREFIXES.size(); i++) {
                String prefix = CsvcStatisticsReport.PREFIXES.get(i);
                if ("info".equals(kind)) {
                    cells.append(text(4 + 2 * i, r, "x", S_X)).append(text(5 + 2 * i, r, "x", S_X));
                } else {
                    cells.append(number(4 + 2 * i, r, row.get(prefix + "_count")));
                    cells.append(number(5 + 2 * i, r, row.get(prefix + "_area")));
                }
            }
            data.append(row(r, 0, cells.toString()));
            r++;
        }
        // Ghi chú (hạng mục không có dòng trên biểu, chưa khai kết cấu) đứng dưới bảng, ngoài khung — không thêm
        // dòng vào biểu.
        // Như mẫu: hai hàng trống giữa bảng và chữ ký (bảng hết ở 84, "Người lập biểu" ở 87).
        if (!notes.isEmpty()) {
            r++;
            for (Map<String, Object> note : notes) {
                data.append(row(r, 30, text(0, r, "Ghi chú: " + str(note.get("content")), S_NOTE)));
                merges.add("A" + r + ":L" + r);
                r++;
            }
        }
        r += 2;
        data.append(row(r, 36, text(9, r, "Người lập biểu\n(Ký và ghi rõ họ tên)", S_SIGN)));
        merges.add("J" + r + ":L" + r);

        StringBuilder cols = new StringBuilder();
        for (int c = 0; c < WIDTHS.length; c++) {
            cols.append("<col min=\"").append(c + 1).append("\" max=\"").append(c + 1).append("\" width=\"")
                    .append(WIDTHS[c]).append("\" customWidth=\"1\"/>");
        }
        StringBuilder mergeXml = new StringBuilder();
        for (String m : merges) {
            mergeXml.append("<mergeCell ref=\"").append(m).append("\"/>");
        }
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
                <sheetViews><sheetView workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
                <sheetFormatPr defaultRowHeight="15"/>
                <cols>%s</cols>
                <sheetData>%s</sheetData>
                <mergeCells count="%d">%s</mergeCells>
                <pageMargins left="0.5" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
                <pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
                </worksheet>""".formatted(cols, data, merges.size(), mergeXml);
    }

    private static String row(int r, double height, String cells) {
        return "<row r=\"" + r + "\"" + (height > 0 ? " ht=\"" + height + "\" customHeight=\"1\"" : "") + ">"
                + cells + "</row>";
    }

    private static String number(int col, int row, Object value) {
        if (!(value instanceof Number n)) {
            return "<c r=\"" + ref(col, row) + "\" s=\"" + S_INT + "\"/>";
        }
        BigDecimal d = new BigDecimal(n.toString());
        boolean fraction = d.stripTrailingZeros().scale() > 0;
        return "<c r=\"" + ref(col, row) + "\" s=\"" + (fraction ? S_DEC : S_INT) + "\"><v>"
                + d.stripTrailingZeros().toPlainString() + "</v></c>";
    }

    private static String text(int col, int row, String value, int style) {
        if (value == null || value.isEmpty()) {
            return "<c r=\"" + ref(col, row) + "\" s=\"" + style + "\"/>";
        }
        return "<c r=\"" + ref(col, row) + "\" t=\"inlineStr\" s=\"" + style + "\"><is><t xml:space=\"preserve\">"
                + escape(value) + "</t></is></c>";
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String ref(int col, int row) {
        return (char) ('A' + col) + String.valueOf(row);
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

    private static void parts(ZipOutputStream zip) throws IOException {
        entry(zip, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                <Default Extension="xml" ContentType="application/xml"/>
                <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>""");
        entry(zip, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>""");
        // Tiêu đề bảng (hàng 5–7) lặp lại ở mỗi trang in.
        entry(zip, "xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
                <definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">Sheet1!$5:$7</definedName></definedNames>
                </workbook>""");
        entry(zip, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>""");
        // Phông: 0 Times 11 · 1 Times 11 đậm · 2 Times 14 đậm · 3 Times 12 đậm · 4 Calibri 11 đậm (khối, như mẫu)
        // · 5 Calibri 11 · 6 Times 11 nghiêng.
        entry(zip, "xl/styles.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.0#"/></numFmts>
                <fonts count="7">
                <font><sz val="11"/><name val="Times New Roman"/></font>
                <font><b/><sz val="11"/><name val="Times New Roman"/></font>
                <font><b/><sz val="14"/><name val="Times New Roman"/></font>
                <font><b/><sz val="12"/><name val="Times New Roman"/></font>
                <font><b/><sz val="11"/><name val="Calibri"/></font>
                <font><sz val="11"/><name val="Calibri"/></font>
                <font><i/><sz val="11"/><name val="Times New Roman"/></font>
                </fonts>
                <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
                <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
                <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                <cellXfs count="14">
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="3" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="4" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="3" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
                <xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
                <xf numFmtId="0" fontId="5" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="6" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
                </cellXfs>
                <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                </styleSheet>""");
    }

    private static void entry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
