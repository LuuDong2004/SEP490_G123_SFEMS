package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.school.procurement.AdequacyService.NormRow;
import com.g123.sfems.module.school.procurement.AdequacyService.SchoolAdequacy;
import com.g123.sfems.module.school.procurement.AdequacyService.SchoolSummary;
import com.g123.sfems.module.school.procurement.AdequacyService.Summary;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.office.XlsxWriter.Column;
import com.g123.sfems.shared.office.XlsxWriter.Sheet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tệp Excel của phép đối chiếu thiết bị tối thiểu: bảng của MỘT trường (mỗi thiết bị một dòng — phải
 * có, đang có, thiếu, thừa) và bảng tổng hợp các trường trên địa bàn. Cùng số với màn hình, vì cùng
 * đọc {@link AdequacyService}.
 */
final class AdequacyExcel {

    private AdequacyExcel() {
    }

    static byte[] school(SchoolAdequacy a) {
        List<Column> columns = List.of(
                new Column("subject", "Môn học", "text"),
                new Column("code", "Mã DM thiết bị", "text"),
                new Column("name", "Thiết bị", "text"),
                new Column("type", "Loại", "text"),
                new Column("norm", "Định mức", "text"),
                new Column("grades", "Lớp áp dụng", "text"),
                new Column("required", "Phải có", "number"),
                new Column("current", "Đang có", "number"),
                new Column("shortage", "Thiếu", "number"),
                new Column("surplus", "Thừa", "number"),
                new Column("proposed", "Đề xuất mua sắm thiết bị", "number"),
                new Column("note", "Ghi chú", "text"));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (NormRow r : a.rows()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("subject", r.subjectName());
            row.put("code", r.catalogCode());
            row.put("name", r.normName());
            row.put("type", r.typeName());
            row.put("norm", r.quantityText() != null ? r.quantityText()
                    : r.minQuantity() == null ? "Không ghi" : r.minQuantity().stripTrailingZeros().toPlainString());
            row.put("grades", r.gradeLevels() == null ? "Mọi lớp" : r.gradeLevels().replace(",", ", "));
            // Dòng tự chọn không tính đủ / thiếu: số "phải có" theo cả trường (có dòng lên cả nghìn) chỉ gây hiểu nhầm.
            row.put("required", r.optional() ? null : r.required());
            row.put("current", r.current());
            row.put("shortage", r.counted() ? r.shortage() : null);
            row.put("surplus", r.counted() ? r.surplus() : null);
            row.put("proposed", r.proposed() == 0 ? null : r.proposed());
            row.put("note", r.optional() ? "Tự chọn"
                    : r.minQuantity() == null ? "Phụ lục không ghi số lượng" : r.warning());
            rows.add(row);
        }
        String subtitle = "%s · %s lớp · %s học sinh · đủ %d/%d thiết bị · thiếu %d · thừa %d".formatted(
                a.level() == null ? "" : a.level(), a.classCount() == null ? "?" : a.classCount(),
                a.studentCount() == null ? "?" : a.studentCount(), a.met(), a.norms(), a.shortItems(),
                a.surplusItems());
        return XlsxWriter.write(new Sheet("Thiết bị dạy học tối thiểu — " + a.schoolName(), subtitle, columns, rows));
    }

    static byte[] summary(Summary s) {
        List<Column> columns = List.of(
                new Column("code", "Mã trường", "text"),
                new Column("school", "Trường", "text"),
                new Column("level", "Cấp học", "text"),
                new Column("district", "Địa bàn", "text"),
                new Column("norms", "Thiết bị phải có", "number"),
                new Column("met", "Đã đủ", "number"),
                new Column("percent", "Tỷ lệ đáp ứng (%)", "number"),
                // Đếm loại, không có cột tổng số lượng: các dòng khác đơn vị (ml, gam, bộ…) không cộng được với nhau.
                new Column("short_items", "Loại còn thiếu", "number"),
                new Column("surplus_items", "Loại còn thừa", "number"),
                new Column("unknown", "Chưa tính được", "number"),
                new Column("state", "Dữ liệu", "text"));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (SchoolSummary r : s.rows()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", r.schoolCode());
            row.put("school", r.schoolName());
            row.put("level", r.level());
            row.put("district", r.district());
            row.put("norms", r.norms());
            row.put("met", r.met());
            row.put("percent", r.percent());
            row.put("short_items", r.shortItems());
            row.put("surplus_items", r.surplusItems());
            row.put("unknown", r.unknown());
            row.put("state", r.hasEquipment() ? (r.unknown() > 0 ? "Thiếu dữ liệu nền" : "Đủ dữ liệu")
                    : "Chưa nhập thiết bị");
            rows.add(row);
        }
        String subtitle = "%d trường · %d trường đã nhập thiết bị · tỷ lệ đáp ứng %d%%".formatted(s.schools(),
                s.withData(), s.percent());
        return XlsxWriter.write(new Sheet("Mức đáp ứng thiết bị dạy học tối thiểu", subtitle, columns, rows));
    }
}
