package com.g123.sfems.module.report;

import com.g123.sfems.shared.web.HeavyQuery;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.office.DownloadNames;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/reports} — bảng điều khiển và bộ báo cáo.
 *
 * <ul>
 *   <li>{@code GET /dashboard} — chỉ số theo cấp của người xem;</li>
 *   <li>{@code GET /} — danh mục báo cáo;</li>
 *   <li>{@code GET /{name}?from=&to=&year=&bodyId=&levelId=&schoolId=&group=&choice=} — một báo cáo, dạng bảng:
 *       kỳ, năm ngân sách, bộ lọc theo cơ quan quản lý / cấp học / trường, theo loại thiết bị / trạng thái / tình trạng ({@code typeId}, {@code status}, {@code condition} — chỉ báo cáo khai ở {@link ReportFilters}) và chiều tổng hợp;</li>
 *   <li>{@code GET /{name}/export?...} — cùng báo cáo, tệp Excel. Đường dẫn chứa
 *       {@code /export} nên nhật ký hoạt động ghi lại lần xuất, kèm người xuất.</li>
 * </ul>
 * PDF không có endpoint riêng: màn báo cáo có bố cục in (A4, lặp tiêu đề bảng),
 * và "In → Lưu thành PDF" của trình duyệt cho ra đúng bản đó với phông tiếng Việt.
 */
@HeavyQuery
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reports;
    private final DashboardService dashboard;

    public ReportController(ReportService reports, DashboardService dashboard) {
        this.reports = reports;
        this.dashboard = dashboard;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('reports:read')")
    public DashboardService.Dashboard dashboard(
            @RequestParam(defaultValue = "month") String period,
            @RequestParam(defaultValue = "7") int days) {
        return dashboard.build(period, days);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('reports:read')")
    public List<ReportService.Definition> definitions() {
        return ReportService.DEFINITIONS;
    }

    @GetMapping("/{name}")
    @PreAuthorize("hasAuthority('reports:read')")
    public ReportService.Report report(@PathVariable String name,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Long bodyId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String choice,
            @RequestParam(required = false) Long typeId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) Long campusId) {
        return reports.build(name, new ReportService.Params(from, to, year, bodyId, levelId, schoolId, group, choice,
                typeId, status, condition, campusId));
    }

    @GetMapping("/{name}/export")
    @PreAuthorize("hasAuthority('reports:export')")
    public ResponseEntity<byte[]> export(@PathVariable String name,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Long bodyId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String choice,
            @RequestParam(required = false) Long typeId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) Long campusId) {
        ReportService.Params params = new ReportService.Params(from, to, year, bodyId, levelId, schoolId, group, choice,
                typeId, status, condition, campusId);
        ReportService.Report report = reports.build(name, params);
        // Biểu số liệu CSVC: đúng bố cục mẫu của Sở (tiêu đề ba hàng, ô gộp), không phải bảng chung.
        byte[] body = CsvcStatisticsReport.NAME.equals(name) ? reports.csvcWorkbook(params)
                : XlsxWriter.write(new XlsxWriter.Sheet(report.title(), report.subtitle(),
                report.columns().stream().map(c -> new XlsxWriter.Column(c.key(), c.label(), c.type())).toList(),
                report.rows()));
        String file = DownloadNames.safe(report.title()) + " - " + LocalDate.now() + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }
}
