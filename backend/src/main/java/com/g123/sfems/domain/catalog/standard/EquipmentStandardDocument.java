package com.g123.sfems.domain.catalog.standard;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "equipment_standard_documents")
public class EquipmentStandardDocument extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "standard_id", nullable = false)
    private EquipmentStandard standard;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_role", nullable = false, length = 20)
    private DocumentRole documentRole = DocumentRole.MAIN;

    @Column(name = "document_no", nullable = false, length = 100)
    private String documentNo;

    @Column(name = "document_name", length = 500)
    private String documentName;

    @Column(name = "issuing_authority", length = 255)
    private String issuingAuthority;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(length = 1000)
    private String url;

    @Column(name = "sort_order")
    private Integer sortOrder;

    public EquipmentStandard getStandard() { return standard; }
    public void setStandard(EquipmentStandard standard) { this.standard = standard; }
    public DocumentRole getDocumentRole() { return documentRole; }
    public void setDocumentRole(DocumentRole documentRole) { this.documentRole = documentRole == null ? DocumentRole.MAIN : documentRole; }
    public String getDocumentNo() { return documentNo; }
    public void setDocumentNo(String documentNo) { this.documentNo = documentNo; }
    public String getDocumentName() { return documentName; }
    public void setDocumentName(String documentName) { this.documentName = documentName; }
    public String getIssuingAuthority() { return issuingAuthority; }
    public void setIssuingAuthority(String issuingAuthority) { this.issuingAuthority = issuingAuthority; }
    public LocalDate getIssueDate() { return issueDate; }
    public void setIssueDate(LocalDate issueDate) { this.issueDate = issueDate; }
    public LocalDate getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(LocalDate effectiveDate) { this.effectiveDate = effectiveDate; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
