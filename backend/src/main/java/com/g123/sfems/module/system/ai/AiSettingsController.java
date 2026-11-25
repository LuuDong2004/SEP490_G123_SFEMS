package com.g123.sfems.module.system.ai;

import com.g123.sfems.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/ai_settings} — cấu hình AI (một bản ghi, không theo dialect danh sách), kiểm tra kết nối, và
 * {@code /calls} — nhật ký các lần gọi theo dialect thường (mảng + {@code X-Total-Count}). Chỉ ADMIN.
 */
@RestController
@RequestMapping("/api/ai_settings")
public class AiSettingsController {

    private final AiSettingsService service;

    public AiSettingsController(AiSettingsService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ai_settings:read')")
    public AiSettingsService.Settings get() {
        return service.get();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('ai_settings:write')")
    public AiSettingsService.Settings update(@Valid @RequestBody AiSettingsService.Update body) {
        return service.update(body);
    }

    @PostMapping("/test")
    @PreAuthorize("hasAuthority('ai_settings:write')")
    public AiSettingsService.TestResult test() {
        return service.test();
    }

    @GetMapping("/calls")
    @PreAuthorize("hasAuthority('ai_settings:read')")
    public ResponseEntity<List<Map<String, Object>>> calls(@RequestParam(name = "_start", defaultValue = "0") int start,
            @RequestParam(name = "_end", defaultValue = "20") int end,
            @RequestParam(name = "_order", defaultValue = "desc") String order) {
        return ListResponse.of(service.calls(start, end, "asc".equalsIgnoreCase(order)), service.countCalls());
    }
}
