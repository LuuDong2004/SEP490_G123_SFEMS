package com.g123.sfems.domain.school.inventory;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
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

    /** Duyệt đợt (308): chuyên viên lập nháp rồi trình, Lãnh đạo Sở duyệt thì đợt mới tới các trường. */
    public enum Status { DRAFT, PENDING, APPROVED }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.DRAFT;

    /** Lý do trả lại (về nháp) hoặc ý kiến khi duyệt. */
    @Column(name = "approval_note", length = 500)
    private String approvalNote;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by_id")
    private Long approvedById;

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public String getApprovalNote() {
        return approvalNote;
    }

    public void setApprovalNote(String approvalNote) {
        this.approvalNote = approvalNote;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }

    public Long getApprovedById() {
        return approvedById;
    }

    public void setApprovedById(Long approvedById) {
        this.approvedById = approvedById;
    }

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

    /** Số công văn phát động (vd. 1234/SGDĐT-KHTC) — không bắt buộc. */
    @Column(name = "document_no", length = 100)
    private String documentNo;

    @Column(nullable = false)
    private boolean closed;

    /** Năm học của đợt (306) — đợt cũ chưa gán thì trống. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "school_year_id")
    private SchoolYear schoolYear;

    public SchoolYear getSchoolYear() {
        return schoolYear;
    }

    public void setSchoolYear(SchoolYear schoolYear) {
        this.schoolYear = schoolYear;
    }

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

    public String getDocumentNo() {
        return documentNo;
    }

    public void setDocumentNo(String documentNo) {
        this.documentNo = documentNo;
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
