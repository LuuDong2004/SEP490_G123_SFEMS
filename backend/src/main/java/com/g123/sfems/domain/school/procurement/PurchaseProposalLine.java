package com.g123.sfems.domain.school.procurement;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * Một dòng đề xuất: nhóm thiết bị, số lượng, đơn giá dự kiến.
 *
 * <p>{@link #currentQuantity} và {@link #requiredQuantity} là ẢNH CHỤP lúc lưu — số đang dùng được và
 * số định mức yêu cầu (NC-01 so với DM-03) — để người duyệt thấy vì sao trường xin mà không phải tra sổ.
 */
@Entity
@Table(name = "purchase_proposal_lines")
public class PurchaseProposalLine {

    public enum Kind {
        /** Mua mới, bổ sung cho đủ định mức. */
        NEW,
        /** Thay thế thiết bị hỏng, đã thanh lý. */
        REPLACE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "proposal_id", nullable = false)
    private PurchaseProposal proposal;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind = Kind.NEW;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "catalog_id", nullable = false)
    private EquipmentCatalog catalog;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 1000)
    private String specification;

    @Column(name = "unit_name", length = 50)
    private String unitName;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "unit_price", precision = 18, scale = 2)
    private BigDecimal unitPrice;

    /** 1 = cấp thiết, 2 = cần, 3 = nên có. */
    @Column(nullable = false)
    private Integer priority = 2;

    /**
     * Số ĐƯA VÀO KẾ HOẠCH, từ 0 (bỏ dòng) tới {@link #quantity} — Sở bớt khi ngân sách không đủ (NC-06).
     * {@code null}: chưa vào kế hoạch nào. Phiếu nhập lập từ đề xuất đọc số này.
     */
    @Column(name = "planned_quantity")
    private Integer plannedQuantity;

    @Column(name = "current_quantity")
    private Integer currentQuantity;

    @Column(name = "required_quantity")
    private Integer requiredQuantity;

    @Column(length = 255)
    private String note;

    public BigDecimal amount() {
        return unitPrice == null || quantity == null ? null : unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    /** Số sẽ mua: số đưa vào kế hoạch nếu đã vào kế hoạch, không thì số đề nghị. */
    public int effectiveQuantity() {
        return plannedQuantity != null ? plannedQuantity : quantity == null ? 0 : quantity;
    }

    public Long getId() {
        return id;
    }

    public PurchaseProposal getProposal() {
        return proposal;
    }

    public void setProposal(PurchaseProposal proposal) {
        this.proposal = proposal;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
    }

    public Kind getKind() {
        return kind;
    }

    public void setKind(Kind kind) {
        this.kind = kind == null ? Kind.NEW : kind;
    }

    public EquipmentCatalog getCatalog() {
        return catalog;
    }

    public void setCatalog(EquipmentCatalog catalog) {
        this.catalog = catalog;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSpecification() {
        return specification;
    }

    public void setSpecification(String specification) {
        this.specification = specification;
    }

    public String getUnitName() {
        return unitName;
    }

    public void setUnitName(String unitName) {
        this.unitName = unitName;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority == null ? 2 : priority;
    }

    public Integer getPlannedQuantity() {
        return plannedQuantity;
    }

    public void setPlannedQuantity(Integer plannedQuantity) {
        this.plannedQuantity = plannedQuantity;
    }

    public Integer getCurrentQuantity() {
        return currentQuantity;
    }

    public void setCurrentQuantity(Integer currentQuantity) {
        this.currentQuantity = currentQuantity;
    }

    public Integer getRequiredQuantity() {
        return requiredQuantity;
    }

    public void setRequiredQuantity(Integer requiredQuantity) {
        this.requiredQuantity = requiredQuantity;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
