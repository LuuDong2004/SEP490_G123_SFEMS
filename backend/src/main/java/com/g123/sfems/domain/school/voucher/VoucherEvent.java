package com.g123.sfems.domain.school.voucher;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Một bước trong vòng đời của một phiếu: ai, lúc nào, từ trạng thái nào sang trạng thái nào, nói gì.
 *
 * <p>Một bảng cho MỌI loại phiếu, khoá bằng cặp {@code (resource, voucherId)}. Chỉ thêm, không bao
 * giờ sửa hay xoá — đây là vết, và một vết sửa được thì không còn là vết.
 */
@Entity
@Table(name = "voucher_events")
public class VoucherEvent {

    public enum Action {
        SUBMIT,
        APPROVE,
        RETURN,
        REJECT,
        CANCEL,
        COMPLETE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String resource;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private VoucherStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    private VoucherStatus toStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ApprovalStep step;

    @Column(length = 500)
    private String note;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected VoucherEvent() {
    }

    public VoucherEvent(String resource, Long voucherId, Action action, VoucherStatus fromStatus,
            VoucherStatus toStatus, ApprovalStep step, String note, Long actorId, String actorName) {
        this.resource = resource;
        this.voucherId = voucherId;
        this.action = action;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.step = step;
        this.note = note;
        this.actorId = actorId;
        this.actorName = actorName;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getResource() {
        return resource;
    }

    public Long getVoucherId() {
        return voucherId;
    }

    public Action getAction() {
        return action;
    }

    public VoucherStatus getFromStatus() {
        return fromStatus;
    }

    public VoucherStatus getToStatus() {
        return toStatus;
    }

    public ApprovalStep getStep() {
        return step;
    }

    public String getNote() {
        return note;
    }

    public Long getActorId() {
        return actorId;
    }

    public String getActorName() {
        return actorName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
