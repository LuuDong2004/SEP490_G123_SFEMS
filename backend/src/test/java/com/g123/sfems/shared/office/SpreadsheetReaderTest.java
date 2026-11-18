package com.g123.sfems.shared.office;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

/** Tệp tải lên là dữ liệu không tin cậy: các trần của {@link SpreadsheetReader} phải giữ. */
class SpreadsheetReaderTest {

    private static final String WORKBOOK = """
            <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <sheets><sheet name="A" r:id="rId1"/></sheets></workbook>""";
    private static final String RELS = """
            <Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>""";

    private static byte[] xlsx(String sheetData) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            put(zip, "xl/workbook.xml", WORKBOOK);
            put(zip, "xl/_rels/workbook.xml.rels", RELS);
            put(zip, "xl/worksheets/sheet1.xml", "<worksheet><sheetData>" + sheetData + "</sheetData></worksheet>");
        }
        return out.toByteArray();
    }

    private static void put(ZipOutputStream zip, String name, String text) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(text.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String cell(String ref, String text) {
        return "<c r=\"" + ref + "\" t=\"inlineStr\"><is><t>" + text + "</t></is></c>";
    }

    @Test
    void readsNormalSheet() throws IOException {
        List<SpreadsheetReader.NamedSheet> sheets = SpreadsheetReader.readAll("a.xlsx",
                xlsx("<row r=\"1\">" + cell("A1", "Mã") + cell("B1", "Tên") + "</row>"));
        assertThat(sheets.getFirst().rows().getFirst()).containsExactly("Mã", "Tên");
    }

    @Test
    void rejectsCellFarToTheRight() throws IOException {
        // Ô ở cột XFD làm mỗi dòng đệm 16.384 ô — phải từ chối, không cấp bộ nhớ.
        byte[] file = xlsx("<row r=\"1\">" + cell("XFD1", "x") + "</row>");
        assertThatThrownBy(() -> SpreadsheetReader.readAll("a.xlsx", file))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void rejectsOverlongCell() throws IOException {
        byte[] file = xlsx("<row r=\"1\">" + cell("A1", "x".repeat(2_001)) + "</row>");
        assertThatThrownBy(() -> SpreadsheetReader.readAll("a.xlsx", file))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void rejectsRenamedNonZip() {
        byte[] file = "MZ\u0090\u0000 not a workbook".getBytes(StandardCharsets.ISO_8859_1);
        assertThatThrownBy(() -> SpreadsheetReader.readAll("a.xlsx", file))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void rejectsBinaryCsv() {
        byte[] file = {'a', ',', 0, 'b'};
        assertThatThrownBy(() -> SpreadsheetReader.readAll("a.csv", file))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void rejectsDoctype() throws IOException {
        // XXE: DTD đã tắt, tệp mang <!DOCTYPE> không được đọc thành thực thể ngoài.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            put(zip, "xl/workbook.xml", WORKBOOK);
            put(zip, "xl/_rels/workbook.xml.rels", RELS);
            put(zip, "xl/worksheets/sheet1.xml", """
                    <!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>
                    <worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&e;</t></is></c></row></sheetData></worksheet>""");
        }
        byte[] file = out.toByteArray();
        assertThatThrownBy(() -> SpreadsheetReader.readAll("a.xlsx", file))
                .isInstanceOf(FieldValidationException.class);
    }
}
