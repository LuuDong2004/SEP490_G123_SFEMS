package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import com.g123.sfems.shared.storage.ObjectStorage;
import java.io.ByteArrayInputStream;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Chuyển nội dung tệp còn nằm trong database ({@code attachments.data}) sang MinIO, mỗi lần
 * khởi động, cho tới khi không còn dòng nào. Mỗi tệp một giao dịch: đẩy đối tượng lên, ghi khoá,
 * đặt {@code data = NULL} — hỏng giữa chừng thì tệp đó vẫn đọc được từ database và lần khởi
 * động sau làm tiếp. MinIO chưa lên thì chỉ ghi cảnh báo, ứng dụng vẫn chạy.
 */
@Component
public class AttachmentStorageMigrator {

    private static final Logger log = LoggerFactory.getLogger(AttachmentStorageMigrator.class);

    private final AttachmentRepository repository;
    private final ObjectStorage storage;
    private final TransactionTemplate tx;

    public AttachmentStorageMigrator(AttachmentRepository repository, ObjectStorage storage,
            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.storage = storage;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void migrate() {
        List<Long> ids = repository.idsNotInObjectStorage();
        if (ids.isEmpty()) {
            return;
        }
        int moved = 0;
        for (Long id : ids) {
            try {
                Boolean ok = tx.execute(status -> moveOne(id));
                if (Boolean.TRUE.equals(ok)) {
                    moved++;
                }
            } catch (ObjectStorage.StorageException e) {
                log.warn("Kho tệp chưa sẵn sàng — còn {} tệp nằm trong database, sẽ chuyển ở lần khởi động sau: {}",
                        ids.size() - moved, e.getMessage());
                return;
            }
        }
        log.info("Đã chuyển {} tệp đính kèm từ database sang kho đối tượng", moved);
    }

    private boolean moveOne(Long id) {
        Attachment a = repository.findById(id).orElse(null);
        if (a == null || a.getStorageKey() != null || a.getData() == null) {
            return false;
        }
        byte[] data = a.getData();
        String key = AttachmentController.objectKey(a.getResource(), a.getRecordId(), a.getFileName());
        storage.putInTransaction(key, new ByteArrayInputStream(data), data.length, a.getContentType());
        a.setStorageKey(key);
        a.setData(null);
        repository.save(a);
        return true;
    }
}
