package com.g123.sfems.module.system.activity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code POST /api/activity_logs/exports} — màn hình báo một lần xuất chạy TRÊN TRÌNH DUYỆT (in / lưu PDF, xuất
 * CSV), để nhật ký hoạt động có cả những lần xuất máy chủ không thấy (HSMT 3.9.6). Xuất Excel đi qua máy chủ nên
 * đã tự được ghi.
 *
 * <p>Ai đã đăng nhập cũng gọi được — người xuất là người của phiên, không nhận từ request. Endpoint không tự ghi
 * gì: nó đặt lần xuất lên request, và {@link ActivityLogInterceptor} ghi đúng một dòng cho request này với nội
 * dung đó. Báo sai thì chỉ làm sai dòng nhật ký của chính mình; không đọc hay mở thêm dữ liệu nào.
 */
@RestController
public class ExportLogController {

    /**
     * @param resource tài nguyên đã xuất — tên resource của màn hình (vd. {@code equipment}, {@code report_data_quality})
     * @param format   {@code PDF} hoặc {@code CSV}
     * @param rows     số dòng đã xuất (không biết thì bỏ trống)
     * @param detail   phạm vi / bộ lọc / tiêu đề bản in
     * @param path     màn hình đã xuất (đường dẫn trên trình duyệt)
     */
    public record ExportRequest(
            @NotBlank @Size(max = 60) @Pattern(regexp = "[a-z0-9_]+") String resource,
            @NotBlank @Pattern(regexp = "PDF|CSV") String format,
            @Min(0) @Max(100_000_000) Integer rows,
            @Size(max = 1000) String detail,
            @Size(max = 500) String path) {
    }

    @PostMapping("/api/activity_logs/exports")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> report(@Valid @RequestBody ExportRequest body, HttpServletRequest request) {
        request.setAttribute(ActivityLogInterceptor.EXPORT, new ActivityLogInterceptor.ExportEvent(body.resource(),
                body.format(), body.rows(), body.detail(), body.path()));
        return Map.of("success", true);
    }
}
