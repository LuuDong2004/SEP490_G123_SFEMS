package com.g123.sfems.module.school.intake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Tệp Excel danh sách thiết bị của phiếu ghi tăng: mẫu đọc lại được, cột theo tiêu đề, số đọc kiểu Việt Nam, số sai
 * báo theo dòng chứ không tự sửa (test 15/11/2026, B03–B05, B07, B09).
 */
class IntakeLinesExcelTest {

    private static List<IntakeLinesExcel.Line> csv(String text) {
        return IntakeLinesExcel.read("ds.csv", text.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void emptyTemplateReadsBackAsNoLines() {
        byte[] template = IntakeLinesExcel.template();
        FieldValidationException e = assertThrows(FieldValidationException.class,
                () -> IntakeLinesExcel.read("Mẫu.xlsx", template));
        assertEquals(true, e.getMessage() == null || !e.getMessage().isBlank());
    }

    @Test
    void readsColumnsByHeaderAndCleansNumbers() {
        List<IntakeLinesExcel.Line> lines = csv("Danh sách\nMã DM thiết bị,Tên thiết bị,Số lượng,Đơn giá (đồng)\n"
                + "THCS-14-002,Máy tính,5,\"12.500.000\"\n"
                + ",dòng trống,,\n"
                + "THCS-27-055,Kính hiển vi,,4200000\n");
        assertEquals(2, lines.size());
        assertEquals("THCS-14-002", lines.get(0).code());
        assertEquals(5, lines.get(0).quantity());
        assertEquals(12_500_000L, lines.get(0).unitPrice());
        assertEquals(1, lines.get(1).quantity());
        assertEquals(4_200_000L, lines.get(1).unitPrice());
        assertEquals(5, lines.get(1).row());
        assertNull(lines.get(0).error());
    }

    @Test
    void readsModelMakerAndOtherInfoByHeader() {
        List<IntakeLinesExcel.Line> lines = csv("Mã DM thiết bị,Số lượng,Đơn giá (đồng),Model (không bắt buộc),"
                + "Hãng sản xuất (không bắt buộc),Thông tin khác (cấu hình…)\n"
                + "THCS-14-002,2,100000, OptiPlex 3000 ,Dell,\"Core i5, RAM 8GB\"\n"
                + "THCS-27-055,1,,,,\n");
        assertEquals("OptiPlex 3000", lines.get(0).model());
        assertEquals("Dell", lines.get(0).manufacturer());
        assertEquals("Core i5, RAM 8GB", lines.get(0).otherInfo());
        assertNull(lines.get(1).model());
        assertNull(lines.get(1).otherInfo());
    }

    @Test
    void withoutHeaderTakesColumnsAbcWhenFirstCellIsACode() {
        List<IntakeLinesExcel.Line> lines = csv("THCS-14-002,3,100000\n");
        assertEquals(1, lines.size());
        assertEquals(3, lines.get(0).quantity());
        assertEquals(100_000L, lines.get(0).unitPrice());
    }

    @Test
    void fileWithoutCodeColumnSaysUseTheTemplate() {
        FieldValidationException e = assertThrows(FieldValidationException.class,
                () -> csv("Tên,SL,Giá\nAmpe kế,2,350000\n"));
        assertTrue(e.getMessage().contains("Mã DM thiết bị") || e.toString().contains("Mã DM thiết bị"));
    }

    @Test
    void codeIsTrimmedAndUppercased() {
        assertEquals("THCS-27-022", csv("Mã DM thiết bị,Số lượng\n  thcs-27-022 ,1\n").get(0).code());
    }

    @Test
    void fractionalOrBadQuantityIsAnErrorNotARewrite() {
        List<IntakeLinesExcel.Line> lines = csv("Mã DM thiết bị,Số lượng\n"
                + "A-1,\"2,5\"\nA-2,250.5\nA-3,-3\nA-4,mười\nA-5,0\nA-6,1500\n");
        for (int i = 0; i < 5; i++) {
            assertNull(lines.get(i).quantity(), "dòng " + lines.get(i).row());
            assertNotNull(lines.get(i).error(), "dòng " + lines.get(i).row());
        }
        assertEquals(1500, lines.get(5).quantity());
        assertTrue(lines.get(3).error().contains("không phải là số"));
    }

    @Test
    void badUnitPriceIsAnErrorNotARewrite() {
        List<IntakeLinesExcel.Line> lines = csv("Mã DM thiết bị,Số lượng,Đơn giá\n"
                + "A-1,1,-100\nA-2,1,abc\nA-3,1,\"350000,5\"\nA-4,1,999999999999\nA-5,1,350.000 đ\nA-6,1,\"1.250.000\"\n");
        for (int i = 0; i < 4; i++) {
            assertNull(lines.get(i).unitPrice(), "dòng " + lines.get(i).row());
            assertNotNull(lines.get(i).error(), "dòng " + lines.get(i).row());
        }
        assertEquals(350_000L, lines.get(4).unitPrice());
        assertEquals(1_250_000L, lines.get(5).unitPrice());
    }

    @Test
    void readsVietnameseAndExcelNumbers() {
        assertEquals(new BigDecimal("2.5"), IntakeLinesExcel.number("2,5", false));
        assertEquals(new BigDecimal("250.5"), IntakeLinesExcel.number("250.5", false));
        assertEquals(new BigDecimal("1250000.5"), IntakeLinesExcel.number("1.250.000,5", true));
        assertEquals(new BigDecimal("1250000.5"), IntakeLinesExcel.number("1,250,000.5", true));
        assertEquals(new BigDecimal("350000"), IntakeLinesExcel.number("350.000", true));
        assertNull(IntakeLinesExcel.number("1.2.3", false));
        assertNull(IntakeLinesExcel.number("abc", true));
    }
}
