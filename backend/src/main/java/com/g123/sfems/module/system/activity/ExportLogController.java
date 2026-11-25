package com.g123.sfems.module.system.activity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.g123.sfems.shared.office.XlsxWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    /** Một cột của bảng xuất: khoá trong dòng, tiêu đề, kiểu ({@code text} / {@code number}). */
    public record XlsxColumn(@NotBlank @Size(max = 60) String key, @NotBlank @Size(max = 120) String label,
            @NotBlank @Pattern(regexp = "text|number") String type) {
    }

    /**
     * Bảng màn hình đang hiện (đúng các cột, đúng các dòng đang lọc) ra tệp Excel. Dữ liệu do màn hình gửi lên — người
     * gọi chỉ nhận lại đúng thứ mình gửi, không đọc thêm gì từ CSDL; lần xuất được ghi vào nhật ký như mọi lần xuất.
     */
    public record XlsxRequest(
            @NotBlank @Size(max = 60) @Pattern(regexp = "[a-z0-9_]+") String resource,
            @NotBlank @Size(max = 150) String filename,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 300) String subtitle,
            @NotNull @Size(min = 1, max = 40) List<@Valid XlsxColumn> columns,
            @NotNull @Size(max = 50_000) List<Map<String, Object>> rows,
            /* Trang tính thêm sau trang đầu (cùng cột), vd. mỗi trường một trang. */
            @Size(max = 300) List<@Valid XlsxPart> parts,
            @Size(max = 1000) String detail,
            @Size(max = 500) String path) {
    }

    /** Một trang tính thêm: tên trang (≤ 31 ký tự Excel cắt bớt), tiêu đề, các dòng. */
    public record XlsxPart(@NotBlank @Size(max = 120) String name, @Size(max = 200) String title,
            @NotNull @Size(max = 50_000) List<Map<String, Object>> rows) {
    }

    @PostMapping("/api/activity_logs/exports/xlsx")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> xlsx(@Valid @RequestBody XlsxRequest body, HttpServletRequest request) {
        List<XlsxWriter.Column> columns = body.columns().stream()
                .map(c -> new XlsxWriter.Column(c.key(), c.label(), c.type())).toList();
        XlsxWriter.Sheet main = new XlsxWriter.Sheet(body.title(), body.subtitle() == null ? "" : body.subtitle(),
                columns, body.rows());
        byte[] file;
        if (body.parts() == null || body.parts().isEmpty()) {
            file = XlsxWriter.write(main);
        } else {
            List<XlsxWriter.Tab> tabs = new java.util.ArrayList<>();
            tabs.add(new XlsxWriter.Tab("Tổng hợp", main));
            for (XlsxPart p : body.parts()) {
                tabs.add(new XlsxWriter.Tab(p.name(), new XlsxWriter.Sheet(p.title() == null ? p.name() : p.title(),
                        "", columns, p.rows())));
            }
            file = XlsxWriter.writeAll(tabs);
        }
        request.setAttribute(ActivityLogInterceptor.EXPORT, new ActivityLogInterceptor.ExportEvent(body.resource(),
                "XLSX", body.rows().size(), body.detail(), body.path()));
        String name = body.filename().endsWith(".xlsx") ? body.filename() : body.filename() + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(file);
    }

    @PostMapping("/api/activity_logs/exports")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> report(@Valid @RequestBody ExportRequest body, HttpServletRequest request) {
        request.setAttribute(ActivityLogInterceptor.EXPORT, new ActivityLogInterceptor.ExportEvent(body.resource(),
                body.format(), body.rows(), body.detail(), body.path()));
        return Map.of("success", true);
    }
}
