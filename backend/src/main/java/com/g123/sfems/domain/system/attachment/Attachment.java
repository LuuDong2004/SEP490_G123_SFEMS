package com.g123.sfems.domain.system.attachment;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Tệp đính kèm (TS-03): một tệp gắn vào một bản ghi — ảnh thiết bị, hoá đơn của phiếu nhập, biên bản
 * kiểm kê đã ký.
 *
 * <p>Gắn bằng cặp {@code (resource, recordId)}, không bằng khoá ngoại: cùng một bảng phục vụ mọi loại
 * phiếu và cả hồ sơ thiết bị. Ai đọc, ai sửa được tệp do chính bản ghi gốc quyết định
 * ({@code RecordAccess}), không phải bảng này.
 *
 * <p>Nội dung tệp nằm trong MinIO ({@link #storageKey}); database chỉ giữ tên, loại, dung lượng.
 */
@Entity
@Table(name = "attachments")
public class Attachment extends BaseEntity {

    @Column(nullable = false, length = 60)
    private String resource;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    /** Khoá đối tượng trong bucket tệp đính kèm. */
    @Column(name = "storage_key", nullable = false, length = 300)
    private String storageKey;

    @Column(length = 255)
    private String note;

    /** Ảnh đại diện của bản ghi — mỗi bản ghi tối đa một (chỉ mục duy nhất có điều kiện). */
    @Column(name = "is_cover", nullable = false)
    private boolean cover;

    public String getResource() {
        return resource;
    }

    public void setResource(String resource) {
        this.resource = resource;
    }

    public Long getRecordId() {
        return recordId;
    }

    public void setRecordId(Long recordId) {
        this.recordId = recordId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public void setStorageKey(String storageKey) {
        this.storageKey = storageKey;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public boolean isCover() {
        return cover;
    }

    public void setCover(boolean cover) {
        this.cover = cover;
    }
}
