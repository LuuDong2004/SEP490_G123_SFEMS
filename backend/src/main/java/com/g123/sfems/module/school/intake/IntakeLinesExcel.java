package com.g123.sfems.module.school.intake;

import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.SpreadsheetReader;
import com.g123.sfems.shared.office.XlsxWriter;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Tệp Excel danh sách thiết bị của MỘT phiếu ghi tăng: tệp mẫu để tải về, và đọc tệp người lập điền rồi tải lên.
 *
 * <p>Ba cột dùng: Mã DM thiết bị · Số lượng · Đơn giá — đúng ba cột người lập vẫn chép rồi dán vào ô tìm. Cột "Tên
 * thiết bị" chỉ để người điền đối chiếu, không đọc. Máy chủ chỉ ĐỌC tệp và trả các dòng; khớp mã với danh mục, gộp
 * dòng trùng, báo mã không có là việc của form — cùng một đường với dán từ Excel, nên hai lối không lệch nhau.
 */
public final class IntakeLinesExcel {

    static final String HEADER_CODE = "Mã DM thiết bị";
    private static final int MAX_LINES = 500;

    /** Một dòng đọc được: mã nguyên văn, số lượng và đơn giá đã bỏ dấu phân cách (rỗng khi ô trống). */
    public record Line(int row, String code, String quantity, String unitPrice, String model, String manufacturer,
            String otherInfo) {
    }

    private IntakeLinesExcel() {
    }

    static byte[] template() {
        List<XlsxWriter.Column> columns = List.of(
                new XlsxWriter.Column("code", HEADER_CODE, "text"),
                new XlsxWriter.Column("name", "Tên thiết bị (để đối chiếu, không bắt buộc)", "text"),
                new XlsxWriter.Column("quantity", "Số lượng", "number"),
                new XlsxWriter.Column("unitPrice", "Đơn giá (đồng)", "money"),
                new XlsxWriter.Column("model", "Model (không bắt buộc)", "text"),
                new XlsxWriter.Column("manufacturer", "Hãng sản xuất (không bắt buộc)", "text"),
                new XlsxWriter.Column("otherInfo", "Thông tin khác (cấu hình, xuất xứ…, không bắt buộc)", "text"));
        return XlsxWriter.writeAll(List.of(new XlsxWriter.Tab("Thiet bi", new XlsxWriter.Sheet(
                "Danh sách thiết bị nhận — phiếu ghi tăng",
                "Mỗi dòng một thiết bị. Mã DM thiết bị lấy ở Danh mục thiết bị; số lượng trống thì tính 1; đơn giá trống thì khai sau trên phiếu.",
                columns, List.of()))));
    }

    /**
     * Đọc tệp .xlsx / .csv: tìm hàng tiêu đề có "Mã DM" (tệp mẫu có hai dòng tên ở trên), lấy các dòng sau nó; không
     * có hàng tiêu đề thì coi cột A là mã, B số lượng, C đơn giá từ dòng đầu.
     */
    static List<Line> read(String filename, byte[] content) {
        List<List<String>> rows = SpreadsheetReader.read(filename, content);
        int header = -1;
        int codeCol = 0;
        int qtyCol = 1;
        int priceCol = 2;
        int infoCol = -1;
        int modelCol = -1;
        int makerCol = -1;
        for (int i = 0; i < Math.min(rows.size(), 15) && header < 0; i++) {
            List<String> r = rows.get(i);
            for (int c = 0; c < r.size(); c++) {
                if (plain(r.get(c)).startsWith("ma dm")) {
                    header = i;
                    codeCol = c;
                }
            }
            if (header >= 0) {
                qtyCol = -1;
                priceCol = -1;
                for (int c = 0; c < r.size(); c++) {
                    String h = plain(r.get(c));
                    if (qtyCol < 0 && h.startsWith("so luong")) qtyCol = c;
                    if (priceCol < 0 && h.startsWith("don gia")) priceCol = c;
                    if (infoCol < 0 && h.startsWith("thong tin khac")) infoCol = c;
                    if (modelCol < 0 && h.startsWith("model")) modelCol = c;
                    if (makerCol < 0 && (h.startsWith("hang san xuat") || h.equals("hang"))) makerCol = c;
                }
            }
        }
        List<Line> lines = new ArrayList<>();
        for (int i = header + 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            String code = at(r, codeCol).trim();
            if (code.isEmpty()) continue;
            if (lines.size() >= MAX_LINES) {
                throw new FieldValidationException("file", "Tệp có hơn " + MAX_LINES + " dòng thiết bị — chia thành nhiều phiếu");
            }
            lines.add(new Line(i + 1, code, digits(at(r, qtyCol)), digits(at(r, priceCol)),
                    text(at(r, modelCol)), text(at(r, makerCol)), text(at(r, infoCol))));
        }
        if (lines.isEmpty()) {
            throw new FieldValidationException("file", "Tệp không có dòng thiết bị nào — điền cột \"" + HEADER_CODE + "\" theo tệp mẫu");
        }
        return lines;
    }

    /** Ô chữ: bỏ khoảng trắng hai đầu, trống thì null. */
    private static String text(String s) {
        String t = s == null ? "" : s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String at(List<String> row, int col) {
        return col >= 0 && col < row.size() && row.get(col) != null ? row.get(col) : "";
    }

    /** "1.250.000", "1,250,000 đ", "12500000.0" → "1250000" / "12500000": số nguyên đồng, bỏ phần lẻ của ô số Excel. */
    private static String digits(String raw) {
        String s = raw.trim();
        if (s.matches("\\d+\\.0+")) s = s.substring(0, s.indexOf('.'));
        return s.replaceAll("\\D", "");
    }

    private static String plain(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).trim();
    }
}
