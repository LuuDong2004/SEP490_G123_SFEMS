package com.g123.sfems.module.report;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Ghi một bảng báo cáo có tiêu đề, dòng phạm vi, tiêu đề cột và viền ô ra XLSX. */
final class XlsxWriter {
    private XlsxWriter() {}

    static byte[] write(ReportExportRequest report) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
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
                    <sheets><sheet name="Bao cao" sheetId="1" r:id="rId1"/></sheets>
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
                    <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts>
                    <fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
                    <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/></patternFill></fill></fills>
                    <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
                    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                    <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/></cellXfs>
                    </styleSheet>""");
            entry(zip, "xl/worksheets/sheet1.xml", sheet(report));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    private static String sheet(ReportExportRequest report) {
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><cols>");
        for (int i = 0; i < report.columns().size(); i++) {
            int width = Math.max(10, Math.min(48, report.columns().get(i).label().length() + 4));
            xml.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1).append("\" width=\"").append(width).append("\" customWidth=\"1\"/>");
        }
        xml.append("</cols><sheetData>");
        int rowNumber = 1;
        xml.append("<row r=\"1\">").append(text(0, rowNumber++, report.title(), 2)).append("</row>");
        xml.append("<row r=\"2\">").append(text(0, rowNumber++, report.subtitle(), 3)).append("</row>");
        rowNumber++;
        xml.append("<row r=\"").append(rowNumber).append("\">");
        for (int c = 0; c < report.columns().size(); c++) xml.append(text(c, rowNumber, report.columns().get(c).label(), 1));
        xml.append("</row>");
        for (List<Object> values : report.rows()) {
            rowNumber++;
            xml.append("<row r=\"").append(rowNumber).append("\">");
            for (int c = 0; c < report.columns().size(); c++) {
                Object value = c < values.size() ? values.get(c) : null;
                String type = report.columns().get(c).type();
                String ref = ref(c, rowNumber);
                if (value instanceof Number number && ("number".equals(type) || "money".equals(type))) {
                    int style = "money".equals(type) ? 4 : 0;
                    xml.append("<c r=\"").append(ref).append("\" s=\"").append(style).append("\"><v>").append(number).append("</v></c>");
                } else if (value == null) {
                    xml.append("<c r=\"").append(ref).append("\" s=\"0\"/>");
                } else {
                    xml.append(text(c, rowNumber, String.valueOf(value), 0));
                }
            }
            xml.append("</row>");
        }
        return xml.append("</sheetData></worksheet>").toString();
    }

    private static String text(int col, int row, String value, int style) {
        return "<c r=\"" + ref(col, row) + "\" t=\"inlineStr\" s=\"" + style + "\"><is><t xml:space=\"preserve\">"
                + escape(value == null ? "" : value) + "</t></is></c>";
    }

    private static String ref(int col, int row) {
        StringBuilder letters = new StringBuilder();
        for (int n = col + 1; n > 0; n = (n - 1) / 26) letters.insert(0, (char) ('A' + (n - 1) % 26));
        return letters + Integer.toString(row);
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static void entry(ZipOutputStream zip, String name, String xml) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(xml.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
