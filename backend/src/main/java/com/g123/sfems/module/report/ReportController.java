package com.g123.sfems.module.report;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final DashboardService dashboardService;
    private final AssetReportService assetReportService;
    private final AdequacyReportService adequacyReportService;
    private final PurchaseReportService purchaseReportService;
    private final InventoryReportService inventoryReportService;
    private final ReportExportService reportExportService;

    public ReportController(DashboardService dashboardService, AssetReportService assetReportService,
            AdequacyReportService adequacyReportService, PurchaseReportService purchaseReportService,
            InventoryReportService inventoryReportService, ReportExportService reportExportService) {
        this.dashboardService = dashboardService;
        this.assetReportService = assetReportService;
        this.adequacyReportService = adequacyReportService;
        this.purchaseReportService = purchaseReportService;
        this.inventoryReportService = inventoryReportService;
        this.reportExportService = reportExportService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('reports:read')")
    public DashboardResponse dashboard(@RequestParam(required = false) Long schoolYearId,
            @RequestParam(defaultValue = "month") String period) {
        return dashboardService.get(schoolYearId, period);
    }

    @GetMapping("/assets")
    @PreAuthorize("hasAuthority('reports:read')")
    public AssetReportResponse assets(@RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate, @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long subjectId, @RequestParam(required = false) Long equipmentTypeId,
            @RequestParam(required = false) String status, @RequestParam(required = false) Long originId) {
        return assetReportService.get(fromDate, toDate, schoolId, subjectId, equipmentTypeId, status, originId);
    }

    @GetMapping("/adequacy")
    @PreAuthorize("hasAuthority('reports:read')")
    public AdequacyReportResponse adequacy(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long subjectId, @RequestParam(required = false) Long gradeId,
            @RequestParam(required = false) Long equipmentTypeId) {
        return adequacyReportService.get(schoolId, subjectId, gradeId, equipmentTypeId);
    }

    @GetMapping("/purchase")
    @PreAuthorize("hasAuthority('reports:read')")
    public PurchaseReportResponse purchase(@RequestParam(required = false) Integer year,
            @RequestParam(required = false) Long schoolId, @RequestParam(required = false) Long equipmentId,
            @RequestParam(required = false) String status) {
        return purchaseReportService.get(year, schoolId, equipmentId, status);
    }

    @GetMapping("/inventory")
    @PreAuthorize("hasAuthority('reports:read')")
    public InventoryReportResponse inventory(@RequestParam(required = false) Long campaignId,
            @RequestParam(required = false) Long schoolId) {
        return inventoryReportService.get(campaignId, schoolId);
    }

    @PostMapping("/export-xlsx")
    @PreAuthorize("hasAuthority('reports:export')")
    public ResponseEntity<byte[]> exportXlsx(@RequestBody ReportExportQuery query) {
        ReportExportRequest request;
        try {
            request = reportExportService.build(query);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
        if (request == null || request.columns() == null || request.columns().isEmpty()
                || request.columns().size() > 40 || request.rows() == null
                || request.columns().stream().anyMatch(column -> column == null || column.label() == null
                        || column.type() == null
                        || !java.util.Set.of("text", "number", "money", "date").contains(column.type()))
                || request.rows().stream().anyMatch(java.util.Objects::isNull)) {
            return ResponseEntity.badRequest().build();
        }
        byte[] body = XlsxWriter.write(request);
        String base = request.filename() == null ? "bao-cao" : request.filename()
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]", "-").replaceAll("-+", "-");
        if (base.isBlank()) base = "bao-cao";
        String filename = base + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    @PostMapping("/export-csv")
    @PreAuthorize("hasAuthority('reports:export')")
    public ResponseEntity<byte[]> exportCsv(@RequestBody ReportExportQuery query) {
        ReportExportRequest request;
        try {
            request = reportExportService.build(query);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
        String base = request.filename() == null ? "bao-cao" : request.filename();
        byte[] body = csv(request).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(base + ".csv", StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    private static String csv(ReportExportRequest request) {
        StringBuilder output = new StringBuilder("\uFEFF");
        appendCsvRow(output, java.util.List.of(request.title()));
        appendCsvRow(output, java.util.List.of(request.subtitle()));
        appendCsvRow(output, java.util.List.of());
        appendCsvRow(output, request.columns().stream().map(ReportExportRequest.Column::label).toList());
        for (java.util.List<Object> row : request.rows()) {
            java.util.List<String> values = new java.util.ArrayList<>(request.columns().size());
            for (int i = 0; i < request.columns().size(); i++) {
                Object value = i < row.size() ? row.get(i) : null;
                String text = value == null ? "" : String.valueOf(value);
                if (request.columns().get(i).type().equals("text") && text.matches("^[\\s]*[=+@\\-].*")) {
                    text = "'" + text;
                }
                values.add(text);
            }
            appendCsvRow(output, values);
        }
        return output.toString();
    }

    private static void appendCsvRow(StringBuilder output, java.util.List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) output.append(',');
            String value = values.get(i) == null ? "" : values.get(i);
            output.append('"').append(value.replace("\"", "\"\"")).append('"');
        }
        output.append("\r\n");
    }
}
