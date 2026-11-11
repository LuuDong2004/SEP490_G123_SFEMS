package com.g123.sfems.domain.school.facility;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.time.Instant;

/**
 * Trạng thái xác nhận hiện trạng CSVC của một phòng / khối nhà (202, QLTB-639): cán bộ khai → {@link #PENDING}; lãnh
 * đạo xác nhận → {@link #CONFIRMED} (chính thức) hoặc trả lại → {@link #RETURNED} kèm lý do.
 */
@Embeddable
public class ConfirmState {

    public static final String PENDING = "PENDING";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String RETURNED = "RETURNED";

    @Column(name = "confirm_status", length = 20, nullable = false)
    private String status = CONFIRMED;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "confirmed_by_id")
    private Long confirmedById;

    @Column(name = "return_reason", length = 500)
    private String returnReason;

    /** Cán bộ vừa khai / sửa: chờ lãnh đạo xác nhận. */
    public void pending() {
        status = PENDING;
        returnReason = null;
    }

    /** Lãnh đạo xác nhận (hoặc tự khai): thành hồ sơ chính thức. */
    public void confirm(Long userId) {
        status = CONFIRMED;
        confirmedAt = Instant.now();
        confirmedById = userId;
        returnReason = null;
    }

    /** Lãnh đạo trả lại, cán bộ sửa rồi khai lại. */
    public void returnWith(String reason, Long userId) {
        status = RETURNED;
        confirmedAt = Instant.now();
        confirmedById = userId;
        returnReason = reason;
    }

    public String getStatus() {
        return status;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }

    public Long getConfirmedById() {
        return confirmedById;
    }

    public String getReturnReason() {
        return returnReason;
    }
}
