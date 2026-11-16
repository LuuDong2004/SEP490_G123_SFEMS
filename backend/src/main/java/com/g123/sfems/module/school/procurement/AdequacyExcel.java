package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.catalog.norm.office.XlsxWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Xuất Excel cho màn mức đáp ứng định mức (NC-01): bảng của MỘT trường và bảng tổng hợp mọi trường.
 *
 * <p>Dùng {@link XlsxWriter} sẵn có thay vì viết lại bộ ghi tệp: số để là số thật, ngày là ngày thật, Excel
 * cộng lọc được. Bản tổng hợp có thêm trang "Cân đối theo thiết bị" — cùng dữ liệu với bảng trên màn hình.
 */
final class AdequacyExcel {

    private AdequacyExcel() {
    }

    /** Bảng của một trường: một dòng mỗi định mức. */
    static byte[] school(AdequacyService.SchoolAdequacy a) {
        List<XlsxWriter.Column> columns = List.of(
                new XlsxWriter.Column("normCode", "Mã định mức", "text"),
                new XlsxWriter.Column("normName", "Tên định mức", "text"),
                new XlsxWriter.Column("catalogCode", "Mã thiết bị", "text"),
                new XlsxWriter.Column("subjectName", "Môn", "text"),
                new XlsxWriter.Column("basis", "Căn cứ", "text"),
                new XlsxWriter.Column("required", "Phải có", "number"),
                new XlsxWriter.Column("current", "Đang có", "number"),
                new XlsxWriter.Column("proposed", "Đã đề xuất", "number"),
                new XlsxWriter.Column("shortage", "Còn thiếu", "number"),
                new XlsxWriter.Column("surplus", "Thừa", "number"),
                new XlsxWriter.Column("warning", "Ghi chú", "text"));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AdequacyService.NormRow r : a.rows()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("normCode", r.normCode());
            row.put("normName", r.normName());
            row.put("catalogCode", r.catalogCode());
            row.put("subjectName", r.subjectName());
            row.put("basis", basisLabel(r.basis()));
            row.put("required", r.required());
            row.put("current", r.current());
            row.put("proposed", r.proposed());
            row.put("shortage", r.shortage());
            row.put("surplus", r.surplus());
            row.put("warning", r.warning());
            rows.add(row);
        }
        String subtitle = "%s (%s) — %s lớp, %s học sinh. Định mức %d, đã đủ %d, còn thiếu %d."
                .formatted(a.schoolName(), a.schoolCode(),
                        a.classCount() == null ? "—" : a.classCount(),
                        a.studentCount() == null ? "—" : a.studentCount(),
                        a.norms(), a.met(), a.shortageTotal());
        return XlsxWriter.write(new XlsxWriter.Sheet(
                "Mức đáp ứng định mức thiết bị", subtitle, columns, rows));
    }

    /** Tổng hợp mọi trường, kèm trang cân đối theo thiết bị. */
    static byte[] summary(AdequacyService.Summary s) {
        List<XlsxWriter.Column> columns = List.of(
                new XlsxWriter.Column("schoolCode", "Mã trường", "text"),
                new XlsxWriter.Column("schoolName", "Trường", "text"),
                new XlsxWriter.Column("level", "Cấp", "text"),
                new XlsxWriter.Column("norms", "Định mức", "number"),
                new XlsxWriter.Column("met", "Đã đủ", "number"),
                new XlsxWriter.Column("unknown", "Chưa tính được", "number"),
                new XlsxWriter.Column("shortageTotal", "Còn thiếu", "number"),
                new XlsxWriter.Column("percent", "Đáp ứng (%)", "number"));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AdequacyService.SchoolSummary r : s.rows()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("schoolCode", r.schoolCode());
            row.put("schoolName", r.schoolName());
            row.put("level", r.level());
            row.put("norms", r.norms());
            row.put("met", r.met());
            row.put("unknown", r.unknown());
            row.put("shortageTotal", r.shortageTotal());
            row.put("percent", r.percent());
            rows.add(row);
        }
        String subtitle = "%d trường; %d trường đủ định mức; %d trường còn thiếu; %d%% đáp ứng."
                .formatted(s.schools(), s.fullyMet(), s.withShortage(), s.percent());
        XlsxWriter.Sheet schools = new XlsxWriter.Sheet(
                "Mức đáp ứng định mức theo trường", subtitle, columns, rows);

        List<XlsxWriter.Column> balanceColumns = List.of(
                new XlsxWriter.Column("name", "Thiết bị", "text"),
                new XlsxWriter.Column("subjectName", "Môn", "text"),
                new XlsxWriter.Column("shortage", "Tổng thiếu", "number"),
                new XlsxWriter.Column("shortSchools", "Số trường thiếu", "number"),
                new XlsxWriter.Column("surplus", "Tổng thừa", "number"),
                new XlsxWriter.Column("surplusSchools", "Số trường thừa", "number"),
                new XlsxWriter.Column("transferable", "Điều chuyển được", "number"));
        List<Map<String, Object>> balances = new ArrayList<>();
        for (AdequacyService.CatalogBalance b : s.catalogs()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", b.name());
            row.put("subjectName", b.subjectName());
            row.put("shortage", b.shortage());
            row.put("shortSchools", b.shortSchools());
            row.put("surplus", b.surplus());
            row.put("surplusSchools", b.surplusSchools());
            row.put("transferable", b.transferable());
            balances.add(row);
        }
        XlsxWriter.Sheet balance = new XlsxWriter.Sheet("Cân đối theo thiết bị",
                "Thiết bị trường này thừa là thứ trường khác đang thiếu; \"Điều chuyển được\" là phần nhỏ hơn.",
                balanceColumns, balances);

        return XlsxWriter.writeAll(List.of(
                new XlsxWriter.Tab("Theo trường", schools),
                new XlsxWriter.Tab("Cân đối thiết bị", balance)));
    }

    /** Nhãn tiếng Việt của căn cứ định mức. */
    private static String basisLabel(String basis) {
        return switch (basis == null ? "PER_SCHOOL" : basis) {
            case "PER_CLASS" -> "Mỗi lớp";
            case "PER_STUDENT" -> "Mỗi học sinh";
            case "PER_TEACHER" -> "Mỗi giáo viên";
            case "PER_ROOM" -> "Mỗi phòng bộ môn";
            default -> "Mỗi trường";
        };
    }
}
