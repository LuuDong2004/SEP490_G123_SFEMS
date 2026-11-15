package com.g123.sfems.module.school.intake;

import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.SpreadsheetReader;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.validation.NumberRule;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Tệp Excel danh sách thiết bị của MỘT phiếu ghi tăng: tệp mẫu để tải về, và đọc tệp người lập điền rồi tải lên.
 *
 * <p>Cột dùng: Mã DM thiết bị · Số lượng · Đơn giá (+ Model, Hãng, Thông tin khác). Cột "Tên thiết bị" chỉ để người
 * điền đối chiếu, không đọc. Máy chủ ĐỌC và KIỂM từng dòng (số lượng, đơn giá theo cùng luật với ô trên form), trả
 * lỗi theo số dòng Excel — không tự sửa số sai thành số khác (test 15/11/2026: "-3" thành 3, "2,5" thành 25). Khớp mã
 * với danh mục là việc của form, một lần gọi cho cả tệp ({@code equipment_catalogs?codes=…}).
 */
public final class IntakeLinesExcel {

    static final String HEADER_CODE = "Mã DM thiết bị";
    private static final int MAX_LINES = 500;
    /** Mã DM: chữ, số, dấu chấm / gạch, có ít nhất một chữ số — để nhận ra tệp không có hàng tiêu đề. */
    private static final Pattern CODE_LIKE = Pattern.compile("(?=.*\\d)[A-Za-z0-9][A-Za-z0-9._/-]*");
    private static final Pattern GROUPED_COMMA = Pattern.compile("\\d{1,3}(,\\d{3})+");
    private static final Pattern GROUPED_DOT = Pattern.compile("\\d{1,3}(\\.\\d{3})+");

    /**
     * Một dòng đọc được. {@code code}: đã bỏ khoảng trắng, viết hoa. {@code quantity}: trống thì 1. {@code error}:
     * vì sao dòng không dùng được ("Số lượng phải từ 1 đến 10.000") — có lỗi thì form không thêm dòng đó.
     */
    public record Line(int row, String code, Integer quantity, Long unitPrice, String model, String manufacturer,
            String otherInfo, String error) {
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
                "Mỗi dòng một thiết bị. Mã DM thiết bị lấy ở Danh mục thiết bị; số lượng là số nguyên, trống thì tính 1; đơn giá trống thì khai sau trên phiếu.",
                columns, List.of()))));
    }

    /**
     * Đọc tệp .xlsx / .csv: tìm hàng tiêu đề có "Mã DM" (tệp mẫu có hai dòng tên ở trên), lấy các dòng sau nó. Không
     * có hàng tiêu đề thì chỉ nhận khi dòng đầu đã là một mã (cột A mã, B số lượng, C đơn giá); còn lại là tệp sai mẫu.
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
        if (header < 0 && !firstRowIsCode(rows)) {
            throw new FieldValidationException("file", "Tệp không có cột \"" + HEADER_CODE
                    + "\" — tải tệp mẫu (Nhập Excel → Tải tệp mẫu Excel) rồi điền theo mẫu");
        }
        List<Line> lines = new ArrayList<>();
        for (int i = header + 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            String code = normalizeCode(at(r, codeCol));
            if (code.isEmpty()) continue;
            if (lines.size() >= MAX_LINES) {
                throw new FieldValidationException("file", "Tệp có hơn " + MAX_LINES + " dòng thiết bị — chia thành nhiều phiếu");
            }
            List<String> problems = new ArrayList<>();
            Integer quantity = quantity(at(r, qtyCol), problems);
            Long unitPrice = unitPrice(at(r, priceCol), problems);
            lines.add(new Line(i + 1, code, quantity, unitPrice, text(at(r, modelCol)), text(at(r, makerCol)),
                    text(at(r, infoCol)), problems.isEmpty() ? null : String.join("; ", problems)));
        }
        if (lines.isEmpty()) {
            throw new FieldValidationException("file", "Tệp không có dòng thiết bị nào — điền cột \"" + HEADER_CODE + "\" theo tệp mẫu");
        }
        return lines;
    }

    /** Số lượng: trống thì 1; còn lại phải là số nguyên trong luật {@code QUANTITY} của ô trên form. */
    static Integer quantity(String raw, List<String> problems) {
        if (raw == null || raw.isBlank()) return 1;
        BigDecimal n = number(raw, false);
        if (n == null) {
            problems.add("Số lượng \"" + raw.trim() + "\" không phải là số");
            return null;
        }
        String violation = NumberRule.QUANTITY.violation(n);
        if (violation != null) {
            problems.add("Số lượng " + violation);
            return null;
        }
        return n.intValueExact();
    }

    /** Đơn giá: trống thì để khai sau; còn lại theo luật {@code UNIT_PRICE} (số nguyên đồng). */
    static Long unitPrice(String raw, List<String> problems) {
        if (raw == null || raw.isBlank()) return null;
        BigDecimal n = number(raw, true);
        if (n == null) {
            problems.add("Đơn giá \"" + raw.trim() + "\" không phải là số");
            return null;
        }
        String violation = NumberRule.UNIT_PRICE.violation(n);
        if (violation != null) {
            problems.add("Đơn giá " + violation);
            return null;
        }
        return n.longValueExact();
    }

    /**
     * Đọc số kiểu Việt Nam lẫn số của ô Excel ({@code 250.5}): có cả "." và "," thì dấu đứng sau là phần thập phân;
     * một loại dấu lặp lại theo nhóm ba ("1.250.000", "1,250,000") là phân cách nghìn; MỘT dấu thì là phần thập phân —
     * riêng tiền, một dấu theo sau đúng ba chữ số ("350.000") là nghìn. {@code null} khi không phải số.
     */
    static BigDecimal number(String raw, boolean money) {
        String s = raw.replace(' ', ' ').replace(" ", "").trim();
        if (money) {
            s = s.replaceAll("(?i)(vnđ|vnd|đồng|đ)$", "");
        }
        boolean negative = false;
        if (s.startsWith("-")) {
            negative = true;
            s = s.substring(1);
        } else if (s.startsWith("(") && s.endsWith(")")) {
            negative = true;
            s = s.substring(1, s.length() - 1);
        }
        if (s.isEmpty() || !s.matches("[0-9.,]+") || !Character.isDigit(s.charAt(0))
                || !Character.isDigit(s.charAt(s.length() - 1))) {
            return null;
        }
        int dots = s.length() - s.replace(".", "").length();
        int commas = s.length() - s.replace(",", "").length();
        String plain;
        if (dots > 0 && commas > 0) {
            char decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
            char group = decimal == '.' ? ',' : '.';
            int at = s.lastIndexOf(decimal);
            String whole = s.substring(0, at);
            String fraction = s.substring(at + 1);
            // "1.250.000,5": phần nguyên phải chia nhóm ba đúng kiểu, phần lẻ không còn dấu nào.
            if (fraction.indexOf(group) >= 0 || !(group == '.' ? GROUPED_DOT : GROUPED_COMMA).matcher(whole).matches()) {
                return null;
            }
            plain = whole.replace(String.valueOf(group), "") + "." + fraction;
        } else if (dots + commas > 1) {
            if (!(dots > 0 ? GROUPED_DOT : GROUPED_COMMA).matcher(s).matches()) return null;
            plain = s.replace(".", "").replace(",", "");
        } else if (dots + commas == 1) {
            boolean thousands = money && (GROUPED_DOT.matcher(s).matches() || GROUPED_COMMA.matcher(s).matches());
            plain = thousands ? s.replace(".", "").replace(",", "") : s.replace(',', '.');
        } else {
            plain = s;
        }
        try {
            BigDecimal n = new BigDecimal(plain);
            return negative ? n.negate() : n;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** "  thcs-27-022 " → "THCS-27-022": mã gõ tay hay có khoảng trắng thừa vẫn khớp. */
    static String normalizeCode(String raw) {
        return raw == null ? "" : raw.replace(' ', ' ').replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }

    private static boolean firstRowIsCode(List<List<String>> rows) {
        for (List<String> r : rows) {
            String first = at(r, 0).trim();
            if (!first.isEmpty()) {
                return CODE_LIKE.matcher(first).matches();
            }
        }
        return false;
    }

    /** Ô chữ: bỏ khoảng trắng hai đầu, trống thì null. */
    private static String text(String s) {
        String t = s == null ? "" : s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String at(List<String> row, int col) {
        return col >= 0 && col < row.size() && row.get(col) != null ? row.get(col) : "";
    }

    private static String plain(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).trim();
    }
}
