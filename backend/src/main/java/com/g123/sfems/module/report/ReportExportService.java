package com.g123.sfems.module.report;

import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/** BC-06: dựng tệp từ dữ liệu truy vấn lại, không tin các dòng do trình duyệt gửi lên. */
@Service
public class ReportExportService {
    private final AssetReportService assets;
    private final AdequacyReportService adequacy;
    private final PurchaseReportService purchase;
    private final InventoryReportService inventory;

    public ReportExportService(AssetReportService assets, AdequacyReportService adequacy,
            PurchaseReportService purchase, InventoryReportService inventory) {
        this.assets = assets;
        this.adequacy = adequacy;
        this.purchase = purchase;
        this.inventory = inventory;
    }

    public ReportExportRequest build(ReportExportQuery query) {
        if (query == null || query.report() == null) throw new IllegalArgumentException("Thiếu loại báo cáo cần xuất.");
        String search = fold(query.search());
        return switch (query.report().toUpperCase(Locale.ROOT)) {
            case "ASSETS" -> assets(query, search);
            case "ADEQUACY" -> adequacy(query, search);
            case "PURCHASE" -> purchase(query, search);
            case "INVENTORY" -> inventory(query, search);
            default -> throw new IllegalArgumentException("Loại báo cáo không được hỗ trợ.");
        };
    }

    private ReportExportRequest assets(ReportExportQuery q, String search) {
        AssetReportResponse report = assets.getForExport(q.fromDate(), q.toDate(), q.schoolId(), q.subjectId(),
                q.equipmentTypeId(), q.status(), q.originId(), q.search());
        List<AssetReportResponse.Row> rows = report.rows().stream().filter(r -> matches(search,
                r.code(), r.name(), r.schoolName())).toList();
        return request("bao-cao-tai-san-thiet-bi", "Báo cáo tài sản thiết bị",
                report.fromDate() + " — " + report.toDate() + " · " + rows.size() + " thiết bị",
                List.of(col("Mã thiết bị", "text"), col("Tên thiết bị", "text"), col("Trường", "text"),
                        col("Môn học", "text"), col("Loại thiết bị", "text"), col("Trạng thái", "text"),
                        col("Nguồn hình thành", "text"), col("Tình trạng", "text"), col("Số lượng", "number"),
                        col("Nguyên giá", "money"), col("Ngày ghi tăng", "date")),
                rows.stream().map(r -> list(r.code(), r.name(), r.schoolName(), r.subjectName(), r.equipmentTypeName(),
                        r.statusLabel(), r.originName(), r.condition(), r.quantity(), r.originalValue(), r.receivedDate())).toList());
    }

    private ReportExportRequest adequacy(ReportExportQuery q, String search) {
        AdequacyReportResponse report = adequacy.get(q.schoolId(), q.subjectId(), q.gradeId(), q.equipmentTypeId());
        if (!report.details().isEmpty()) {
            List<AdequacyReportResponse.DetailRow> rows = report.details().stream().filter(r -> matches(search,
                    r.schoolCode(), r.schoolName(), r.normCode(), r.normName(), r.catalogCode(), r.catalogName(),
                    r.subjectName(), r.gradeName(), r.gradeLevels())).toList();
            return request("bao-cao-dap-ung-dinh-muc", "Chi tiết đáp ứng danh mục thiết bị tối thiểu",
                    rows.size() + " dòng định mức · " + report.details().get(0).schoolName(),
                    List.of(col("Mã trường", "text"), col("Trường", "text"), col("Mã định mức", "text"),
                            col("Thiết bị / định mức", "text"), col("Môn học", "text"), col("Khối lớp", "text"),
                            col("Loại thiết bị", "text"), col("Định mức", "number"), col("Hiện có", "number"),
                            col("Thiếu", "number"), col("Thừa", "number"), col("Đáp ứng (%)", "number")),
                    rows.stream().map(r -> list(r.schoolCode(), r.schoolName(), r.itemNo() == null ? r.normCode() : r.itemNo(),
                            r.catalogName() == null ? r.normName() : r.catalogName(), r.subjectName(),
                            r.gradeName() == null ? r.gradeLevels() : r.gradeName(), r.equipmentTypeName(), r.required(),
                            r.available(), r.shortage(), r.surplus(), r.percent())).toList());
        }
        List<AdequacyReportResponse.Row> rows = report.rows().stream().filter(r -> matches(search, r.schoolCode(), r.schoolName())).toList();
        return request("bao-cao-dap-ung-dinh-muc", "Đáp ứng danh mục thiết bị tối thiểu", rows.size() + " trường",
                List.of(col("Mã trường", "text"), col("Trường", "text"), col("Cấp học", "text"),
                        col("Số định mức", "number"), col("Đã đạt", "number"), col("Chưa tính", "number"),
                        col("Định mức thiếu", "number"), col("Thiết bị thiếu", "number"), col("Định mức thừa", "number"),
                        col("Thiết bị thừa", "number"), col("Tỷ lệ đạt (%)", "number")),
                rows.stream().map(r -> list(r.schoolCode(), r.schoolName(), r.educationLevel(), r.norms(), r.met(),
                        r.unknown(), r.shortageNorms(), r.shortageTotal(), r.surplusNorms(), r.surplusTotal(), r.percent())).toList());
    }

    private ReportExportRequest purchase(ReportExportQuery q, String search) {
        PurchaseReportResponse report = purchase.get(q.year(), q.schoolId(), q.equipmentId(), q.status());
        List<PurchaseReportResponse.Row> rows = report.rows().stream().filter(r -> matches(search, r.name())).toList();
        return request("bao-cao-nhu-cau-mua-sam", "Nhu cầu và kế hoạch mua sắm", rows.size() + " đơn vị",
                List.of(col("Trường / cơ quan quản lý", "text"), col("Số trường", "number"), col("Số đề xuất", "number"),
                        col("Chờ duyệt", "number"), col("Đã duyệt", "number"), col("Đã vào kế hoạch", "number"),
                        col("Số lượng đề xuất", "number"), col("Số đã nhập về", "number"), col("Dự toán (đ)", "money"),
                        col("Dự toán đã duyệt (đ)", "money")),
                rows.stream().map(r -> list(r.name(), r.schools(), r.proposals(), r.pending(), r.approved(), r.planned(),
                        r.quantity(), r.receivedQuantity(), r.amount(), r.approvedAmount())).toList());
    }

    private ReportExportRequest inventory(ReportExportQuery q, String search) {
        InventoryReportResponse report = inventory.get(q.campaignId(), q.schoolId());
        List<InventoryReportResponse.Row> rows = report.rows().stream().filter(r -> matches(search, r.code(), r.campaign(), r.school())).toList();
        return request("bao-cao-ket-qua-kiem-ke", "Báo cáo kết quả kiểm kê", rows.size() + " phiếu kiểm kê",
                List.of(col("Số phiếu", "text"), col("Đợt kiểm kê", "text"), col("Trường", "text"),
                        col("Ngày kiểm kê", "date"), col("Trạng thái", "text"), col("Số thiết bị theo sổ", "number"),
                        col("Số khớp", "number"), col("Số thiếu", "number"), col("Số thừa", "number"),
                        col("Số hỏng", "number"), col("Sai vị trí", "number"), col("Giá trị chênh lệch ước tính (đ)", "money")),
                rows.stream().map(r -> list(r.code(), r.campaign(), r.school(), r.inventoryDate(), r.statusLabel(),
                        r.bookQuantity(), r.matchedQuantity(), r.shortageQuantity(), r.surplusQuantity(), r.damagedQuantity(),
                        r.wrongLocationQuantity(), r.discrepancyValue())).toList());
    }

    private static ReportExportRequest request(String filename, String title, String subtitle,
            List<ReportExportRequest.Column> columns, List<List<Object>> rows) {
        return new ReportExportRequest(filename, title, subtitle, columns, rows);
    }
    private static ReportExportRequest.Column col(String label, String type) { return new ReportExportRequest.Column(label, type); }
    private static List<Object> list(Object... values) { return java.util.Arrays.asList(values); }
    private static boolean matches(String search, String... values) {
        if (search.isBlank()) return true;
        for (String value : values) if (value != null && fold(value).contains(search)) return true;
        return false;
    }
    private static String fold(String value) {
        if (value == null) return "";
        return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT).replace('đ', 'd').trim();
    }
}
