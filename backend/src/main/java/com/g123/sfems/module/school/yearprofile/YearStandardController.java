package com.g123.sfems.module.school.yearprofile;

import jakarta.validation.Valid;
import com.g123.sfems.shared.office.XlsxWriter;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

/**
 * {@code /api/year_standards} — chuẩn tối thiểu theo năm học, theo điểm trường (docs/du-lieu-theo-nam-hoc.md §8 bước 2, 4). Đọc
 * mượn quyền {@code purchase_proposals:read} như màn Thiết bị tối thiểu.
 */
@RestController
@RequestMapping("/api/year_standards")
public class YearStandardController {

    private final YearStandardService service;
    private final YearGapService gaps;

    public YearStandardController(YearStandardService service, YearGapService gaps) {
        this.service = service;
        this.gaps = gaps;
    }

    /** Lập đề xuất mua sắm nháp đúng số thiếu của các dòng đã chọn. */
    @PostMapping("/proposal")
    @PreAuthorize("hasAuthority('purchase_proposals:write')")
    public YearGapService.ProposalResult proposal(@Valid @RequestBody YearGapService.ProposalRequest request) {
        return gaps.toProposal(request);
    }

    /** Căn cứ chuẩn tối thiểu của các dòng một đề xuất / một kế hoạch mua sắm. */
    @GetMapping("/traces")
    @PreAuthorize("hasAuthority('purchase_proposals:read') or hasAuthority('procurement_plans:read')")
    public List<YearGapService.Trace> traces(@RequestParam(required = false) Long proposalId,
            @RequestParam(required = false) Long planId) {
        return gaps.traces(proposalId, planId);
    }

    /** Một trường ({@code schoolId}, mặc định trường người gọi), một năm ({@code yearId}, mặc định hiện tại). */
    @GetMapping
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public YearStandardService.YearStandard get(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long yearId, @RequestParam(required = false) Long campusId) {
        return service.get(schoolId, yearId, campusId);
    }

    /** Các trường trong phạm vi — Sở lọc trường có điều chỉnh, có dòng ngoài thông tư, chênh lệch lớn. */
    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public ResponseEntity<List<YearStandardService.OverviewRow>> overview(@RequestParam(required = false) Long yearId) {
        List<YearStandardService.OverviewRow> out = service.overview(yearId);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(out.size())).body(out);
    }

    private static final Map<String, String> STATUS = Map.of(
            "DRAFT", "Đang khai", "CONFIRMED", "Đã xác nhận", "CLOSED", "Đã chốt", "REOPENED", "Mở lại");

    /** Bảng các trường của {@link #overview} ra tệp Excel — cùng cột với màn Chuẩn tối thiểu của Sở. */
    @GetMapping("/overview.xlsx")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public ResponseEntity<byte[]> overviewXlsx(@RequestParam(required = false) Long yearId) {
        List<Map<String, Object>> rows = service.overview(yearId).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("school", r.schoolName());
            m.put("status", STATUS.getOrDefault(r.status(), r.status()));
            m.put("percentTt", r.hasEquipment() ? r.percentTt() : null);
            m.put("percentAdjusted", r.hasEquipment() ? r.percentAdjusted() : null);
            m.put("short", r.hasEquipment() ? r.shortItemsAdjusted() : null);
            m.put("note", r.hasEquipment() ? "" : "Chưa nhập thiết bị");
            return m;
        }).toList();
        List<XlsxWriter.Column> columns = List.of(
                new XlsxWriter.Column("school", "Trường", "text"),
                new XlsxWriter.Column("status", "Hồ sơ năm học", "text"),
                new XlsxWriter.Column("percentTt", "Đáp ứng theo thông tư (%)", "number"),
                new XlsxWriter.Column("percentAdjusted", "Đáp ứng theo điều chỉnh (%)", "number"),
                new XlsxWriter.Column("short", "Số loại còn thiếu", "number"),
                new XlsxWriter.Column("note", "Ghi chú", "text"));
        byte[] body = XlsxWriter.write(new XlsxWriter.Sheet("Thiết bị dạy học tối thiểu theo năm học",
                "Mức đáp ứng của từng trường", columns, rows));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("Thiết bị tối thiểu theo năm học.xlsx", StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }
}
