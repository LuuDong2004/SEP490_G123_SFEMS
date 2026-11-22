package com.g123.sfems.module.school.facilitystandard;

import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Tệp Excel theo mẫu "Đánh giá mức độ chuẩn" của Sở ({@code FileMau_DanhGiaMucDoChuan.xlsx}): đầu trang (cơ quan
 * quản lý, trường, tên biểu, năm học), bảng sáu cột STT · Các hạng mục công trình · Tiêu chuẩn tối thiểu · mức độ 1 ·
 * mức độ 2 · Điều kiện cảnh báo thiếu, dòng khối đậm (1, 2…) rồi dòng loại (1.1, 1.2…), chỗ ký người lập biểu.
 *
 * <p>Mẫu ghi nhiều dòng trong một ô bằng {@code <br>}; ở đây là xuống dòng thật trong ô. Chỉ ghi loại có quy tắc —
 * loại chưa có quy tắc không có gì để chấm. Tự viết XML như {@code XlsxWriter} (không kéo Apache POI): bảng này cần
 * ô gộp và kiểu ô riêng mà {@code XlsxWriter} không có.
 */
final class FacilityStandardExcel {

    private static final String PASS_TEXT = "ĐẠT";
    private static final String FAIL_TEXT = "CHƯA ĐẠT";

    // Kiểu ô (thứ tự trong cellXfs bên dưới).
    private static final int ST_BODY = 1;
    private static final int ST_SCHOOL = 2;
    private static final int ST_TITLE = 3;
    private static final int ST_YEAR = 4;
    private static final int ST_HEAD = 5;
    private static final int ST_GROUP_TEXT = 6;
    private static final int ST_GROUP_CENTER = 7;
    private static final int ST_ITEM_TEXT = 8;
    private static final int ST_ITEM_CENTER = 9;
    private static final int ST_SIGNER = 10;

    private FacilityStandardExcel() {
    }

    static byte[] write(FacilityStandardService.Evaluation evaluation) {
        StringBuilder rows = new StringBuilder();
        List<String> merges = new ArrayList<>();
        String body = evaluation.school().managingBody();
        rows.append(row(1, 16, cell("A", 1, upper(body), ST_BODY)));
        merges.add("A1:C1");
        rows.append(row(2, 16, cell("A", 2, upper(evaluation.school().name()), ST_SCHOOL)));
        merges.add("A2:C2");
        rows.append(row(3, 22, cell("A", 3, "DANH SÁCH ĐÁNH GIÁ CHUẨN MỨC ĐỘ", ST_TITLE)));
        merges.add("A3:F3");
        rows.append(row(4, 16, cell("A", 4, "Năm học: " + (evaluation.schoolYear() == null ? ""
                : evaluation.schoolYear()), ST_YEAR)));
        merges.add("A4:F4");

        String[] heads = {"STT", "Các hạng mục công trình", "Tiêu chuẩn\ntối thiểu", "Tiêu chuẩn\nmức độ 1",
                "Tiêu chuẩn\nmức độ 2", "Điều kiện cảnh báo thiếu"};
        String[] cols = {"A", "B", "C", "D", "E", "F"};
        for (int r = 6; r <= 8; r++) {
            StringBuilder cells = new StringBuilder();
            for (int c = 0; c < cols.length; c++) {
                cells.append(cell(cols[c], r, r == 6 ? heads[c] : null, ST_HEAD));
            }
            rows.append(row(r, 16, cells.toString()));
        }
        for (String c : cols) {
            merges.add(c + "6:" + c + "8");
        }

        int r = 9;
        int groupNo = 0;
        for (FacilityStandardService.Group group : evaluation.groups()) {
            List<FacilityStandardService.Item> items = group.items().stream()
                    .filter(FacilityStandardService.Item::hasRules).toList();
            if (items.isEmpty()) {
                continue;
            }
            groupNo++;
            rows.append(row(r, 18, cell("A", r, String.valueOf(groupNo), ST_GROUP_CENTER)
                    + cell("B", r, groupNo + ". " + group.name(), ST_GROUP_TEXT)
                    + statusCells(r, group.status(), ST_GROUP_CENTER)
                    + cell("F", r, null, ST_GROUP_TEXT)));
            r++;
            int itemNo = 0;
            for (FacilityStandardService.Item item : items) {
                itemNo++;
                String shortfall = String.join("\n", item.shortfalls());
                int lines = Math.max(1, Math.max(item.shortfalls().size(), wrapLines(item.name(), 80)));
                rows.append(row(r, 16 * lines, cell("A", r, groupNo + "." + itemNo, ST_ITEM_CENTER)
                        + cell("B", r, "- " + item.name(), ST_ITEM_TEXT)
                        + statusCells(r, item.status(), ST_ITEM_CENTER)
                        + cell("F", r, shortfall.isEmpty() ? null : shortfall, ST_ITEM_TEXT)));
                r++;
            }
        }
        r += 2;
        rows.append(row(r, 32, cell("D", r, "Người lập biểu\n(Ký và ghi rõ họ tên)", ST_SIGNER)));
        merges.add("D" + r + ":F" + r);

        StringBuilder mergeXml = new StringBuilder("<mergeCells count=\"" + merges.size() + "\">");
        for (String m : merges) {
            mergeXml.append("<mergeCell ref=\"").append(m).append("\"/>");
        }
        mergeXml.append("</mergeCells>");

        String sheet = """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                <sheetViews><sheetView workbookViewId="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
                <sheetFormatPr defaultRowHeight="15"/>
                <cols><col min="1" max="1" width="7.1" customWidth="1"/><col min="2" max="2" width="75" customWidth="1"/><col min="3" max="5" width="12.7" customWidth="1"/><col min="6" max="6" width="48" customWidth="1"/></cols>
                <sheetData>%s</sheetData>
                %s
                <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
                <pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/>
                </worksheet>""".formatted(rows, mergeXml);

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
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
            entry(zip, "xl/workbook.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                    <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
                    </workbook>""");
            entry(zip, "xl/_rels/workbook.xml.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                    </Relationships>""");
            entry(zip, "xl/styles.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                    <fonts count="6">
                    <font><sz val="11"/><name val="Calibri"/></font>
                    <font><sz val="11"/><name val="Times New Roman"/></font>
                    <font><b/><sz val="11"/><name val="Times New Roman"/></font>
                    <font><b/><sz val="14"/><name val="Times New Roman"/></font>
                    <font><sz val="12"/><name val="Times New Roman"/></font>
                    <font><b/><sz val="12"/><name val="Times New Roman"/></font>
                    </fonts>
                    <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
                    <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
                    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                    <cellXfs count="11">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                    </cellXfs>
                    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                    </styleSheet>""");
            entry(zip, "xl/worksheets/sheet1.xml", sheet);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    private static String statusCells(int r, Map<String, String> status, int style) {
        String[] cols = {"C", "D", "E"};
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < cols.length; i++) {
            String s = status.get(FacilityStandardRule.TIERS.get(i));
            String text = FacilityStandardService.PASS.equals(s) ? PASS_TEXT
                    : FacilityStandardService.FAIL.equals(s) ? FAIL_TEXT : null;
            out.append(cell(cols[i], r, text, style));
        }
        return out.toString();
    }

    private static int wrapLines(String text, int width) {
        return text == null ? 1 : Math.max(1, (text.length() + width - 1) / width);
    }

    private static String upper(String text) {
        return text == null ? "" : text.toUpperCase(Locale.forLanguageTag("vi"));
    }

    private static String row(int r, int height, String cells) {
        return "<row r=\"" + r + "\" ht=\"" + height + "\" customHeight=\"1\">" + cells + "</row>";
    }

    private static String cell(String col, int r, String text, int style) {
        String ref = col + r;
        if (text == null) {
            return "<c r=\"" + ref + "\" s=\"" + style + "\"/>";
        }
        return "<c r=\"" + ref + "\" s=\"" + style + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">"
                + escape(text) + "</t></is></c>";
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
                    // Ký tự điều khiển (trừ tab, xuống dòng) làm Excel từ chối mở tệp.
                    if (ch >= 0x20 || ch == '\n' || ch == '\t') {
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
