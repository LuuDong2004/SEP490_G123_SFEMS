package com.g123.sfems.module.school.yearprofile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/school_year_profiles} — hồ sơ năm học theo điểm trường, chốt / mở lại (278), mã quyền
 * {@code school_year_profiles:read|write|confirm|reopen}.
 */
@RestController
@RequestMapping("/api/school_year_profiles")
public class SchoolYearProfileController {

    private final SchoolYearProfileService service;
    private final SchoolYearInitService init;

    public SchoolYearProfileController(SchoolYearProfileService service, SchoolYearInitService init) {
        this.service = service;
        this.init = init;
    }

    /** Khởi tạo năm học mới từ năm liền trước (màn C): trường mình, hoặc Sở chọn nhiều trường. */
    @PostMapping("/init")
    @PreAuthorize("hasAuthority('school_year_profiles:write')")
    public SchoolYearInitService.InitResult init(@Valid @RequestBody SchoolYearInitService.InitRequest request) {
        return init.init(request);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('school_year_profiles:read')")
    public SchoolYearProfileService.YearProfile profile(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long yearId) {
        return service.profile(schoolId, yearId);
    }

    /** Năm đã chốt chưa — màn lớp, phân công, điều chỉnh đọc để chuyển sang chỉ xem. */
    @GetMapping("/lock")
    @PreAuthorize("hasAuthority('school_year_profiles:read')")
    public Map<String, Object> lock(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long yearId) {
        return Map.of("closed", service.closed(schoolId, yearId));
    }

    @GetMapping("/progress")
    @PreAuthorize("hasAuthority('school_year_profiles:read')")
    public ResponseEntity<List<SchoolYearProfileService.ProgressRow>> progress(
            @RequestParam(required = false) Long yearId) {
        List<SchoolYearProfileService.ProgressRow> out = service.progress(yearId);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(out.size())).body(out);
    }

    @PostMapping("/confirm")
    @PreAuthorize("hasAuthority('school_year_profiles:confirm')")
    public SchoolYearProfileService.YearProfile confirm(
            @Valid @RequestBody SchoolYearProfileService.CampusRequest request) {
        return service.confirm(request);
    }

    @PostMapping("/unconfirm")
    @PreAuthorize("hasAuthority('school_year_profiles:confirm')")
    public SchoolYearProfileService.YearProfile unconfirm(
            @Valid @RequestBody SchoolYearProfileService.CampusRequest request) {
        return service.unconfirm(request);
    }

    @PostMapping("/close")
    @PreAuthorize("hasAuthority('school_year_profiles:confirm')")
    public SchoolYearProfileService.YearProfile close(@Valid @RequestBody SchoolYearProfileService.YearRequest request) {
        return service.close(request);
    }

    @PostMapping("/reopen")
    @PreAuthorize("hasAuthority('school_year_profiles:reopen')")
    public SchoolYearProfileService.YearProfile reopen(
            @Valid @RequestBody SchoolYearProfileService.ReopenRequest request) {
        return service.reopen(request);
    }
}
