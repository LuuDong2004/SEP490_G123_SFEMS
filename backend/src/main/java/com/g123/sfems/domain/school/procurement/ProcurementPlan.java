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
 * Kế hoạch mua sắm của một cơ quan quản lý cho một năm ngân sách: UBND gom đề
 * xuất đã duyệt của các trường trên địa bàn, Sở gom đề xuất của các trường THPT.
 *
 * <p>Kế hoạch không có dòng của riêng nó — nội dung của nó là các đề xuất được
 * đưa vào, cộng theo nhóm thiết bị. Chuyên viên lập và trình, lãnh đạo cơ quan
 * duyệt; duyệt xong thì mọi đề xuất trong kế hoạch hoàn tất.
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

    /** Mã kế hoạch {@code KHMS-<năm ngân sách>-<số>}, máy cấp lúc lập (126). */
    @Column(nullable = false, length = 30, unique = true)
    private String code;

    /** Ngày lập kế hoạch. */
    @Column(name = "plan_date", nullable = false)
    private LocalDate planDate;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "budget_year", nullable = false)
    private Integer budgetYear;

    /** Năm học của kế hoạch ("2026-2027"); năm ngân sách tính từ nó — năm kết thúc của năm học (126). */
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

    public DepartmentOfEducation getManagingBody() {
        return managingBody;
    }

    public void setManagingBody(DepartmentOfEducation managingBody) {
        this.managingBody = managingBody;
    }

    public SchoolYear getSchoolYear() {
        return schoolYear;
    }

    public void setSchoolYear(SchoolYear schoolYear) {
        this.schoolYear = schoolYear;
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

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
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
