package com.g123.sfems.module.school.staff;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/staff_assignments} — phân công giáo viên theo năm học (277), mã quyền {@code staff_assignments:*}.
 * Danh sách lọc {@code schoolYear.id} (mặc định năm hiện tại), {@code school.id}, {@code campus.id},
 * {@code subject.id}, {@code q}; {@code GET /candidates}, {@code POST /copy} (chép từ năm học liền trước).
 */
@RestController
@RequestMapping("/api/staff_assignments")
public class StaffAssignmentController {

    private final StaffAssignmentService service;

    public StaffAssignmentController(StaffAssignmentService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('staff_assignments:read')")
    public ResponseEntity<List<StaffAssignmentService.Assignment>> list(
            @RequestParam(name = "school.id", required = false) Long schoolId,
            @RequestParam(name = "schoolYear.id", required = false) Long yearId,
            @RequestParam(name = "campus.id", required = false) Long campusId,
            @RequestParam(name = "subject.id", required = false) Long subjectId,
            @RequestParam(required = false) String q) {
        List<StaffAssignmentService.Assignment> out = service.list(schoolId, yearId, campusId, subjectId, q);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(out.size())).body(out);
    }

    @GetMapping("/candidates")
    @PreAuthorize("hasAuthority('staff_assignments:write')")
    public List<StaffAssignmentService.Candidate> candidates(
            @RequestParam(name = "schoolYear.id", required = false) Long yearId) {
        return service.candidates(yearId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('staff_assignments:read')")
    public StaffAssignmentService.Assignment get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('staff_assignments:write')")
    public StaffAssignmentService.Assignment create(@Valid @RequestBody StaffAssignmentService.Input input) {
        return service.create(input);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('staff_assignments:write')")
    public StaffAssignmentService.Assignment update(@PathVariable Long id,
            @Valid @RequestBody StaffAssignmentService.Input input) {
        return service.update(id, input);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('staff_assignments:delete')")
    public Map<String, Object> delete(@PathVariable Long id) {
        return service.delete(id);
    }

    @PostMapping("/copy")
    @PreAuthorize("hasAuthority('staff_assignments:write')")
    public StaffAssignmentService.CopyResult copy(@Valid @RequestBody StaffAssignmentService.CopyRequest request) {
        return service.copyFromPrevious(request);
    }
}
