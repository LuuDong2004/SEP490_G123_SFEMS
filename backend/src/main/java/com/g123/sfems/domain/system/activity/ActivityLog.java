package com.g123.sfems.domain.system.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Một thao tác làm thay đổi dữ liệu, hoặc một lần xuất dữ liệu (HSMT 3.9.6).
 *
 * <p>Chỉ đọc qua JPA: dòng được GHI bằng một lệnh {@code INSERT} trần ở tầng web
 * ({@code ActivityLogInterceptor}), sau khi response đã xong, để việc ghi nhật ký
 * không bao giờ làm hỏng hay chậm chính thao tác được ghi.
 */
@Entity
@Table(name = "activity_logs")
public class ActivityLog {

    @Id
    private Long id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 500)
    private String path;

    @Column(length = 60)
    private String resource;

    @Column(name = "record_id")
    private Long recordId;

    @Column(nullable = false, length = 40)
    private String action;

    @Column(name = "status_code", nullable = false)
    private Integer statusCode;

    @Column(length = 64)
    private String ip;

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

    public String getMethod() {
        return method;
    }

    public String getPath() {
        return path;
    }

    public String getResource() {
        return resource;
    }

    public Long getRecordId() {
        return recordId;
    }

    public String getAction() {
        return action;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public String getIp() {
        return ip;
    }
}
