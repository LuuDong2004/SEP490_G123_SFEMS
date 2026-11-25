package com.g123.sfems.domain.school.inventory;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Đợt kiểm kê do cơ quan quản lý phát động: Sở cho toàn thành phố, UBND cho các
 * trường trên địa bàn.
 *
 * <p>Đợt không chứa kết quả kiểm kê nào — mỗi trường lập phiếu kiểm kê của mình,
 * gắn vào đợt, và cơ quan phát động xem tiến độ: trường nào đã xong, trường nào
 * chưa. Kiểm kê là việc của trường; cấp trên không ghi kết quả thay trường.
 */
@Entity
@Table(name = "inventory_campaigns")
public class InventoryCampaign extends BaseEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "managing_body_id", nullable = false)
    private DepartmentOfEducation managingBody;

    @Column(nullable = false, length = 255)
    private String title;

    /** Thời điểm chốt số liệu — sổ được đối chiếu tính tới ngày này. */
    @Column(name = "cutoff_date", nullable = false)
    private LocalDate cutoffDate;

    /** Hạn các trường nộp biên bản. */
    @Column(nullable = false)
    private LocalDate deadline;

    @Column(length = 1000)
    private String note;

    @Column(nullable = false)
    private boolean closed;

    public DepartmentOfEducation getManagingBody() {
        return managingBody;
    }

    public void setManagingBody(DepartmentOfEducation managingBody) {
        this.managingBody = managingBody;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public LocalDate getCutoffDate() {
        return cutoffDate;
    }

    public void setCutoffDate(LocalDate cutoffDate) {
        this.cutoffDate = cutoffDate;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public boolean isClosed() {
        return closed;
    }

    public void setClosed(boolean closed) {
        this.closed = closed;
    }
}
