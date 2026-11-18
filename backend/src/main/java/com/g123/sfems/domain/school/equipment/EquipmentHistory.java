package com.g123.sfems.domain.school.equipment;

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
 * Một thay đổi trên một tài sản, kèm phiếu đã làm ra thay đổi đó.
 *
 * <p>Đây là bảng trả lời "cái máy chiếu này đã qua tay ai, ở phòng nào, hỏng
 * mấy lần" mà không phải lục từng loại phiếu. Mọi phiếu khi hoàn tất đều ghi vào
 * đây, và sửa tay trên hồ sơ thiết bị cũng vậy — nên lịch sử không có khoảng
 * trống nào mà không ai giải thích được.
 *
 * <p>Chỉ thêm, không sửa, không xoá (trừ khi chính tài sản bị xoá).
 */
@Entity
@Table(name = "equipment_history")
public class EquipmentHistory {

    /** Loại thay đổi — tên theo nghiệp vụ, để dòng lịch sử đọc được thành câu. */
    public enum Action {
        GHI_TANG,
        CAP_NHAT,
        CAP_PHAT,
        THU_HOI,
        DIEU_CHUYEN,
        MUON,
        TRA,
        BAO_HONG,
        SUA_CHUA,
        BAO_HANH,
        BAO_TRI,
        KIEM_KE,
        CHO_THANH_LY,
        THANH_LY,
        CHO_TIEU_HUY,
        TIEU_HUY,
        MAT,
        KHAU_HAO,
        LUU_KHO,
        XUAT_KHO,
        TIEU_HAO,
        DAT_PHONG
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "equipment_id", nullable = false)
    private Long equipmentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Action action;

    /** Trường dữ liệu đổi (phòng, người giữ, tình trạng...), hoặc {@code null} khi là một sự kiện. */
    @Column(length = 40)
    private String field;

    @Column(name = "from_value", length = 500)
    private String fromValue;

    @Column(name = "to_value", length = 500)
    private String toValue;

    @Column(name = "voucher_resource", length = 60)
    private String voucherResource;

    @Column(name = "voucher_id")
    private Long voucherId;

    @Column(name = "voucher_code", length = 40)
    private String voucherCode;

    @Column(length = 500)
    private String note;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected EquipmentHistory() {
    }

    public EquipmentHistory(Long equipmentId, Action action, String field, String fromValue, String toValue,
            String voucherResource, Long voucherId, String voucherCode, String note, Long actorId,
            String actorName) {
        this.equipmentId = equipmentId;
        this.action = action;
        this.field = field;
        this.fromValue = truncate(fromValue);
        this.toValue = truncate(toValue);
        this.voucherResource = voucherResource;
        this.voucherId = voucherId;
        this.voucherCode = voucherCode;
        this.note = truncate(note);
        this.actorId = actorId;
        this.actorName = actorName;
        this.createdAt = Instant.now();
    }

    private static String truncate(String value) {
        return value == null || value.length() <= 500 ? value : value.substring(0, 497) + "...";
    }

    public Long getId() {
        return id;
    }

    public Long getEquipmentId() {
        return equipmentId;
    }

    public Action getAction() {
        return action;
    }

    public String getField() {
        return field;
    }

    public String getFromValue() {
        return fromValue;
    }

    public String getToValue() {
        return toValue;
    }

    public String getVoucherResource() {
        return voucherResource;
    }

    public Long getVoucherId() {
        return voucherId;
    }

    public String getVoucherCode() {
        return voucherCode;
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
