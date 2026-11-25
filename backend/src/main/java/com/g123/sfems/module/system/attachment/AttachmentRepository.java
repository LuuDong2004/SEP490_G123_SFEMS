package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Optional;

/** Quyền trên tệp là quyền trên bản ghi gốc — kiểm ở controller qua {@code RecordAccessRegistry}. */
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    @Query("""
            select new com.g123.sfems.module.system.attachment.AttachmentInfo(
                a.id, a.resource, a.recordId, a.fileName, a.contentType, a.sizeBytes, a.note,
                a.createdById, a.createdAt, a.cover, a.coverCrop)
            from Attachment a
            where a.resource = :resource and a.recordId = :recordId
            order by a.createdAt desc, a.id desc""")
    List<AttachmentInfo> listOf(String resource, Long recordId);

    @Query("""
            select new com.g123.sfems.module.system.attachment.AttachmentInfo(
                a.id, a.resource, a.recordId, a.fileName, a.contentType, a.sizeBytes, a.note,
                a.createdById, a.createdAt, a.cover, a.coverCrop)
            from Attachment a
            where a.id = :id""")
    Optional<AttachmentInfo> info(Long id);

    /** Số ẢNH (không tính PDF, tài liệu) đã gắn vào một bản ghi — trần số ảnh khi tải lên. */
    @Query("select count(a) from Attachment a where a.resource = :resource and a.recordId = :recordId "
            + "and a.contentType like 'image/%'")
    long countImages(String resource, Long recordId);

    @Query("select a.storageKey from Attachment a where a.id = :id")
    String storageKeyOf(Long id);

    /** Dòng còn nội dung trong database, chưa chuyển sang kho đối tượng. */
    @Query("select a.id from Attachment a where a.storageKey is null")
    List<Long> idsNotInObjectStorage();

    /** Bỏ dấu đại diện của mọi tệp khác cùng bản ghi — chạy TRƯỚC khi đặt dấu cho tệp mới. */
    @Modifying(flushAutomatically = true)
    @Query("update Attachment a set a.cover = false, a.coverCrop = null "
            + "where a.resource = :resource and a.recordId = :recordId and a.id <> :keepId and a.cover = true")
    int clearCover(String resource, Long recordId, Long keepId);
}
