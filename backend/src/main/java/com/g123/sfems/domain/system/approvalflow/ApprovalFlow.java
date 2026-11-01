package com.g123.sfems.domain.system.approvalflow;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * Luồng phê duyệt quản trị viên cấu hình cho MỘT loại phiếu. Không có dòng = loại phiếu đó chạy luồng
 * mặc định trong code ({@code ApprovalFlowType}).
 *
 * <p>Các bước lưu thành chuỗi mã ngăn bằng dấu phẩy, theo thứ tự cấp ({@code SCHOOL,MANAGING_BODY});
 * chuỗi rỗng là "trình xong là duyệt xong". Ngưỡng tiền là tuỳ chọn: phiếu có số tiền từ
 * {@link #amountThreshold} trở lên đi theo {@link #stepsAbove} thay cho {@link #steps}.
 */
@Entity
@Table(name = "approval_flows")
public class ApprovalFlow extends BaseEntity {

    @Column(nullable = false, length = 60, unique = true)
    private String resource;

    @Column(nullable = false, length = 100)
    private String steps = "";

    @Column(name = "amount_threshold", precision = 18, scale = 2)
    private BigDecimal amountThreshold;

    @Column(name = "steps_above", length = 100)
    private String stepsAbove;

    @Column(length = 500)
    private String note;

    public String getResource() {
        return resource;
    }

    public void setResource(String resource) {
        this.resource = resource;
    }

    public String getSteps() {
        return steps;
    }

    public void setSteps(String steps) {
        this.steps = steps == null ? "" : steps;
    }

    public BigDecimal getAmountThreshold() {
        return amountThreshold;
    }

    public void setAmountThreshold(BigDecimal amountThreshold) {
        this.amountThreshold = amountThreshold;
    }

    public String getStepsAbove() {
        return stepsAbove;
    }

    public void setStepsAbove(String stepsAbove) {
        this.stepsAbove = stepsAbove;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
