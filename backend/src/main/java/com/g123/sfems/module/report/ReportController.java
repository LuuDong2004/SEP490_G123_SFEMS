package com.g123.sfems.module.report;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final DashboardService dashboardService;
    private final AssetReportService assetReportService;

    public ReportController(DashboardService dashboardService, AssetReportService assetReportService) {
        this.dashboardService = dashboardService;
        this.assetReportService = assetReportService;
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
}
