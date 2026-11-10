package com.g123.sfems.module.system.attachment;

import com.g123.sfems.domain.system.attachment.Attachment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    /** Theo thứ tự đính kèm — tệp cũ đứng trước. */
    List<Attachment> findByResourceAndRecordIdOrderByCreatedAtAscIdAsc(String resource, Long recordId);

    /**
     * Bỏ ảnh đại diện cũ của bản ghi trước khi đặt ảnh mới: chỉ mục duy nhất chỉ cho một ảnh đại diện
     * mỗi bản ghi, nên phải bỏ trước rồi mới đặt.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Attachment a set a.cover = false where a.resource = :resource and a.recordId = :recordId"
            + " and a.cover = true")
    int clearCover(@Param("resource") String resource, @Param("recordId") Long recordId);
}
