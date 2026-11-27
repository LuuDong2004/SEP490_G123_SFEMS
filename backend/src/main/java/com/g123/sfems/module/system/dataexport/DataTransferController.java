package com.g123.sfems.module.system.dataexport;

import com.g123.sfems.module.system.dataimport.ImportService;
import com.g123.sfems.module.system.dataimport.ImportTarget;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.DownloadNames;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * {@code /api/data_transfer} — nhập dữ liệu hàng loạt và xuất toàn bộ dữ liệu.
 *
 * <ul>
 *   <li>{@code GET /targets} — các loại dữ liệu nhập được, kèm cột;</li>
 *   <li>{@code GET /templates/{target}} — tệp mẫu .xlsx;</li>
 *   <li>{@code POST /imports/{target}/preview} — đọc và kiểm tra, không ghi;</li>
 *   <li>{@code POST /imports/{target}} — nhập thật, tất cả hoặc không gì;</li>
 *   <li>{@code GET /export} — toàn bộ dữ liệu trong phạm vi, một tệp .zip. Nhật ký
 *       hoạt động ghi lại mỗi lần xuất.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/data_transfer")
public class DataTransferController {

    private static final long MAX_UPLOAD = 10L * 1024 * 1024;
    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    public record TargetInfo(String name, String title, List<ImportTarget.Column> columns) {
    }

    private final ImportService imports;
    private final DataExportService exports;

    public DataTransferController(ImportService imports, DataExportService exports) {
        this.imports = imports;
        this.exports = exports;
    }

    @GetMapping("/targets")
    @PreAuthorize("hasAuthority('data_transfer:read')")
    public List<TargetInfo> targets() {
        return imports.targets().stream().map(t -> new TargetInfo(t.name(), t.title(), t.columns())).toList();
    }

    @GetMapping("/templates/{target}")
    @PreAuthorize("hasAuthority('data_transfer:read')")
    public ResponseEntity<byte[]> template(@PathVariable String target) {
        return file(imports.template(target), "Mẫu nhập " + DownloadNames.safe(imports.title(target)) + ".xlsx", XLSX);
    }

    @PostMapping("/imports/{target}/preview")
    @PreAuthorize("hasAuthority('data_transfer:write')")
    public ImportService.Preview preview(@PathVariable String target, @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long schoolId) {
        return imports.preview(target, schoolId, file.getOriginalFilename(), bytes(file));
    }

    @PostMapping("/imports/{target}")
    @PreAuthorize("hasAuthority('data_transfer:write')")
    public ImportService.Preview commit(@PathVariable String target, @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long schoolId) {
        return imports.commit(target, schoolId, file.getOriginalFilename(), bytes(file));
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('data_transfer:export')")
    public void export(HttpServletResponse response) throws IOException {
        // Ghi thẳng ra response, không dựng cả tệp trong bộ nhớ trước (DataExportService). Chạy trên luồng của
        // request chứ không StreamingResponseBody: luồng async bị cắt ở hạn async-timeout của Tomcat (30 giây),
        // còn xuất toàn ngành có thể lâu hơn nhiều.
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename("Dữ liệu thiết bị - " + LocalDate.now() + ".zip", StandardCharsets.UTF_8).build().toString());
        exports.full(response.getOutputStream());
    }

    private static byte[] bytes(MultipartFile file) {
        if (file.isEmpty()) {
            throw new FieldValidationException("file", "Chọn tệp để nhập");
        }
        if (file.getSize() > MAX_UPLOAD) {
            throw new FieldValidationException("file", "Tệp tối đa 10 MB");
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
    }

    private static ResponseEntity<byte[]> file(byte[] body, String name, MediaType type) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .contentType(type)
                .body(body);
    }
}
