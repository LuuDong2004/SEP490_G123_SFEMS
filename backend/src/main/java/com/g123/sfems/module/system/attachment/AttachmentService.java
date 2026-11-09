package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import com.g123.sfems.shared.data.RecordAccessRegistry;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.storage.ObjectStorage;
import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/**
 * Tệp gắn vào phiếu và hồ sơ (TS-03).
 *
 * <p>Không có mã quyền {@code attachments:*}. Đọc tệp của một bản ghi cần quyền ĐỌC bản ghi đó, thêm / xoá
 * / đặt ảnh đại diện cần quyền GHI bản ghi đó — cả mã quyền lẫn phạm vi dữ liệu, hỏi qua
 * {@link RecordAccessRegistry}. Mỗi feature muốn nhận tệp khai một bean {@code RecordAccess}; resource không
 * có bean nào thì bị từ chối như không tồn tại. Một mã quyền riêng cho tệp sẽ mở ra đúng cái lỗ ấy: người
 * không được xem phiếu vẫn tải được hoá đơn của phiếu.
 *
 * <p>Nội dung tệp nằm trong MinIO ({@link ObjectStorage}), dòng chỉ giữ khoá đối tượng.
 */
@Service
public class AttachmentService {

    /** 10 MB — đủ cho một bản scan nhiều trang. Giới hạn multipart của Spring (12 MB) chặn phía trên. */
    static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final int NOTE_MAX = 255;
    private static final Pattern CONTROL = Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]");
    private static final Pattern CROP = Pattern.compile("\\d{1,3}(\\.\\d+)?,\\d{1,3}(\\.\\d+)?,\\d(\\.\\d+)?");

    private final AttachmentRepository repository;
    private final RecordAccessRegistry records;
    private final ObjectStorage storage;
    private final TransactionTemplate tx;
    private final TransactionTemplate readTx;

    public AttachmentService(AttachmentRepository repository, RecordAccessRegistry records, ObjectStorage storage,
            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.records = records;
        this.storage = storage;
        this.tx = new TransactionTemplate(transactionManager);
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
    }

    /** Một tệp đem tải về: thông tin để dựng header và luồng nội dung (người nhận phải đóng). */
    public record Content(String fileName, String contentType, long sizeBytes, InputStream stream) {
    }

    @Transactional(readOnly = true)
    public List<AttachmentInfo> list(String resource, Long recordId) {
        records.checkReadable(resource, recordId);
        return repository.listOf(resource, recordId);
    }

    /**
     * Tải một tệp lên. KHÔNG chạy trong một giao dịch bao trùm: đẩy tới 10 MB lên MinIO trong lúc giữ một kết
     * nối CSDL là để vài chục người cùng chụp ảnh tài sản chiếm hết pool. Thứ tự vẫn như {@link ObjectStorage}
     * mô tả — đối tượng TRƯỚC, dòng SAU — chỉ là ba bước tách rời: kiểm quyền (giao dịch đọc ngắn), đẩy đối
     * tượng (không giữ kết nối), rồi một giao dịch ngắn kiểm quyền lần nữa và lưu dòng. Bước cuối hỏng thì gỡ
     * đối tượng vừa đẩy — bù trừ thay cho lùi giao dịch.
     */
    public AttachmentInfo upload(String resource, Long recordId, MultipartFile file, String note) throws IOException {
        // Kiểm trước khi đẩy: người không có quyền không đẩy được byte nào lên kho.
        readTx.executeWithoutResult(status -> records.checkWritable(resource, recordId));
        if (file == null || file.isEmpty()) {
            throw new FieldValidationException("file", "Tệp rỗng");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new FieldValidationException("file", "Tệp tối đa 10 MB");
        }
        String name = fileName(file.getOriginalFilename());
        String extension = extension(name);
        String contentType = FileSignature.CONTENT_TYPES.get(extension);
        if (contentType == null) {
            throw new FieldValidationException("file", "Chỉ nhận PDF, ảnh, tài liệu văn phòng, CSV hoặc ZIP");
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
        String cleanNote = note(note);

        Attachment attachment = new Attachment();
        attachment.setResource(resource);
        attachment.setRecordId(recordId);
        attachment.setFileName(name);
        // Content-Type suy từ đuôi đã kiểm, KHÔNG nhận của trình duyệt — nếu không, một tệp tự khai
        // "text/html" sẽ được trả về đúng như vậy lúc tải xuống.
        attachment.setContentType(contentType);
        attachment.setSizeBytes(file.getSize());
        attachment.setNote(cleanNote);
        String key = objectKey(resource, recordId, name);
        try (InputStream in = file.getInputStream()) {
            storage.put(key, in, file.getSize(), contentType);
        }
        attachment.setStorageKey(key);
        try {
            return tx.execute(status -> {
                // Lần nữa, trong giao dịch ghi: quyền hoặc trạng thái phiếu có thể đã đổi lúc tệp đang truyền.
                records.checkWritable(resource, recordId);
                Attachment saved = repository.saveAndFlush(attachment);
                return repository.info(saved.getId()).orElseThrow();
            });
        } catch (RuntimeException | Error e) {
            // Dòng không lưu được: gỡ đối tượng (ở đây không còn giao dịch nên xoá ngay), nếu không nó mồ côi.
            storage.deleteAfterCommit(key);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public Content content(Long id) {
        Attachment attachment = find(id);
        records.checkReadable(attachment.getResource(), attachment.getRecordId());
        return new Content(attachment.getFileName(), attachment.getContentType(), attachment.getSizeBytes(),
                storage.get(attachment.getStorageKey()));
    }

    /**
     * Đặt một ẢNH làm ảnh đại diện của bản ghi, kèm cách đóng khung vuông ("x,y,zoom"). Ảnh đại diện cũ
     * (nếu có) bị bỏ dấu trong cùng giao dịch. Quyền là quyền ghi trên bản ghi gốc.
     */
    @Transactional
    public AttachmentInfo cover(Long id, String crop) {
        Attachment attachment = find(id);
        records.checkWritable(attachment.getResource(), attachment.getRecordId());
        if (attachment.getContentType() == null || !attachment.getContentType().startsWith("image/")) {
            throw new FieldValidationException("file", "Chỉ ảnh mới đặt làm ảnh đại diện được");
        }
        if (crop != null && !CROP.matcher(crop).matches()) {
            throw new FieldValidationException("crop", "Vùng cắt không hợp lệ");
        }
        repository.clearCover(attachment.getResource(), attachment.getRecordId(), id);
        attachment.setCover(true);
        attachment.setCoverCrop(crop);
        repository.saveAndFlush(attachment);
        return repository.info(id).orElseThrow();
    }

    /** Trả lại thông tin tệp vừa xoá — data provider có phân tích body trả về. */
    @Transactional
    public AttachmentInfo delete(Long id) {
        Attachment attachment = find(id);
        records.checkWritable(attachment.getResource(), attachment.getRecordId());
        AttachmentInfo info = repository.info(id).orElseThrow();
        String key = attachment.getStorageKey();
        repository.delete(attachment);
        // Xoá đối tượng SAU khi dòng đã chắc chắn mất; lùi lại thì tệp còn nguyên.
        storage.deleteAfterCommit(key);
        return info;
    }

    private Attachment find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Attachment", id));
    }

    private static String note(String raw) {
        if (raw == null) {
            return null;
        }
        String note = Normalizer.normalize(raw, Normalizer.Form.NFC).strip();
        if (note.isEmpty()) {
            return null;
        }
        if (CONTROL.matcher(note).find()) {
            throw new FieldValidationException("note", "Ghi chú không được chứa ký tự điều khiển");
        }
        if (note.length() > NOTE_MAX) {
            throw new FieldValidationException("note", "Ghi chú tối đa " + NOTE_MAX + " ký tự");
        }
        return note;
    }

    /** {@code equipment_intakes/60/3f2a….pdf}: gom theo bản ghi, tên ngẫu nhiên nên không đè nhau. */
    static String objectKey(String resource, Long recordId, String fileName) {
        String ext = extension(fileName);
        return resource + "/" + recordId + "/" + UUID.randomUUID() + (ext.isEmpty() ? "" : "." + ext);
    }

    /**
     * Tên tệp đem lưu: chỉ phần tên (trình duyệt cũ gửi cả đường dẫn), chuẩn hoá Unicode, bỏ ký tự điều khiển
     * và ký tự không hợp lệ trong tên tệp; quá 255 ký tự thì giữ phần cuối (còn đuôi).
     */
    static String fileName(String original) {
        String name = original == null ? "" : original;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        name = Normalizer.normalize(name, Normalizer.Form.NFC).strip().replaceAll("[\\p{Cc}<>:\"|?*]", "");
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
