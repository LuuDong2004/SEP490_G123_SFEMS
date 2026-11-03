package com.g123.sfems.domain.school.procurement;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.hibernate.annotations.BatchSize;

/**
 * Đề xuất mua sắm của một trường (NC-01..NC-04).
 *
 * <p>Hai bước duyệt: lãnh đạo trường, rồi Sở ({@code ApprovalFlowType.PURCHASE_PROPOSALS}). Duyệt xong
 * đề xuất CHƯA có tiền — nó chờ được đưa vào kế hoạch mua sắm của Sở ({@link ProcurementPlan}). Kế hoạch
 * được duyệt thì đề xuất hoàn tất, và từ đó trường lập phiếu nhập khi hàng về.
 */
@RowLevelResource("purchase_proposals")
@Entity
@Table(name = "purchase_proposals")
public class PurchaseProposal extends SchoolVoucher {

    @Column(name = "proposal_date", nullable = false)
    private LocalDate proposalDate;

    @Column(name = "budget_year")
    private Integer budgetYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", length = 30)
    private FundingSource fundingSource;

    @Column(length = 1000)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id")
    private ProcurementPlan plan;

    /** Phiếu nhập lập từ đề xuất này khi hàng về. */
    @Column(name = "intake_id")
    private Long intakeId;

    @OneToMany(mappedBy = "proposal", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    @BatchSize(size = 50)
    private List<PurchaseProposalLine> lines = new ArrayList<>();

    @Override
    public String resource() {
        return "purchase_proposals";
    }

    @Override
    public String numberPrefix() {
        return "MS";
    }

    @Override
    public LocalDate documentDate() {
        return proposalDate;
    }

    @Override
    public BigDecimal approvalAmount() {
        return totalAmount();
    }

    public BigDecimal totalAmount() {
        return lines.stream().map(PurchaseProposalLine::amount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public LocalDate getProposalDate() {
        return proposalDate;
    }

    public void setProposalDate(LocalDate proposalDate) {
        this.proposalDate = proposalDate;
    }

    public Integer getBudgetYear() {
        return budgetYear;
    }

    public void setBudgetYear(Integer budgetYear) {
        this.budgetYear = budgetYear;
    }

    public FundingSource getFundingSource() {
        return fundingSource;
    }

    public void setFundingSource(FundingSource fundingSource) {
        this.fundingSource = fundingSource;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public ProcurementPlan getPlan() {
        return plan;
    }

    public void setPlan(ProcurementPlan plan) {
        this.plan = plan;
    }

    public Long getIntakeId() {
        return intakeId;
    }

    public void setIntakeId(Long intakeId) {
        this.intakeId = intakeId;
    }

    public List<PurchaseProposalLine> getLines() {
        return lines;
    }

    public void replaceLines(List<PurchaseProposalLine> replacement) {
        lines.clear();
        if (replacement != null) {
            for (PurchaseProposalLine line : replacement) {
                line.setProposal(this);
                lines.add(line);
            }
        }
    }
}
