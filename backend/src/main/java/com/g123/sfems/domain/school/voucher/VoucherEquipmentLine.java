package com.g123.sfems.domain.school.voucher;

import com.g123.sfems.domain.school.equipment.Equipment;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;

/**
 * Một dòng phiếu trỏ tới MỘT tài sản cụ thể — cấp phát, điều chuyển, mượn, báo
 * hỏng, thanh lý đều làm việc trên từng cái chứ không trên "loại × số lượng" như
 * phiếu nhập.
 *
 * <p>Tài sản được nạp EAGER cùng dòng, và đây là điều có chủ đích: khi trường NHẬN
 * xác nhận một phiếu điều chuyển, họ không đọc được tài sản của trường chuyển qua
 * phạm vi dữ liệu của mình — nhưng họ đọc được phiếu, và phiếu mang theo đúng những
 * tài sản nó nói tới. Đi qua dòng phiếu là cách duy nhất một phiếu được chạm vào
 * tài sản mà người thao tác không tự đọc được.
 */
@MappedSuperclass
public abstract class VoucherEquipmentLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "equipment_id", nullable = false)
    private Equipment equipment;

    @Column(length = 255)
    private String note;

    /** Trường chứng từ theo app Jmix cũ, JSON — hình dạng do {@code voucher-forms/*.json} quyết định. */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String details = "{}";

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details == null ? "{}" : details;
    }

    public Long getId() {
        return id;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
    }

    public Equipment getEquipment() {
        return equipment;
    }

    public void setEquipment(Equipment equipment) {
        this.equipment = equipment;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
