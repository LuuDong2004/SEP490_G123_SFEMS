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
 * {@code /api/school_year_profiles} — hồ sơ năm học của trường: khai dữ liệu đầu năm, xác nhận đã khai (không khoá), mã
 * quyền {@code school_year_profiles:read|write|confirm}.
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

    /** Khai dữ liệu năm học mới từ năm liền trước (lên lớp, chép phân công, điều chỉnh) — chỉ tài khoản trường. */
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

    @GetMapping("/progress")
    @PreAuthorize("hasAuthority('school_year_profiles:read')")
    public ResponseEntity<List<SchoolYearProfileService.ProgressRow>> progress(
            @RequestParam(required = false) Long yearId) {
        List<SchoolYearProfileService.ProgressRow> out = service.progress(yearId);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(out.size())).body(out);
    }

    /** Lãnh đạo trường xác nhận đã khai dữ liệu năm học — báo Sở, trường vẫn sửa được. */
    @PostMapping("/confirm")
    @PreAuthorize("hasAuthority('school_year_profiles:confirm')")
    public SchoolYearProfileService.YearProfile confirm(
            @Valid @RequestBody SchoolYearProfileService.YearRequest request) {
        return service.confirm(request);
    }
}
