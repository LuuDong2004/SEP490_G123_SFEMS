package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import com.g123.sfems.shared.data.RecordAccessRegistry;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.storage.ObjectStorage;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.FileSignature;
import com.g123.sfems.shared.validation.TextNormalizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * {@code /api/attachments} — tệp gắn vào phiếu và hồ sơ thiết bị.
 *
 * <p>Không có mã quyền {@code attachments:*}. Đọc tệp của một phiếu cần quyền
 * ĐỌC phiếu đó, thêm hoặc xoá tệp cần quyền SỬA phiếu đó — cả mã quyền lẫn phạm
 * vi dữ liệu, hỏi qua {@link RecordAccessRegistry}. Một mã quyền riêng cho tệp
 * sẽ mở ra đúng cái lỗ ấy: người không được xem phiếu thanh lý vẫn tải được biên
 * bản thanh lý.
 *
 * <p>Nội dung tệp nằm trong MinIO ({@link ObjectStorage}), dòng chỉ giữ khoá đối tượng.
 * Dòng cũ còn {@code data} (chưa kịp chuyển) vẫn đọc được từ database.
 */
@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    /** 10 MB — đủ cho một bản scan nhiều trang, không đủ để cơ sở dữ liệu thành kho video. */
    private static final long MAX_BYTES = 10L * 1024 * 1024;

    /**
     * Trần số ẢNH của một bản ghi (phòng, thiết bị…): đủ chụp các góc, không để kho thành album. PDF, tài liệu không
     * tính vào đây. Giao diện ghi cùng số ("3/10 ảnh").
     */
    static final int MAX_IMAGES = 10;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "png", "jpg", "jpeg", "webp", "gif",
            "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "txt", "csv", "zip", "xml");

    private final AttachmentRepository repository;
    private final RecordAccessRegistry records;
    private final ObjectStorage storage;
    private final TransactionTemplate tx;
    private final TransactionTemplate readTx;

    public AttachmentController(AttachmentRepository repository, RecordAccessRegistry records, ObjectStorage storage,
            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.records = records;
        this.storage = storage;
        this.tx = new TransactionTemplate(transactionManager);
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
    }

    @GetMapping
    public List<AttachmentInfo> list(@RequestParam String resource, @RequestParam Long recordId) {
        records.checkReadable(resource, recordId);
        return repository.listOf(resource, recordId);
    }

    /**
     * Tải một tệp lên. KHÔNG chạy trong một giao dịch bao trùm: đẩy tới 10 MB lên MinIO (có thể là MinIO
     * dùng chung ở xa) trong lúc giữ một kết nối CSDL là để vài chục người cùng chụp ảnh tài sản chiếm
     * hết pool. Thứ tự vẫn như {@link ObjectStorage} mô tả — đối tượng TRƯỚC, dòng SAU — chỉ là ba bước
     * tách rời: kiểm quyền (giao dịch đọc ngắn), đẩy đối tượng (không kết nối nào), rồi một giao dịch
     * ngắn kiểm quyền lần nữa và lưu dòng. Bước cuối hỏng thì gỡ đối tượng vừa đẩy — bù trừ thay cho
     * lùi giao dịch.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentInfo upload(
            @RequestParam String resource,
            @RequestParam Long recordId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String note) throws IOException {
        // Kiểm trước khi đẩy: người không có quyền không được đẩy được byte nào lên kho.
        readTx.executeWithoutResult(status -> records.checkWritable(resource, recordId));
        if (file.isEmpty()) {
            throw new FieldValidationException("file", "Tệp rỗng");
        }
        // Tài nguyên có thể siết luật riêng (ảnh đại diện cán bộ: chỉ ảnh, tối đa 2 MB).
        var rules = records.rulesOf(resource);
        long maxBytes = rules.maxBytes() > 0 ? Math.min(rules.maxBytes(), MAX_BYTES) : MAX_BYTES;
        if (file.getSize() > maxBytes) {
            throw new FieldValidationException("file", "Tệp tối đa " + (maxBytes / (1024 * 1024)) + " MB");
        }
        String name = fileName(file.getOriginalFilename());
        String extension = extension(name);
        Set<String> allowed = rules.allowedExtensions() != null ? rules.allowedExtensions() : ALLOWED_EXTENSIONS;
        if (!allowed.contains(extension) || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new FieldValidationException("file", rules.allowedExtensions() != null
                    ? "Chỉ nhận tệp " + String.join(", ", allowed.stream().sorted().map(e -> e.toUpperCase(Locale.ROOT)).toList())
                    : "Chỉ nhận PDF, ảnh, tài liệu văn phòng, CSV, ZIP hoặc XML hoá đơn điện tử");
        }
        // Đuôi do người gửi đặt; nội dung thì không giả được bằng cách đổi tên.
        byte[] head;
        try (InputStream in = file.getInputStream()) {
            head = in.readNBytes(8192);
        }
        if (!FileSignature.matches(extension, head)) {
            throw new FieldValidationException("file",
                    "Nội dung tệp không đúng định dạng ." + extension + " — tệp có thể bị đổi đuôi hoặc hỏng");
        }
        String contentTypeOf = FileSignature.CONTENT_TYPES.get(extension);
        if (contentTypeOf != null && contentTypeOf.startsWith("image/")
                && Boolean.TRUE.equals(readTx.execute(status -> repository.countImages(resource, recordId) >= MAX_IMAGES))) {
            throw new FieldValidationException("file", "Mỗi bản ghi tối đa " + MAX_IMAGES + " ảnh — xoá bớt ảnh cũ trước");
        }
        String trimmedNote = note == null ? null : TextNormalizer.normalize(note);
        String noteProblem = FieldRule.NOTE.violation(trimmedNote, 0);
        if (noteProblem != null) {
            throw new FieldValidationException("note", "Ghi chú " + noteProblem);
        }

        Attachment attachment = new Attachment();
        attachment.setResource(resource);
        attachment.setRecordId(recordId);
        attachment.setFileName(name);
        // Content-Type suy từ đuôi đã kiểm, KHÔNG nhận của trình duyệt — nếu không, một tệp tự khai "text/html"
        // sẽ được trả về đúng như vậy lúc tải xuống.
        String contentType = FileSignature.CONTENT_TYPES.get(extension);
        attachment.setContentType(contentType);
        attachment.setSizeBytes(file.getSize());
        attachment.setNote(trimmedNote == null || trimmedNote.isEmpty() ? null : trimmedNote);
        // Đẩy lên kho TRƯỚC khi lưu dòng, ngoài mọi giao dịch.
        String key = objectKey(resource, recordId, name);
        storage.put(key, file.getInputStream(), file.getSize(), contentType);
        attachment.setStorageKey(key);
        try {
            return tx.execute(status -> {
                // Lần nữa, trong giao dịch ghi: quyền có thể đã đổi trong lúc tệp đang truyền.
                records.checkWritable(resource, recordId);
                Attachment saved = repository.save(attachment);
                return repository.info(saved.getId()).orElseThrow();
            });
        } catch (RuntimeException | Error e) {
            // Dòng không lưu được: gỡ đối tượng, nếu không nó thành mồ côi trong kho.
            storage.discard(key);
            throw e;
        }
    }

    @GetMapping("/{id}/content")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        Attachment attachment = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment", id));
        records.checkReadable(attachment.getResource(), attachment.getRecordId());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(attachment.getFileName(), StandardCharsets.UTF_8).build().toString())
                .contentLength(attachment.getSizeBytes())
                .body(attachment.getStorageKey() != null
                        ? new InputStreamResource(storage.get(attachment.getStorageKey()))
                        : new ByteArrayResource(attachment.getData()));
    }

    public record CoverRequest(
            @Size(max = 100, message = "Vùng cắt không hợp lệ")
            String crop) {
    }

    /**
     * Đặt một ẢNH làm ảnh đại diện của bản ghi, kèm cách đóng khung vuông ("x,y,zoom"). Ảnh
     * đại diện cũ (nếu có) bị bỏ dấu trong cùng giao dịch. Quyền là quyền ghi trên bản ghi gốc.
     */
    @PostMapping("/{id}/cover")
    @Transactional
    public AttachmentInfo cover(@PathVariable Long id, @Valid @RequestBody CoverRequest request) {
        Attachment attachment = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment", id));
        records.checkWritable(attachment.getResource(), attachment.getRecordId());
        if (attachment.getContentType() == null || !attachment.getContentType().startsWith("image/")) {
            throw new FieldValidationException("file", "Chỉ ảnh mới đặt làm ảnh đại diện được");
        }
        String crop = request == null ? null : request.crop();
        if (crop != null && !crop.matches("\\d{1,3}(\\.\\d+)?,\\d{1,3}(\\.\\d+)?,\\d(\\.\\d+)?")) {
            throw new FieldValidationException("crop", "Vùng cắt không hợp lệ");
        }
        repository.clearCover(attachment.getResource(), attachment.getRecordId(), id);
        attachment.setCover(true);
        attachment.setCoverCrop(crop);
        repository.save(attachment);
        return repository.info(id).orElseThrow();
    }

    /** Vọng lại tệp vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    @Transactional
    public AttachmentInfo delete(@PathVariable Long id) {
        AttachmentInfo info = repository.info(id).orElseThrow(() -> new ResourceNotFoundException("Attachment", id));
        records.checkWritable(info.resource(), info.recordId());
        String key = repository.storageKeyOf(id);
        repository.deleteById(id);
        // Xoá đối tượng SAU khi dòng đã chắc chắn mất; lùi lại thì tệp còn nguyên.
        storage.deleteAfterCommit(key);
        return info;
    }

    /** {@code equipment/60/3f2a…-e1.jpg}: gom theo bản ghi, tên ngẫu nhiên nên không đè nhau. */
    static String objectKey(String resource, Long recordId, String fileName) {
        String ext = extension(fileName);
        return resource + "/" + recordId + "/" + UUID.randomUUID() + (ext.isEmpty() ? "" : "." + ext);
    }

    /**
     * Tên tệp đem lưu: chỉ phần tên (trình duyệt cũ gửi cả đường dẫn "C:\...\a.pdf"), chuẩn hoá Unicode, bỏ ký tự
     * điều khiển và ký tự không hợp lệ trong tên tệp; quá 255 ký tự thì giữ phần cuối (còn đuôi).
     */
    static String fileName(String original) {
        String name = original == null ? "" : original;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        name = TextNormalizer.normalize(name).replaceAll("[\\p{Cc}<>:\"|?*]", "");
        if (name.isBlank()) {
            name = "tep";
        }
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
