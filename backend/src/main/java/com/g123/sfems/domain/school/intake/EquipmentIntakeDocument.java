package com.g123.sfems.domain.school.intake;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.FundingSource;
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
 * Một HOÁ ĐƠN (chứng từ) của phiếu ghi tăng (254): nhà cung cấp, mã số thuế, số, ngày, nguồn kinh phí, hình thức mua
 * sắm. Thiết bị của phiếu nằm dưới hoá đơn của nó ({@link EquipmentIntakeLine#getDocument()}); tệp hoá đơn gắn vào đây
 * ({@code attachments.resource = equipment_intake_documents}).
 *
 * <p>Giá trị của hoá đơn được CHÉP xuống các dòng của nó mỗi lần lưu — sinh tài sản, báo cáo đọc dòng
 * ({@code EquipmentIntakeLine.effective*}) như trước.
 */
@Entity
@Table(name = "equipment_intake_documents")
public class EquipmentIntakeDocument extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intake_id", nullable = false)
    private EquipmentIntake intake;

    /** Thứ tự hoá đơn trong phiếu, từ 1. */
    @Column(name = "doc_no", nullable = false)
    private Integer docNo;

    @Column(length = 255)
    private String supplier;

    /** Mã số thuế của nhà cung cấp — 10 hoặc 13 số (chi nhánh: 10 số, gạch, 3 số). */
    @Column(name = "tax_code", length = 20)
    private String taxCode;

    /** Liên hệ của nhà cung cấp — số điện thoại HOẶC email, để liên hệ khi hàng có vấn đề (256, 257). */
    @Column(length = 254)
    private String contact;

    @Column(name = "document_no", length = 100)
    private String documentNo;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", length = 30)
    private FundingSource fundingSource;

    @Column(name = "funding_note", length = 255)
    private String fundingNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    @Column(name = "acquisition_note", length = 255)
    private String acquisitionNote;

    public EquipmentIntake getIntake() {
        return intake;
    }

    public void setIntake(EquipmentIntake intake) {
        this.intake = intake;
    }

    public Integer getDocNo() {
        return docNo;
    }

    public void setDocNo(Integer docNo) {
        this.docNo = docNo;
    }

    public String getSupplier() {
        return supplier;
    }

    public void setSupplier(String supplier) {
        this.supplier = supplier;
    }

    public String getTaxCode() {
        return taxCode;
    }

    public void setTaxCode(String taxCode) {
        this.taxCode = taxCode;
    }

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getDocumentNo() {
        return documentNo;
    }

    public void setDocumentNo(String documentNo) {
        this.documentNo = documentNo;
    }

    public LocalDate getDocumentDate() {
        return documentDate;
    }

    public void setDocumentDate(LocalDate documentDate) {
        this.documentDate = documentDate;
    }

    public FundingSource getFundingSource() {
        return fundingSource;
    }

    public void setFundingSource(FundingSource fundingSource) {
        this.fundingSource = fundingSource;
    }

    public String getFundingNote() {
        return fundingNote;
    }

    public void setFundingNote(String fundingNote) {
        this.fundingNote = fundingNote;
    }

    public AcquisitionMethod getAcquisitionMethod() {
        return acquisitionMethod;
    }

    public void setAcquisitionMethod(AcquisitionMethod acquisitionMethod) {
        this.acquisitionMethod = acquisitionMethod;
    }

    public String getAcquisitionNote() {
        return acquisitionNote;
    }

    public void setAcquisitionNote(String acquisitionNote) {
        this.acquisitionNote = acquisitionNote;
    }
}
