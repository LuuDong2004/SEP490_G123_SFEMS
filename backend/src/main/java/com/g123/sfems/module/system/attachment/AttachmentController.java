package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.InputStreamResource;

/** API tệp đính kèm (TS-03). Quyền kiểm trong {@link AttachmentService}, theo bản ghi gốc. */
@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    /** Hình dạng một tệp trên đường truyền. */
    public record AttachmentResponse(
            Long id,
            String resource,
            Long recordId,
            String fileName,
            String contentType,
            long sizeBytes,
            String note,
            boolean cover,
            boolean image,
            Instant createdAt) {

        static AttachmentResponse from(Attachment row) {
            return new AttachmentResponse(
                    row.getId(),
                    row.getResource(),
                    row.getRecordId(),
                    row.getFileName(),
                    row.getContentType(),
                    row.getSizeBytes(),
                    row.getNote(),
                    row.isCover(),
                    row.getContentType().startsWith("image/"),
                    row.getCreatedAt());
        }
    }

    private final AttachmentService attachments;

    public AttachmentController(AttachmentService attachments) {
        this.attachments = attachments;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('attachments:read')")
    public List<AttachmentResponse> list(@RequestParam String resource, @RequestParam Long recordId) {
        return attachments.list(resource, recordId).stream().map(AttachmentResponse::from).toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('attachments:write')")
    public AttachmentResponse upload(
            @RequestParam String resource,
            @RequestParam Long recordId,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) String note,
            @RequestParam(required = false) String purpose) {
        return AttachmentResponse.from(attachments.upload(resource, recordId, file, note, purpose));
    }

    /** Ảnh và PDF mở ngay trên trình duyệt; các loại khác tải về. */
    @GetMapping("/{id}/content")
    @PreAuthorize("hasAuthority('attachments:read')")
    public ResponseEntity<InputStreamResource> content(@PathVariable Long id) {
        AttachmentService.Content content = attachments.open(id);
        Attachment row = content.attachment();
        boolean inline = row.getContentType().startsWith("image/") || row.getContentType().equals("application/pdf");
        InputStream stream = content.stream();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(row.getContentType()))
                .contentLength(row.getSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition
                        .builder(inline ? "inline" : "attachment")
                        .filename(row.getFileName(), java.nio.charset.StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(new InputStreamResource(stream));
    }

    @PutMapping("/{id}/cover")
    @PreAuthorize("hasAuthority('attachments:write')")
    public AttachmentResponse setCover(@PathVariable Long id) {
        return AttachmentResponse.from(attachments.setCover(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('attachments:delete')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        attachments.delete(id);
        return ResponseEntity.noContent().build();
    }
}
