package com.g123.sfems.domain.school.procurement;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
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
 * Kế hoạch mua sắm của Sở cho một năm ngân sách (NC-05..NC-07): gom các đề xuất đã duyệt của các
 * trường. Kế hoạch không có dòng riêng — nội dung của nó là các đề xuất được đưa vào
 * ({@link PurchaseProposal#getPlan()}), cộng theo nhóm thiết bị. Chuyên viên Sở lập và trình, lãnh đạo
 * Sở duyệt; duyệt xong thì mọi đề xuất trong kế hoạch hoàn tất.
 *
 * <p>Không phải {@code SchoolVoucher}: nó thuộc Sở, không thuộc trường, và chỉ có một bước duyệt.
 */
@Entity
@Table(name = "procurement_plans")
public class ProcurementPlan extends BaseEntity {

    public enum Status {
        DRAFT,
        PENDING,
        APPROVED
    }

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "managing_body_id", nullable = false)
    private DepartmentOfEducation managingBody;

    /** Mã kế hoạch {@code KHMS-<năm ngân sách>-<số>}, máy cấp lúc lập. */
    @Column(nullable = false, length = 30, unique = true)
    private String code;

    @Column(name = "plan_date", nullable = false)
    private LocalDate planDate;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "budget_year", nullable = false)
    private Integer budgetYear;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "school_year_id")
    private SchoolYear schoolYear;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.DRAFT;

    @Column(length = 1000)
    private String note;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by_id")
    private Long approvedById;

    /** Lời duyệt, hoặc lời nhắn của lần trả lại gần nhất. */
    @Column(name = "approval_note", length = 500)
    private String approvalNote;

    public DepartmentOfEducation getManagingBody() {
        return managingBody;
    }

    public void setManagingBody(DepartmentOfEducation managingBody) {
        this.managingBody = managingBody;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public LocalDate getPlanDate() {
        return planDate;
    }

    public void setPlanDate(LocalDate planDate) {
        this.planDate = planDate;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Integer getBudgetYear() {
        return budgetYear;
    }

    public void setBudgetYear(Integer budgetYear) {
        this.budgetYear = budgetYear;
    }

    public SchoolYear getSchoolYear() {
        return schoolYear;
    }

    public void setSchoolYear(SchoolYear schoolYear) {
        this.schoolYear = schoolYear;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status == null ? Status.DRAFT : status;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
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

    public String getApprovalNote() {
        return approvalNote;
    }

    public void setApprovalNote(String approvalNote) {
        this.approvalNote = approvalNote;
    }
}
