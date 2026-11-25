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
 * <p>{@link #currentQuantity} và {@link #requiredQuantity} là ẢNH CHỤP lúc lưu
 * đề xuất — số đang dùng được và số định mức yêu cầu — để người duyệt thấy vì
 * sao trường xin mà không phải đi tra sổ của trường.
 */
@Entity
@Table(name = "purchase_proposal_lines")
public class PurchaseProposalLine {

    public enum Kind {
        /** Mua mới, bổ sung cho đủ định mức. */
        NEW,
        /** Thay thế thiết bị hỏng, mất. */
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

    @Column(name = "unit_name", length = 50)
    private String unitName;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "unit_price", precision = 18, scale = 2)
    private BigDecimal unitPrice;

    /**
     * Số ĐƯA VÀO KẾ HOẠCH mua sắm, từ 0 (bỏ dòng) tới {@link #quantity} — Sở bớt khi ngân sách không đủ
     * (126). {@code null}: đề xuất chưa vào kế hoạch nào. Phiếu ghi tăng lập từ đề xuất đọc số này.
     */
    @Column(name = "planned_quantity")
    private Integer plannedQuantity;

    /**
     * Đơn giá do Sở xác định khi lập kế hoạch (270). {@code null}: theo đơn giá trường ghi — trường không bắt buộc
     * ghi giá lúc đề xuất. Xem {@link #effectiveUnitPrice()}.
     */
    @Column(name = "planned_unit_price", precision = 18, scale = 2)
    private BigDecimal plannedUnitPrice;

    @Column(name = "current_quantity")
    private Integer currentQuantity;

    @Column(name = "required_quantity")
    private Integer requiredQuantity;

    @Column(length = 255)
    private String note;

    /** Trường chứng từ, JSON — hình dạng do {@code voucher-forms/*.json} quyết định (dòng đề xuất hiện không có trường nào, 301). */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String details = "{}";

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details == null ? "{}" : details;
    }

    /** Thành tiền theo số trường đề nghị; giá là giá kế hoạch khi Sở đã đặt (trường không bắt buộc ghi giá). */
    public BigDecimal amount() {
        BigDecimal price = effectiveUnitPrice();
        return price == null || quantity == null ? null : price.multiply(BigDecimal.valueOf(quantity));
    }

    /** Số sẽ mua: số đưa vào kế hoạch nếu đã vào kế hoạch, không thì số đề nghị. */
    public int effectiveQuantity() {
        return plannedQuantity != null ? plannedQuantity : quantity == null ? 0 : quantity;
    }

    /** Đơn giá sẽ mua: giá Sở đặt trên kế hoạch nếu có, không thì giá trường ghi (có thể {@code null}). */
    public BigDecimal effectiveUnitPrice() {
        return plannedUnitPrice != null ? plannedUnitPrice : unitPrice;
    }

    /** Thành tiền theo số và giá sẽ mua. */
    public BigDecimal plannedAmount() {
        BigDecimal price = effectiveUnitPrice();
        return price == null ? BigDecimal.ZERO : price.multiply(BigDecimal.valueOf(effectiveQuantity()));
    }

    public BigDecimal getPlannedUnitPrice() {
        return plannedUnitPrice;
    }

    public void setPlannedUnitPrice(BigDecimal plannedUnitPrice) {
        this.plannedUnitPrice = plannedUnitPrice;
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
