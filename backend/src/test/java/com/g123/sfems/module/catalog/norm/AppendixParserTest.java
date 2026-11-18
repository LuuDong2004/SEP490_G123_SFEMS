package com.g123.sfems.module.catalog.norm;

import static org.assertj.core.api.Assertions.assertThat;

import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.shared.office.DocxReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

/**
 * Đọc phụ lục thông tư từ Word: ô gộp, dòng tiêu đề nhóm, cột GV / HS, các kiểu ghi số lượng, và câu "tính cho
 * 01 phòng học bộ môn" ở GHI CHÚ CUỐI BẢNG (THPT) — chỗ bộ sinh cũ bỏ sót làm 300 dòng THPT thành "cả trường".
 */
class AppendixParserTest {

    @Test
    void notesAfterTableMakeBareNumbersPerRoom() throws IOException {
        AppendixParser.Result r = AppendixParser.parse(DocxReader.read(docx(true)), "THPT");

        assertThat(r.sections()).hasSize(1);
        AppendixParser.Section s = r.sections().get(0);
        assertThat(s.subjectKey()).isEqualTo("HOA_HOC");
        assertThat(s.heading()).isEqualTo("MÔN HÓA HỌC");
        assertThat(s.perRoom()).isTrue();
        assertThat(s.perRoomSource()).contains("tính cho 01 phòng học bộ môn");

        List<AppendixParser.Row> rows = r.rows();
        assertThat(rows).extracting(AppendixParser.Row::name)
                .containsExactly("Tủ hút", "Bộ thiết bị dạy học điện tử", "Bộ dụng cụ thí nghiệm", "Bảng nhóm",
                        "Phần mềm mô phỏng");

        AppendixParser.Row hood = rows.get(0);
        assertThat(hood.minQuantity()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(hood.normBasis()).isEqualTo(NormBasis.PER_ROOM);
        assertThat(hood.forTeacher()).isTrue();
        assertThat(hood.forStudent()).isFalse();
        assertThat(hood.sectionName()).isEqualTo("Thiết bị dùng chung");
        assertThat(hood.description()).isEqualTo("Tủ kín\nCó quạt hút");

        assertThat(rows.get(1).normBasis()).isEqualTo(NormBasis.PER_TEACHER);
        assertThat(rows.get(2).normBasis()).isEqualTo(NormBasis.PER_STUDENT);
        assertThat(rows.get(2).basisSize()).isEqualTo(6);
        assertThat(rows.get(3).normBasis()).isEqualTo(NormBasis.PER_CLASS);
        assertThat(rows.get(3).minQuantity()).isEqualByComparingTo("2");
        assertThat(rows.get(3).gradeLevels()).isEqualTo("10,11");
        // "Bộ" không có số: không đoán.
        assertThat(rows.get(4).minQuantity()).isNull();
        assertThat(rows.get(4).normBasis()).isNull();
        assertThat(rows.get(4).quantityText()).isEqualTo("Bộ");
    }

    @Test
    void withoutTheNoteABareNumberIsPerSchool() throws IOException {
        AppendixParser.Result r = AppendixParser.parse(DocxReader.read(docx(false)), "THPT");

        assertThat(r.sections().get(0).perRoom()).isFalse();
        assertThat(r.rows().get(0).normBasis()).isEqualTo(NormBasis.PER_SCHOOL);
    }

    @Test
    void quantityForms() {
        assertThat(AppendixParser.parseQty("01/4 đến 6HS", false).size()).isEqualTo(6);
        assertThat(AppendixParser.parseQty("01 bộ (hoặc chiếc)/5 lớp", false).basis()).isEqualTo(NormBasis.PER_CLASS);
        assertThat(AppendixParser.parseQty("01 bộ (hoặc chiếc)/5 lớp", false).size()).isEqualTo(5);
        assertThat(AppendixParser.parseQty("02/ trường", true).basis()).isEqualTo(NormBasis.PER_SCHOOL);
        assertThat(AppendixParser.parseQty("01/PHBM", false).basis()).isEqualTo(NormBasis.PER_ROOM);
        assertThat(AppendixParser.parseQty("Hỗ trợ giáo viên thực hiện dạy học ngoại ngữ.", false).min()).isNull();
    }

    // ------------------------------------------------------------------ dựng tệp .docx nhỏ

    private static byte[] docx(boolean withNote) throws IOException {
        String body = p("DANH MỤC")
                + p("THIẾT BỊ DẠY HỌC TỐI THIỂU CẤP TRUNG HỌC PHỔ THÔNG - MÔN HÓA HỌC(Kèm theo Thông tư số 39/2021/TT-BGDĐT)")
                + "<w:tbl>"
                + tr(tc("Số TT", 1, "restart"), tc("Chủ đề dạy học", 1, "restart"), tc("Tên thiết bị", 1, "restart"),
                        tc("Mục đích sử dụng", 1, "restart"), tc("Mô tả chi tiết thiết bị", 1, "restart"),
                        tc("Đối tượng sử dụng", 2, null), tc("Đơn vị", 1, "restart"), tc("Số lượng", 1, "restart"),
                        tc("Ghi chú", 1, "restart"))
                + tr(tc("", 1, "continue"), tc("", 1, "continue"), tc("", 1, "continue"), tc("", 1, "continue"),
                        tc("", 1, "continue"), tc("GV", 1, null), tc("HS", 1, null), tc("", 1, "continue"),
                        tc("", 1, "continue"), tc("", 1, "continue"))
                + tr(tc("A", 1, null), tc("THIẾT BỊ DÙNG CHUNG", 9, null))
                + row("1", "", "Tủ hút", "Hút khí độc", "<w:p><w:r><w:t>Tủ kín</w:t></w:r></w:p><w:p><w:r><w:t>Có quạt hút</w:t></w:r></w:p>", "x", "", "Cái", "01", "")
                + row("2", "", "Bộ thiết bị dạy học điện tử", "Dạy học", p("Phần mềm"), "x", "", "Bộ", "01/GV", "")
                + row("3", "", "Bộ dụng cụ thí nghiệm", "Thí nghiệm", p("Ống nghiệm"), "", "x", "Bộ", "01/6HS", "")
                + row("4", "", "Bảng nhóm", "Thảo luận", p("Bảng"), "", "x", "Chiếc", "02/lớp", "Dùng cho lớp 10, 11")
                + row("5", "", "Phần mềm mô phỏng", "Mô phỏng", p("Phần mềm"), "x", "", "Bộ", "Bộ", "")
                + "</w:tbl>"
                + p("Ghi chú:")
                + (withNote ? p("- Thiết bị được tính cho 01 phòng học bộ môn;") : p("- Số lượng tính cho trường."));
        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>"
                + body + "</w:body></w:document>";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            zip.write(xml.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return out.toByteArray();
    }

    private static String p(String text) {
        return "<w:p><w:r><w:t xml:space=\"preserve\">" + text + "</w:t></w:r></w:p>";
    }

    private static String tr(String... cells) {
        return "<w:tr>" + String.join("", cells) + "</w:tr>";
    }

    private static String tc(String text, int span, String vMerge) {
        String pr = (span > 1 ? "<w:gridSpan w:val=\"" + span + "\"/>" : "")
                + (vMerge == null ? "" : vMerge.equals("continue") ? "<w:vMerge/>" : "<w:vMerge w:val=\"restart\"/>");
        return "<w:tc>" + (pr.isEmpty() ? "" : "<w:tcPr>" + pr + "</w:tcPr>") + (text.isEmpty() ? "<w:p/>" : p(text))
                + "</w:tc>";
    }

    /** Một dòng thiết bị; {@code descXml} là các đoạn của ô mô tả. */
    private static String row(String tt, String topic, String name, String purpose, String descXml, String gv,
            String hs, String unit, String qty, String note) {
        return "<w:tr>" + tc(tt, 1, null) + tc(topic, 1, null) + tc(name, 1, null) + tc(purpose, 1, null)
                + "<w:tc>" + descXml + "</w:tc>" + tc(gv, 1, null) + tc(hs, 1, null) + tc(unit, 1, null)
                + tc(qty, 1, null) + tc(note, 1, null) + "</w:tr>";
    }
}
