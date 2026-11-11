package com.g123.sfems.module.system.attachment;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

/** Thông tin một tệp, KHÔNG kèm nội dung — thứ danh sách tệp trả về. */
public record AttachmentInfo(Long id, String resource, Long recordId, String fileName, String contentType,
        Long sizeBytes, String note, Long createdById, Instant createdAt, boolean cover, String coverCrop) {

    /** Tệp là ảnh — màn hồ sơ thiết bị tách mục Ảnh khỏi mục Tệp đính kèm theo cờ này. */
    @JsonProperty("image")
    public boolean image() {
        return contentType != null && contentType.startsWith("image/");
    }
}
