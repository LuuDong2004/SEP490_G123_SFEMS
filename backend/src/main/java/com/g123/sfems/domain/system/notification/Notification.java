package com.g123.sfems.domain.system.notification;

import com.g123.sfems.domain.security.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Thông báo (HT-06): một điều ứng dụng muốn MỘT người biết — phiếu bị trả lại, đợt kiểm kê sắp hết hạn.
 *
 * <p>Gửi cho đúng một tài khoản. Thông báo cho một nhóm là chừng ấy dòng, cố ý: trạng thái đã đọc là
 * của từng người. Dòng là bản ghi; WebSocket chỉ là cách giao. Ai đang offline thì thấy nó ở lần đăng
 * nhập sau.
 */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationLevel level = NotificationLevel.INFO;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 2000)
    private String body;

    /** Đường dẫn frontend để mở, hoặc {@code null} khi không có gì để mở. */
    @Column(length = 500)
    private String link;

    /** {@code null} tới khi đọc — một cột trả lời cả "đã đọc chưa" và "lúc nào". */
    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Notification() {
        // JPA
    }

    public Notification(User recipient, NotificationLevel level, String title, String body, String link) {
        this.recipient = recipient;
        this.level = level == null ? NotificationLevel.INFO : level;
        this.title = title;
        this.body = body;
        this.link = link;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public boolean isRead() {
        return readAt != null;
    }

    /** Đánh dấu đã đọc, một lần: đọc lại không dời mốc thời gian. */
    public void markRead(Instant when) {
        if (readAt == null) {
            readAt = when;
        }
    }

    public Long getId() {
        return id;
    }

    public User getRecipient() {
        return recipient;
    }

    public NotificationLevel getLevel() {
        return level;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getLink() {
        return link;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Notification notification)) {
            return false;
        }
        return id != null && id.equals(notification.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
