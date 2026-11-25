package com.g123.sfems.domain.school.voucher;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.organization.School;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Phần chung của mọi phiếu thuộc một trường: số phiếu, trạng thái, bước duyệt
 * đang chờ, và vết của vòng duyệt.
 *
 * <p>Mỗi loại phiếu vẫn là MỘT BẢNG RIÊNG với các dòng riêng — phiếu ghi tăng và
 * biên bản kiểm kê không có chung một cột nghiệp vụ nào đáng kể. Cái chúng chung
 * là vòng đời, và vòng đời thì phải giống hệt nhau: một phiếu "chờ duyệt" ở màn
 * này và "đang trình" ở màn kia là hai trạng thái người dùng phải học riêng.
 *
 * <p>Số phiếu {@code null} cho tới khi phiếu được TRÌNH: phiếu nháp chưa là
 * chứng từ của cái gì cả, cấp số cho nó nghĩa là dãy số nhảy cách quãng mỗi lần
 * ai đó mở form rồi bỏ đi.
 */
@MappedSuperclass
public abstract class SchoolVoucher extends BaseEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(length = 32)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VoucherStatus status = VoucherStatus.DRAFT;

    /** Bước đang chờ duyệt. Chỉ có giá trị khi {@link #status} là {@code PENDING}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "approval_step", length = 20)
    private ApprovalStep approvalStep;

    /**
     * Cấp CAO NHẤT phiếu từng đứng chờ duyệt — chỉ tăng, không bao giờ giảm. Khác {@link #approvalStep}: trả
     * lại, từ chối, duyệt xong đều xoá cấp đang chờ, nhưng phiếu đã từng lên tới Sở thì vẫn là đã
     * lên. Phạm vi đọc của Sở dựa vào nó (125): Sở chỉ thấy phiếu đã trình tới bàn mình, không
     * thấy phiếu còn nằm ở bàn hiệu trưởng. Chỉ {@link #setApprovalStep} ghi nó, nên không chỗ nào quên được.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "reached_step", length = 20)
    private ApprovalStep reachedStep;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "submitted_by_id")
    private Long submittedById;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "completed_by_id")
    private Long completedById;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    /** Lời nhắn của lần trả lại gần nhất — để người lập biết phải sửa gì. */
    @Column(name = "return_note", length = 500)
    private String returnNote;

    @Column(length = 500)
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

    /** Tiền tố số phiếu: {@code NK}, {@code CP}, {@code DC}... */
    public abstract String numberPrefix();

    /** Ngày của chứng từ — năm của nó là năm của dãy số phiếu. */
    public abstract LocalDate documentDate();

    /**
     * Các cấp phải duyệt THEO MẶC ĐỊNH, theo thứ tự. Rỗng nghĩa là trình xong là duyệt xong
     * (phiếu không cần ai duyệt vẫn đi qua cùng vòng đời, để có vết).
     *
     * <p>Đây chỉ là mặc định: loại phiếu nào có trong {@link ApprovalFlowType} thì Sở cấu hình lại
     * được, và luồng thật của một phiếu do {@code ApprovalFlowService.chainOf} trả — không gọi thẳng
     * hàm này để quyết định ai duyệt.
     */
    public abstract List<ApprovalStep> approvalChain();

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public VoucherStatus getStatus() {
        return status;
    }

    public void setStatus(VoucherStatus status) {
        this.status = status == null ? VoucherStatus.DRAFT : status;
    }

    public ApprovalStep getApprovalStep() {
        return approvalStep;
    }

    /** Đặt cấp đang chờ duyệt; phiếu tới một cấp cao hơn mọi cấp trước đó thì {@link #reachedStep} nâng theo. */
    public void setApprovalStep(ApprovalStep approvalStep) {
        this.approvalStep = approvalStep;
        this.reachedStep = ApprovalStep.furthest(reachedStep, approvalStep);
    }

    public ApprovalStep getReachedStep() {
        return reachedStep;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Long getSubmittedById() {
        return submittedById;
    }

    public void setSubmittedById(Long submittedById) {
        this.submittedById = submittedById;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Long getCompletedById() {
        return completedById;
    }

    public void setCompletedById(Long completedById) {
        this.completedById = completedById;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public void setRejectReason(String rejectReason) {
        this.rejectReason = rejectReason;
    }

    public String getReturnNote() {
        return returnNote;
    }

    public void setReturnNote(String returnNote) {
        this.returnNote = returnNote;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
