package com.g123.sfems.module.school.intake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Tệp Excel danh sách thiết bị của phiếu ghi tăng: mẫu đọc lại được, cột theo tiêu đề, số bỏ dấu phân cách. */
class IntakeLinesExcelTest {

    @Test
    void emptyTemplateReadsBackAsNoLines() {
        byte[] template = IntakeLinesExcel.template();
        FieldValidationException e = assertThrows(FieldValidationException.class,
                () -> IntakeLinesExcel.read("Mẫu.xlsx", template));
        assertEquals(true, e.getMessage() == null || !e.getMessage().isBlank());
    }

    @Test
    void readsColumnsByHeaderAndCleansNumbers() {
        String csv = "Danh sách\nMã DM thiết bị,Tên thiết bị,Số lượng,Đơn giá (đồng)\n"
                + "THCS-14-002,Máy tính,5,\"12.500.000\"\n"
                + ",dòng trống,,\n"
                + "THCS-27-055,Kính hiển vi,,4200000\n";
        List<IntakeLinesExcel.Line> lines = IntakeLinesExcel.read("ds.csv", csv.getBytes(StandardCharsets.UTF_8));
        assertEquals(2, lines.size());
        assertEquals("THCS-14-002", lines.get(0).code());
        assertEquals("5", lines.get(0).quantity());
        assertEquals("12500000", lines.get(0).unitPrice());
        assertEquals("", lines.get(1).quantity());
        assertEquals("4200000", lines.get(1).unitPrice());
    }

    @Test
    void readsModelMakerAndOtherInfoByHeader() {
        String csv = "Mã DM thiết bị,Số lượng,Đơn giá (đồng),Model (không bắt buộc),Hãng sản xuất (không bắt buộc),"
                + "Thông tin khác (cấu hình…)\n"
                + "THCS-14-002,2,100000, OptiPlex 3000 ,Dell,\"Core i5, RAM 8GB\"\n"
                + "THCS-27-055,1,,,,\n";
        List<IntakeLinesExcel.Line> lines = IntakeLinesExcel.read("ds.csv", csv.getBytes(StandardCharsets.UTF_8));
        assertEquals("OptiPlex 3000", lines.get(0).model());
        assertEquals("Dell", lines.get(0).manufacturer());
        assertEquals("Core i5, RAM 8GB", lines.get(0).otherInfo());
        assertEquals(null, lines.get(1).model());
        assertEquals(null, lines.get(1).otherInfo());
    }

    @Test
    void withoutHeaderTakesColumnsAbc() {
        String csv = "THCS-14-002,3,100000\n";
        List<IntakeLinesExcel.Line> lines = IntakeLinesExcel.read("ds.csv", csv.getBytes(StandardCharsets.UTF_8));
        assertEquals(1, lines.size());
        assertEquals("3", lines.get(0).quantity());
        assertEquals("100000", lines.get(0).unitPrice());
    }
}
