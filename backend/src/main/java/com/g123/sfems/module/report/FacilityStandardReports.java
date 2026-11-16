package com.g123.sfems.module.report;

import com.g123.sfems.module.school.facilitystandard.FacilityStandardService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Báo cáo "Đánh giá mức độ chuẩn CSVC" (QLTB-649): mỗi trường trong phạm vi một dòng — số loại CSVC đạt / số loại có
 * quy tắc ở từng mức, và mức cao nhất trường đạt. Phần chấm ở {@link FacilityStandardService}; bấm một dòng mở bản
 * đánh giá chi tiết của trường đó (khoá ẩn {@code school_id}).
 */
final class FacilityStandardReports {

    static final ReportService.Definition DEFINITION = new ReportService.Definition("facility-standard",
            "Đánh giá mức độ chuẩn CSVC",
            "Mỗi trường: số loại CSVC đạt / số loại có chuẩn ở mức tối thiểu, mức độ 1, mức độ 2, và mức trường "
                    + "đạt. Bấm một trường để xem chi tiết.",
            false, false, List.of());

    private final FacilityStandardService standards;
    private final ReportService reports;

    FacilityStandardReports(FacilityStandardService standards, ReportService reports) {
        this.standards = standards;
        this.reports = reports;
    }

    ReportService.Report build(ReportService.Params p) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (FacilityStandardService.Summary s : standards.summaries(reports.scope("s.id", p))) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", s.school().code());
            row.put("name", s.school().name());
            row.put("level", s.school().levelName());
            for (FacilityStandardService.TierSummary t : s.tiers()) {
                row.put(t.tier().toLowerCase(), t.total() == 0 ? "—" : t.passed() + "/" + t.total());
            }
            row.put("failed_min", s.failedMinimum());
            row.put("reached", s.reachedLabel());
            row.put("school_id", s.school().id());
            rows.add(row);
        }
        List<ReportService.Column> columns = List.of(
                new ReportService.Column("code", "Mã trường", "text"),
                new ReportService.Column("name", "Trường", "text"),
                new ReportService.Column("level", "Cấp học", "text"),
                new ReportService.Column("min", "Tối thiểu", "text"),
                new ReportService.Column("level1", "Mức độ 1", "text"),
                new ReportService.Column("level2", "Mức độ 2", "text"),
                new ReportService.Column("failed_min", "Chưa đạt tối thiểu", "number"),
                new ReportService.Column("reached", "Mức đạt", "text"));
        return new ReportService.Report("facility-standard", "Đánh giá mức độ chuẩn CSVC", reports.subtitle(p, null),
                columns, rows);
    }
}
