package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import com.g123.sfems.shared.data.RecordAccessRegistry;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.storage.ObjectStorage;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Tệp đính kèm của một bản ghi (TS-03). Quyền đọc / ghi theo bản ghi gốc qua {@link RecordAccessRegistry}:
 * ai sửa được thiết bị thì đính kèm được vào thiết bị đó, ai chỉ xem được thì chỉ tải về.
 */
@Service
public class AttachmentService {

    /** Nội dung tệp đang mở để trả về; người gọi phải đóng {@code stream}. */
    public record Content(Attachment attachment, InputStream stream) {
    }

    /** Giá trị {@code purpose} của mục ảnh thiết bị và mục tệp đính kèm. */
    public static final String PURPOSE_PHOTO = "photo";
    public static final String PURPOSE_DOCUMENT = "document";

    private final AttachmentRepository rows;
    private final ObjectStorage storage;
    private final RecordAccessRegistry access;

    public AttachmentService(AttachmentRepository rows, ObjectStorage storage, RecordAccessRegistry access) {
        this.rows = rows;
        this.storage = storage;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<Attachment> list(String resource, Long recordId) {
        access.checkReadable(resource, recordId);
        return rows.findByResourceAndRecordIdOrderByCreatedAtAscIdAsc(resource, recordId);
    }

    @Transactional
    public Attachment upload(String resource, Long recordId, MultipartFile file, String note, String purpose) {
        access.checkWritable(resource, recordId);
        AttachmentPolicy.Kind kind = AttachmentPolicy.check(file);
        // Ảnh thiết bị và tệp đính kèm tách hai mục: mục nào chỉ nhận đúng loại của mục đó.
        if (PURPOSE_PHOTO.equals(purpose) && !kind.image()) {
            throw new FieldValidationException("file", "Mục ảnh thiết bị chỉ nhận tệp ảnh");
        }
        if (PURPOSE_DOCUMENT.equals(purpose) && kind.image()) {
            throw new FieldValidationException("file", "Tệp đính kèm không nhận ảnh; thêm ảnh ở mục Ảnh thiết bị");
        }
        String key = resource + "/" + recordId + "/" + UUID.randomUUID() + "." + kind.extension();
        try (InputStream content = file.getInputStream()) {
            storage.putInTransaction(key, content, file.getSize(), kind.contentType());
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp");
        }
        Attachment row = new Attachment();
        row.setResource(resource);
        row.setRecordId(recordId);
        row.setFileName(AttachmentPolicy.displayName(file.getOriginalFilename()));
        row.setContentType(kind.contentType());
        row.setSizeBytes(file.getSize());
        row.setStorageKey(key);
        row.setNote(note == null || note.isBlank() ? null : note.trim());
        row.setCover(false);
        return rows.save(row);
    }

    /** Mở nội dung để tải hoặc xem; kiểm quyền đọc của bản ghi gốc. */
    @Transactional(readOnly = true)
    public Content open(Long id) {
        Attachment row = find(id);
        access.checkReadable(row.getResource(), row.getRecordId());
        return new Content(row, storage.get(row.getStorageKey()));
    }

    @Transactional
    public void delete(Long id) {
        Attachment row = find(id);
        access.checkWritable(row.getResource(), row.getRecordId());
        rows.delete(row);
        // Xoá đối tượng sau khi dòng được xoá thành công; lỗi xoá đối tượng chỉ ghi log.
        storage.deleteAfterCommit(row.getStorageKey());
    }

    /** Đặt ảnh đại diện của bản ghi; chỉ ảnh mới đặt được, và mỗi bản ghi chỉ có một ảnh đại diện. */
    @Transactional
    public Attachment setCover(Long id) {
        Attachment row = find(id);
        access.checkWritable(row.getResource(), row.getRecordId());
        if (!row.getContentType().startsWith("image/")) {
            throw new FieldValidationException("file", "Chỉ ảnh mới đặt làm ảnh đại diện được");
        }
        rows.clearCover(row.getResource(), row.getRecordId());
        row.setCover(true);
        return rows.save(row);
    }

    private Attachment find(Long id) {
        return rows.findById(id).orElseThrow(() -> new ResourceNotFoundException("attachments", id));
    }
}
