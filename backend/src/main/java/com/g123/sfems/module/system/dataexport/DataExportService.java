package com.g123.sfems.module.system.dataexport;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.office.XlsxWriter;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xuất TOÀN BỘ dữ liệu nghiệp vụ trong phạm vi người xuất: một tệp .zip, mỗi
 * bảng một tệp .xlsx, mọi cột như trong cơ sở dữ liệu.
 *
 * <p>Để làm gì: bàn giao dữ liệu khi đổi nhà cung cấp, lưu trữ cuối năm, đối
 * chiếu với phần mềm kế toán. Vì thế cột giữ tên kỹ thuật và giá trị gốc (mã
 * trạng thái, id khoá ngoại) — bản này để máy đọc lại, báo cáo mới là để người
 * đọc.
 *
 * <p>KHÔNG xuất tài khoản, mật khẩu, phiên đăng nhập, nhật ký hệ thống: đó là
 * dữ liệu an ninh, không phải dữ liệu nghiệp vụ, và không ai cần chúng để
 * chuyển sang một phần mềm khác. Phạm vi là {@link VisibleSchools}: UBND xuất
 * đúng các trường của mình.
 *
 * <p>Ghi THẲNG ra luồng trả về, từng dòng một: đọc bằng con trỏ ({@code fetchSize}) và
 * {@link XlsxWriter#stream}, nên bộ nhớ không phụ thuộc số dòng — toàn ngành là hàng
 * triệu tài sản và chục triệu dòng lịch sử, giữ hết trong RAM là sập cả ứng dụng. Bảng
 * vượt giới hạn dòng của Excel tách thành nhiều tệp ({@code equipment_history-2.xlsx}…).
 * Đọc trong MỘT giao dịch chỉ đọc (con trỏ của pgjdbc chỉ chạy khi tắt autocommit), không
 * có trần thời gian cho từng câu: một bảng lớn được phép đọc lâu hơn trần chung.
 */
@Service
@Transactional(readOnly = true)
public class DataExportService {

    /** Bảng có cột {@code school_id}. */
    private static final List<String> SCHOOL_TABLES = List.of(
            "campuses", "buildings", "rooms", "staff", "equipment", "equipment_intakes", "inventory_sessions",
            "purchase_proposals");

    /** Bảng dòng: bảng → (cột khoá ngoại, bảng cha). */
    private static final Map<String, String[]> LINE_TABLES = new LinkedHashMap<>();

    /** Tên trong tệp ZIP dành cho người đọc; tên bảng SQL ở trên vẫn giữ nguyên. */
    private static final Map<String, String> FILE_TITLES = Map.ofEntries(
            Map.entry("schools", "Trường học"),
            Map.entry("campuses", "Điểm trường"),
            Map.entry("buildings", "Khối nhà"),
            Map.entry("rooms", "Phòng"),
            Map.entry("staff", "Cán bộ giáo viên"),
            Map.entry("equipment", "Thiết bị"),
            Map.entry("equipment_intakes", "Phiếu ghi tăng"),
            Map.entry("inventory_sessions", "Phiếu kiểm kê"),
            Map.entry("purchase_proposals", "Đề xuất mua sắm"),
            Map.entry("equipment_intake_lines", "Chi tiết phiếu ghi tăng"),
            Map.entry("inventory_lines", "Chi tiết phiếu kiểm kê"),
            Map.entry("inventory_surplus", "Thiết bị kiểm kê thừa"),
            Map.entry("purchase_proposal_lines", "Chi tiết đề xuất mua sắm"),
            Map.entry("equipment_history", "Lịch sử thiết bị"),
            Map.entry("equipment_catalogs", "Danh mục thiết bị"),
            Map.entry("equipment_types", "Loại thiết bị"),
            Map.entry("education_levels", "Cấp học"),
            Map.entry("departments_of_education", "Cơ quan giáo dục"));

    static {
        LINE_TABLES.put("equipment_intake_lines", new String[] {"intake_id", "equipment_intakes"});
        LINE_TABLES.put("inventory_lines", new String[] {"session_id", "inventory_sessions"});
        LINE_TABLES.put("inventory_surplus", new String[] {"session_id", "inventory_sessions"});
        LINE_TABLES.put("purchase_proposal_lines", new String[] {"proposal_id", "purchase_proposals"});
    }

    /** Số dòng mỗi lần pgjdbc kéo về từ con trỏ. */
    private static final int FETCH_SIZE = 1_000;

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;

    public DataExportService(DataSource dataSource, VisibleSchools visible) {
        // JdbcTemplate riêng: không mang trần spring.jdbc.template.query-timeout của bean chung, và đọc theo lô.
        this.jdbc = new JdbcTemplate(dataSource);
        this.jdbc.setFetchSize(FETCH_SIZE);
        this.visible = visible;
    }

    /** Ghi tệp .zip ra {@code out}; không đóng {@code out}. */
    public void full(OutputStream out) {
        try (ZipOutputStream zip = new ZipOutputStream(new NonClosing(out))) {
            put(zip, "schools", "SELECT * FROM schools s WHERE TRUE" + visible.sqlFilter("s.id") + "ORDER BY s.id");
            for (String table : SCHOOL_TABLES) {
                put(zip, table, "SELECT t.* FROM " + table + " t WHERE TRUE" + visible.sqlFilter("t.school_id")
                        + "ORDER BY t.id");
            }
            for (Map.Entry<String, String[]> e : LINE_TABLES.entrySet()) {
                String[] fk = e.getValue();
                put(zip, e.getKey(), "SELECT l.* FROM " + e.getKey() + " l JOIN " + fk[1] + " p ON p.id = l." + fk[0]
                        + " WHERE TRUE" + visible.sqlFilter("p.school_id") + "ORDER BY l.id");
            }
            put(zip, "equipment_history", "SELECT h.* FROM equipment_history h JOIN equipment e ON e.id = h.equipment_id"
                    + " WHERE TRUE" + visible.sqlFilter("e.school_id") + "ORDER BY h.id");
            for (String catalog : List.of("equipment_catalogs", "equipment_types", "education_levels",
                    "departments_of_education")) {
                put(zip, catalog, "SELECT * FROM " + catalog + " ORDER BY id");
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void put(ZipOutputStream zip, String name, String sql) {
        jdbc.query(sql, (ResultSetExtractor<Void>) rs -> {
            try {
                write(zip, name, rs);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            return null;
        });
    }

    private static void write(ZipOutputStream zip, String name, ResultSet rs) throws SQLException, IOException {
        ResultSetMetaData md = rs.getMetaData();
        List<XlsxWriter.Column> columns = new ArrayList<>();
        for (int i = 1; i <= md.getColumnCount(); i++) {
            String col = md.getColumnLabel(i);
            String type = switch (md.getColumnType(i)) {
                case Types.DATE -> "date";
                case Types.BIGINT, Types.INTEGER, Types.NUMERIC, Types.DECIMAL, Types.SMALLINT ->
                        col.endsWith("_id") || "id".equals(col) ? "id" : "number";
                default -> "text";
            };
            columns.add(new XlsxWriter.Column(col, col, type));
        }
        int part = 1;
        XlsxWriter.SheetStream sheet = open(zip, name, part, columns);
        Object[] values = new Object[columns.size()];
        while (rs.next()) {
            if (sheet.rows() == XlsxWriter.MAX_DATA_ROWS) {
                sheet.close();
                zip.closeEntry();
                sheet = open(zip, name, ++part, columns);
            }
            for (int i = 0; i < values.length; i++) {
                Object v = rs.getObject(i + 1);
                if (v instanceof byte[]) {
                    v = "(nhị phân, không xuất)";
                } else if (v != null && !(v instanceof Number) && !(v instanceof Date)) {
                    v = v.toString();
                }
                values[i] = v;
            }
            sheet.row(values);
        }
        sheet.close();
        zip.closeEntry();
    }

    private static XlsxWriter.SheetStream open(ZipOutputStream zip, String name, int part,
            List<XlsxWriter.Column> columns) throws IOException {
        String title = FILE_TITLES.getOrDefault(name, name);
        String file = part == 1 ? title : title + " - phần " + part;
        zip.putNextEntry(new ZipEntry(file + ".xlsx"));
        return XlsxWriter.stream(zip, file, part == 1 ? "Bảng " + title : "Bảng " + title + ", phần " + part,
                columns);
    }

    /** Đóng tệp .zip không được đóng luồng của response — Spring còn phải hoàn tất nó. */
    private static final class NonClosing extends FilterOutputStream {

        NonClosing(OutputStream out) {
            super(out);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            out.write(b, off, len);
        }

        @Override
        public void close() throws IOException {
            flush();
        }
    }
}
