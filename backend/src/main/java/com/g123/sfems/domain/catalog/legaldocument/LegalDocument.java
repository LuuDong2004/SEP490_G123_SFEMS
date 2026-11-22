package com.g123.sfems.domain.catalog.legaldocument;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Văn bản quy định về hoạt động thiết bị, CSVC — thông tư, quyết định, công văn, hướng dẫn. {@code code} là
 * số hiệu ("37/2021/TT-BGDĐT"), {@code name} là trích yếu. Bản PDF là tệp đính kèm ({@code resource = legal_documents}).
 */
@Entity
@Table(name = "legal_documents")
public class LegalDocument extends CatalogEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 20)
    private LegalDocumentType docType;

    @Column(nullable = false, length = 255)
    private String issuer;

    @Column(name = "issued_on", nullable = false)
    private LocalDate issuedOn;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    /** Văn bản mà văn bản này thay thế. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replaces_id")
    private LegalDocument replaces;

    public LegalDocumentType getDocType() {
        return docType;
    }

    public void setDocType(LegalDocumentType docType) {
        this.docType = docType;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public LocalDate getIssuedOn() {
        return issuedOn;
    }

    public void setIssuedOn(LocalDate issuedOn) {
        this.issuedOn = issuedOn;
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public LocalDate getEffectiveTo() {
        return effectiveTo;
    }

    public void setEffectiveTo(LocalDate effectiveTo) {
        this.effectiveTo = effectiveTo;
    }

    public LegalDocument getReplaces() {
        return replaces;
    }

    public void setReplaces(LegalDocument replaces) {
        this.replaces = replaces;
    }

    /** Đang hiệu lực vào ngày {@code day}. */
    public boolean effectiveOn(LocalDate day) {
        return Boolean.TRUE.equals(getActive()) && !effectiveFrom.isAfter(day)
                && (effectiveTo == null || effectiveTo.isAfter(day));
    }
}
