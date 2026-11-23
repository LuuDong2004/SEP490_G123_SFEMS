package com.g123.sfems.module.school.yearprofile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/school_norm_adjustments} — điều chỉnh chuẩn tối thiểu của trường theo điểm trường × năm học (279), mã
 * quyền {@code school_norm_adjustments:*}. Danh sách lọc {@code schoolId}, {@code yearId}, {@code kind},
 * {@code status}; {@code GET /history?normId&campusId}; {@code POST} lưu, {@code POST /{id}/reconfirm},
 * {@code DELETE /{id}}.
 */
@RestController
@RequestMapping("/api/school_norm_adjustments")
public class SchoolNormAdjustmentController {

    private final SchoolNormAdjustmentService service;

    public SchoolNormAdjustmentController(SchoolNormAdjustmentService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('school_norm_adjustments:read')")
    public ResponseEntity<List<SchoolNormAdjustmentService.Item>> list(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) Long yearId, @RequestParam(required = false) String kind,
            @RequestParam(required = false) String status) {
        List<SchoolNormAdjustmentService.Item> out = service.list(schoolId, yearId, kind, status);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(out.size())).body(out);
    }

    @GetMapping("/history")
    @PreAuthorize("hasAuthority('school_norm_adjustments:read')")
    public List<SchoolNormAdjustmentService.Event> history(@RequestParam(required = false) Long schoolId,
            @RequestParam Long normId, @RequestParam(required = false) Long campusId) {
        return service.history(schoolId, normId, campusId);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('school_norm_adjustments:write')")
    public SchoolNormAdjustmentService.Item save(@Valid @RequestBody SchoolNormAdjustmentService.Input input) {
        return service.save(input);
    }

    @PostMapping("/{id}/reconfirm")
    @PreAuthorize("hasAuthority('school_norm_adjustments:write')")
    public SchoolNormAdjustmentService.Item reconfirm(@PathVariable Long id) {
        return service.reconfirm(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('school_norm_adjustments:delete')")
    public Map<String, Object> remove(@PathVariable Long id) {
        return service.remove(id);
    }
}
