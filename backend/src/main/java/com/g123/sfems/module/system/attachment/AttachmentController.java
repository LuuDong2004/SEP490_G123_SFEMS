package com.g123.sfems.module.system.attachment;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * {@code /api/attachments} — tệp gắn vào phiếu và hồ sơ (TS-03).
 *
 * <p>Không có {@code @PreAuthorize} theo mã quyền như các controller khác: tệp không có mã quyền
 * {@code attachments:*}. Mã quyền {@code <resource>:read|write} của BẢN GHI GỐC cùng phạm vi dữ liệu của nó
 * được {@link AttachmentService} kiểm qua {@code RecordAccessRegistry} (như {@code VoucherEventController}).
 * Chưa đăng nhập thì {@code SecurityConfig} đã chặn.
 */
@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    private final AttachmentService service;

    public AttachmentController(AttachmentService service) {
        this.service = service;
    }

    @GetMapping
    public List<AttachmentInfo> list(@RequestParam String resource, @RequestParam Long recordId) {
        return service.list(resource, recordId);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentInfo upload(
            @RequestParam String resource,
            @RequestParam Long recordId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String note) throws IOException {
        return service.upload(resource, recordId, file, note);
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        AttachmentService.Content content = service.content(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(content.fileName(), StandardCharsets.UTF_8).build().toString())
                .contentLength(content.sizeBytes())
                .body(new InputStreamResource(content.stream()));
    }

    public record CoverRequest(
            @Size(max = 100, message = "Vùng cắt không hợp lệ")
            String crop) {
    }

    @PostMapping("/{id}/cover")
    public AttachmentInfo cover(@PathVariable Long id, @Valid @RequestBody(required = false) CoverRequest request) {
        return service.cover(id, request == null ? null : request.crop());
    }

    @DeleteMapping("/{id}")
    public AttachmentInfo delete(@PathVariable Long id) {
        return service.delete(id);
    }
}
