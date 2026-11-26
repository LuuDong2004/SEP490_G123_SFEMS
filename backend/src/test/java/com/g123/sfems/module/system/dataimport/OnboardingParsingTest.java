package com.g123.sfems.module.system.dataimport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Đọc tệp của nhiều trường: tiêu đề khác mẫu, dòng tổng / tiêu đề nhóm, số và năm học ghi kiểu khác nhau. */
class OnboardingParsingTest {

    private static BigDecimal num(String s) {
        OnboardingValidator.ParsedNumber p = OnboardingValidator.parseNumber(s);
        return p == null ? null : p.value();
    }

    @Test
    void readsNumbersWrittenManyWays() {
        assertEquals(0, new BigDecimal("1500000").compareTo(num("1.500.000")));
        assertEquals(0, new BigDecimal("1500000").compareTo(num("1,500,000")));
        assertEquals(0, new BigDecimal("1500000").compareTo(num("1 500 000")));
        assertEquals(0, new BigDecimal("1500000.5").compareTo(num("1.500.000,5")));
        assertEquals(0, new BigDecimal("1500000.5").compareTo(num("1,500,000.50")));
        assertEquals(0, new BigDecimal("1500000").compareTo(num("1.500.000 đ")));
        assertEquals(0, new BigDecimal("1500000").compareTo(num("1.500.000 VNĐ")));
        assertEquals(0, new BigDecimal("15000000").compareTo(num("15 triệu")));
        assertEquals(0, new BigDecimal("15000000").compareTo(num("15tr")));
        assertEquals(0, new BigDecimal("1500000").compareTo(num("1,5 triệu")));
        assertEquals(0, new BigDecimal("200000").compareTo(num("200 nghìn")));
        assertEquals(0, new BigDecimal("12.5").compareTo(num("12,5 m²")));
        assertEquals(0, new BigDecimal("1.5").compareTo(num("1.5")));
        assertEquals(0, new BigDecimal("0.25").compareTo(num("0,250")));
        assertEquals("cái", OnboardingValidator.parseNumber("10 cái").droppedWords());
        assertNull(num("2019-2020"));
        assertNull(num("abc"));
    }

    @Test
    void readsSchoolYears() {
        assertEquals("2026-2027", OnboardingValidator.schoolYearKey("2026-2027"));
        assertEquals("2026-2027", OnboardingValidator.schoolYearKey("2026/2027"));
        assertEquals("2026-2027", OnboardingValidator.schoolYearKey("2026 – 2027"));
        assertEquals("2026-2027", OnboardingValidator.schoolYearKey("Năm học 2026-2027"));
        assertEquals("2026-2027", OnboardingValidator.schoolYearKey("26-27"));
        assertEquals("2026-2027", OnboardingValidator.schoolYearKey("2026"));
        assertNull(OnboardingValidator.schoolYearKey("abc"));
    }

    private static List<String> row(String... cells) {
        return Arrays.asList(cells);
    }

    @Test
    void prefilledTemplateSkipsUntouchedEquipmentRows() {
        // Trang Thiết bị của tệp mẫu điền sẵn (cột như mẫu cũ): dòng chỉ có tên / mã DM / ĐVT là trường chưa động tới.
        List<List<String>> rows = List.of(
                row("Mẫu nhập: Thiết bị"),
                row(""),
                row(""),
                row("Mã cũ", "Tên thiết bị (*)", "Mã DM thiết bị (*)", "Số lượng", "Đơn vị tính"),
                row("", "Bảng nhóm", "THPT-00-001", "", "Cái"),
                row("", "Tủ đựng thiết bị", "THPT-00-002", "2", "Cái"),
                row("", "Máy chiếu", "THPT-00-003", "", "Cái"));
        OnboardingService.Detected d = OnboardingService.detect(rows, true);
        assertNotNull(d);
        assertEquals(OnboardingSheet.EQUIPMENT, d.sheet());
        assertEquals(1, d.rows().size());
        assertEquals("THPT-00-002", d.rows().get(0).getValue().get("catalog"));
        assertEquals("2", d.rows().get(0).getValue().get("quantity"));
    }

    @Test
    void templateHintRowIsSkipped() {
        // Dòng hướng dẫn ngắn của tệp mẫu hiện hành (OnboardingTemplate.HINTS) không thành một dòng dữ liệu.
        List<List<String>> rows = List.of(
                row("Mã học sinh (*)", "Họ và tên (*)", "Mã lớp (*)", "Ngày sinh", "Giới tính"),
                row("Vd: HS0001", "Họ và tên đầy đủ", "Mã ở trang Lớp học", "dd/mm/yyyy", "Nam / Nữ"),
                row("HS01", "Nguyễn Văn An", "10A1", "01/02/2011", "Nam"));
        OnboardingService.Detected d = OnboardingService.detect(rows, true);
        assertNotNull(d);
        assertEquals(OnboardingSheet.STUDENT, d.sheet());
        assertEquals(1, d.rows().size());
        assertEquals("10A1", d.rows().get(0).getValue().get("class"));
    }

    @Test
    void ordinaryEquipmentSheetKeepsRowsWithoutQuantity() {
        // Tệp không phải tệp mẫu của hệ thống (sổ cũ): số lượng trống vẫn là 1 như trước.
        List<List<String>> rows = List.of(
                row("Tên thiết bị", "Mã DM thiết bị", "Số lượng", "Đơn vị tính"),
                row("Bảng nhóm", "THPT-00-001", "", "Cái"));
        OnboardingService.Detected d = OnboardingService.detect(rows);
        assertNotNull(d);
        assertEquals(1, d.rows().size());
    }

    @Test
    void detectsOutsideCatalogSheetByItsSubjectColumn() {
        List<List<String>> rows = List.of(
                row("Mã cũ", "Tên thiết bị (*)", "Môn (*)", "Số lượng", "Đơn vị tính"),
                row("", "Bộ mô hình thử nghiệm", "Vật lý", "3", "Bộ"));
        OnboardingService.Detected d = OnboardingService.detect(rows);
        assertNotNull(d);
        assertEquals(OnboardingSheet.EQUIPMENT_OUTSIDE, d.sheet());
        assertEquals("Vật lý", d.rows().get(0).getValue().get("subject"));
    }

    @Test
    void prefilledRoomSuggestionWithOnlyTypeIsSkipped() {
        List<List<String>> rows = List.of(
                row("Mã phòng (*)", "Tên phòng (*)", "Loại CSVC (*)", "Diện tích (m²)"),
                row("", "", "Nhà kho", ""),
                row("K1", "Nhà kho 1", "Nhà kho", "30"));
        OnboardingService.Detected d = OnboardingService.detect(rows, true);
        assertNotNull(d);
        assertEquals(OnboardingSheet.ROOM, d.sheet());
        assertEquals(1, d.rows().size());
        assertEquals("K1", d.rows().get(0).getValue().get("code"));
    }

    @Test
    void detectsMisaStyleEquipmentSheet() {
        List<List<String>> rows = List.of(
                row("SỞ GIÁO DỤC", "", "", "", ""),
                row("DANH SÁCH TÀI SẢN", "", "", "", ""),
                row("STT", "Mã TS", "Tên thiết bị", "ĐVT", "SL", "Phòng sử dụng", "Năm SD"),
                row("(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)"),
                row("I", "Thiết bị dùng chung", "", "", "", "", ""),
                row("1", "TS001", "Máy chiếu", "Cái", "2", "A.101", "2019"),
                row("2", "TS002", "Tổng đài điện thoại", "Cái", "1", "A.102", "2020"),
                row("", "", "Tổng cộng", "", "3", "", ""),
                row("", "Người lập biểu", "", "", "Hiệu trưởng", "", ""));
        OnboardingService.Detected d = OnboardingService.detect(rows);
        assertNotNull(d);
        assertEquals(OnboardingSheet.EQUIPMENT, d.sheet());
        assertEquals(2, d.rows().size());
        Map<String, String> first = d.rows().get(0).getValue();
        assertEquals("TS001", first.get("legacy"));
        assertEquals("Máy chiếu", first.get("name"));
        assertEquals("Cái", first.get("unit"));
        assertEquals("2", first.get("quantity"));
        assertEquals("A.101", first.get("room"));
        assertEquals("2019", first.get("year"));
        assertEquals("Tổng đài điện thoại", d.rows().get(1).getValue().get("name"));
    }

    @Test
    void readsTwoRowMergedHeader() {
        List<List<String>> rows = List.of(
                row("Mã thiết bị", "Tên tài sản", "Số lượng", "Giá trị", ""),
                row("", "", "", "Nguyên giá", "Còn lại"),
                row("TB01", "Bàn ghế", "1", "1.000.000", "500.000"));
        OnboardingService.Detected d = OnboardingService.detect(rows);
        assertNotNull(d);
        assertEquals(1, d.rows().size());
        Map<String, String> r = d.rows().get(0).getValue();
        assertEquals("1.000.000", r.get("originalValue"));
        // Hệ thống không giữ giá trị còn lại (không có khấu hao): cột đó bỏ qua.
        assertNull(r.get("remainingValue"));
    }

    @Test
    void templateHeaderStillWorks() {
        List<List<String>> rows = List.of(
                row("Tên lớp (*)", "Khối lớp (*)", "Năm học (*)", "Sĩ số (*)"),
                row("6A1", "Khối 6", "2026/2027", "35 HS"));
        OnboardingService.Detected d = OnboardingService.detect(rows);
        assertNotNull(d);
        assertEquals(OnboardingSheet.CLASS, d.sheet());
        assertEquals(1, d.rows().size());
    }
}
