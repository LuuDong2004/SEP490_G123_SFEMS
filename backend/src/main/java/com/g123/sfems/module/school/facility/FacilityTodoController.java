package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.school.facility.FacilityTodoService.TodoItem;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/facility_todo/{schoolId}} — danh sách "Cần hoàn thiện" của một trường: dữ liệu CSVC còn thiếu và chỗ đáng
 * ngờ, mỗi mục kèm số đếm, tác động và gợi ý mở đâu để sửa. Cùng quyền đọc với {@code facility_info}.
 */
@RestController
@RequestMapping("/api/facility_todo")
public class FacilityTodoController {

    private final FacilityTodoService service;

    public FacilityTodoController(FacilityTodoService service) {
        this.service = service;
    }

    @GetMapping("/{schoolId}")
    @PreAuthorize("hasAuthority('rooms:read')")
    public List<TodoItem> get(@PathVariable Long schoolId) {
        return service.todo(schoolId);
    }
}
