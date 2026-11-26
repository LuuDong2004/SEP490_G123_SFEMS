package com.g123.sfems.module.report;

import com.g123.sfems.domain.catalog.facilitystandard.FacilityStandardRule;
import com.g123.sfems.module.school.facilitystandard.FacilityStandardService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Báo cáo "Đánh giá mức độ chuẩn CSVC": mỗi trường trong phạm vi một dòng — số loại CSVC đạt / số loại có
 * quy tắc ở từng mức, và mức cao nhất trường đạt. Phần chấm ở {@link FacilityStandardService}; bấm một dòng mở bản
 * đánh giá chi tiết của trường đó (khoá ẩn {@code school_id}). Biểu đồ đọc thêm các khoá ẩn: số loại đạt của từng mức,
 * từng khối, và danh sách loại chưa đạt.
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
        for (FacilityStandardService.Summary s : standards.summaries(reports.scope("s.id", p), p.campusId())) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", s.school().code());
            row.put("name", s.school().name());
            row.put("level", s.school().levelName());
            for (FacilityStandardService.TierSummary t : s.tiers()) {
                String key = t.tier().toLowerCase();
                row.put(key, t.total() == 0 ? "—" : t.passed() + "/" + t.total());
                row.put(key + "_passed", t.passed());
                row.put(key + "_total", t.total());
            }
            row.put("failed_min", s.failedMinimum());
            row.put("reached", s.reachedLabel());
            row.put("school_id", s.school().id());
            row.put("groups", groups(s));
            row.put("failed", failed(s));
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

    /** Từng khối: số loại đạt, chưa đạt mức tối thiểu. Khối không có loại nào đặt chuẩn thì bỏ. */
    private static List<Map<String, Object>> groups(FacilityStandardService.Summary s) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (FacilityStandardService.Group g : s.groups()) {
            long passed = count(g, FacilityStandardService.PASS);
            long failed = count(g, FacilityStandardService.FAIL);
            if (passed + failed > 0) {
                out.add(Map.of("name", g.name(), "passed", passed, "failed", failed));
            }
        }
        return out;
    }

    private static long count(FacilityStandardService.Group g, String status) {
        return g.items().stream().filter(i -> status.equals(i.status().get(FacilityStandardRule.MIN))).count();
    }

    /** Các loại chưa đạt ít nhất một mức: mức nào chưa đạt, đang có bao nhiêu, còn thiếu gì. */
    private static List<Map<String, Object>> failed(FacilityStandardService.Summary s) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (FacilityStandardService.Group g : s.groups()) {
            for (FacilityStandardService.Item i : g.items()) {
                List<String> tiers = i.status().entrySet().stream()
                        .filter(e -> FacilityStandardService.FAIL.equals(e.getValue()))
                        .map(e -> e.getKey().toLowerCase()).toList();
                if (!tiers.isEmpty()) {
                    out.add(Map.of("name", i.name(), "group", g.name(), "count", i.count(), "tiers", tiers, "note",
                            i.shortfalls().stream().map(l -> l.replaceFirst("^- ", "")).collect(Collectors.joining(" · "))));
                }
            }
        }
        return out;
    }
}
