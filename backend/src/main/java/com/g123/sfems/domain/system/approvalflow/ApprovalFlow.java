package com.g123.sfems.domain.system.approvalflow;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Luồng phê duyệt Sở cấu hình cho MỘT loại phiếu. Không có dòng = loại phiếu đó chạy luồng mặc định trong
 * code ({@code ApprovalFlowType}).
 *
 * <p>Các bước lưu thành chuỗi mã ngăn bằng dấu phẩy, theo thứ tự cấp ({@code SCHOOL,MANAGING_BODY}); chuỗi
 * rỗng là "trình xong là duyệt xong".
 */
@Entity
@Table(name = "approval_flows")
public class ApprovalFlow extends BaseEntity {

    @Column(nullable = false, length = 60, unique = true)
    private String resource;

    @Column(nullable = false, length = 100)
    private String steps = "";

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

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
