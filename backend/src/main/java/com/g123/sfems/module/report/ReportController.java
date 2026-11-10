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

    public ReportController(DashboardService dashboardService, AssetReportService assetReportService,
            AdequacyReportService adequacyReportService, PurchaseReportService purchaseReportService,
            InventoryReportService inventoryReportService) {
        this.dashboardService = dashboardService;
        this.assetReportService = assetReportService;
        this.adequacyReportService = adequacyReportService;
        this.purchaseReportService = purchaseReportService;
        this.inventoryReportService = inventoryReportService;
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
    public ResponseEntity<byte[]> exportXlsx(@RequestBody ReportExportRequest request) {
        if (request == null || request.columns() == null || request.columns().isEmpty()
                || request.columns().size() > 40 || request.rows() == null || request.rows().size() > 5000
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
}
