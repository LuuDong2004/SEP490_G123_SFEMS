package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/** Quyền trên tệp là quyền trên bản ghi gốc — kiểm ở {@link AttachmentService} qua {@code RecordAccessRegistry}. */
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

    /** Bỏ dấu đại diện của mọi tệp khác cùng bản ghi — chạy TRƯỚC khi đặt dấu cho tệp mới. */
    @Modifying(flushAutomatically = true)
    @Query("update Attachment a set a.cover = false, a.coverCrop = null "
            + "where a.resource = :resource and a.recordId = :recordId and a.id <> :keepId and a.cover = true")
    int clearCover(String resource, Long recordId, Long keepId);
}
