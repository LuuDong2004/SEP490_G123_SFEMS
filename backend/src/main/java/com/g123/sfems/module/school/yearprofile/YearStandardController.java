package com.g123.sfems.module.school.yearprofile;

import jakarta.validation.Valid;
import java.util.List;
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

    /** Điểm trường khác đang thừa một thiết bị — gợi ý để trường chuyển phòng trên hồ sơ thiết bị. */
    @GetMapping("/suggestions")
    @PreAuthorize("hasAuthority('purchase_proposals:read')")
    public List<YearGapService.Suggestion> suggestions(@RequestParam Long catalogId,
            @RequestParam(required = false) Long toCampusId) {
        return gaps.suggestions(catalogId, toCampusId);
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
}
