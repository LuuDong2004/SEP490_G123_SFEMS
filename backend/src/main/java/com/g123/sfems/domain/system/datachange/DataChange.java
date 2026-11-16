package com.g123.sfems.domain.system.datachange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.Immutable;

/**
 * Một dòng lịch sử thay đổi dữ liệu: một trường của một bản ghi đổi từ giá trị này sang giá trị kia.
 *
 * <p>Chỉ đọc qua JPA ({@link Immutable}): dòng được GHI bằng JDBC trong lúc Hibernate flush
 * ({@code DataChangeRecorder}), và cơ sở dữ liệu chặn mọi lệnh sửa / xoá trên bảng.
 */
@Entity
@Immutable
@Table(name = "data_changes")
public class DataChange {

    @Id
    private Long id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    @Column(nullable = false, length = 60)
    private String resource;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "record_label", length = 255)
    private String recordLabel;

    @Column(nullable = false, length = 80)
    private String field;

    @Column(name = "old_value", length = 1000)
    private String oldValue;

    @Column(name = "new_value", length = 1000)
    private String newValue;

    protected DataChange() {
        // for JPA
    }

    public Long getId() {
        return id;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getActorId() {
        return actorId;
    }

    public String getActorName() {
        return actorName;
    }

    public String getResource() {
        return resource;
    }

    public Long getRecordId() {
        return recordId;
    }

    public String getRecordLabel() {
        return recordLabel;
    }

    public String getField() {
        return field;
    }

    public String getOldValue() {
        return oldValue;
    }

    public String getNewValue() {
        return newValue;
    }
}
