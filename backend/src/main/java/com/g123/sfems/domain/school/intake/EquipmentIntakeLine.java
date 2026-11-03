package com.g123.sfems.domain.school.intake;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.facility.Room;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Một dòng của phiếu nhập: một LOẠI thiết bị và số lượng của nó.
 *
 * <p>Hai cột số lượng: {@link #documentQuantity} là con số trên hoá đơn, {@link #receivedQuantity} là
 * con số đếm được lúc mở thùng, và ghi tăng đi theo cái thứ hai. Lệch nhau thì {@link #varianceReason}
 * bắt buộc (CHECK ở database).
 *
 * <p>Nhà cung cấp, chứng từ, nguồn kinh phí, hình thức mua sắm, bảo hành nằm trên ĐẦU PHIẾU làm mặc
 * định; dòng khai riêng khi khác đi. Các {@code effective*} là giá trị thật của dòng và là thứ duy nhất
 * nên đọc khi sinh tài sản.
 */
@Entity
@Table(name = "equipment_intake_lines")
public class EquipmentIntakeLine extends BaseEntity {

    /**
     * Phiếu chứa dòng này. EAGER vì hồ sơ tài sản đọc "sinh ra từ phiếu NK-2026-00001" sau khi giao dịch
     * đã đóng. Không thành vòng với {@code EquipmentIntake.lines} vì phía kia LAZY.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "intake_id", nullable = false)
    private EquipmentIntake intake;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "catalog_id", nullable = false)
    private EquipmentCatalog catalog;

    /** Tên ghi trên chứng từ. Bỏ trống thì lấy tên nhóm thiết bị. */
    @Column(nullable = false, length = 255)
    private String name;

    /** Quyết định nhóm LT của mã tài sản (TB/PM/HL) khi ghi tăng. */
    @Enumerated(EnumType.STRING)
    @Column(name = "physical_or_digital", nullable = false, length = 20)
    private PhysicalDigitalType physicalOrDigital = PhysicalDigitalType.PHYSICAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_category", length = 30)
    private AssetCategory assetCategory;

    @Column(name = "document_quantity", nullable = false)
    private Integer documentQuantity = 1;

    @Column(name = "received_quantity", nullable = false)
    private Integer receivedQuantity = 1;

    @Column(name = "variance_reason", length = 255)
    private String varianceReason;

    /** Nguyên giá MỖI CÁI, không phải thành tiền của dòng. */
    @Column(name = "unit_price", precision = 18, scale = 2)
    private BigDecimal unitPrice;

    /** Vị trí nhận. {@code null} = kho (chưa giao về phòng nào). */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "room_id")
    private Room room;

    /** Số tài sản đã sinh khi hoàn tất. Kết quả của ghi tăng, không phải thứ người dùng nhập. */
    @Column(name = "generated_count", nullable = false)
    private Integer generatedCount = 0;

    @Column(length = 255)
    private String supplier;

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
    @Fetch(FetchMode.JOIN)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    @Column(name = "acquisition_note", length = 255)
    private String acquisitionNote;

    @Column(name = "warranty_months")
    private Integer warrantyMonths;

    /** Model và hãng của LÔ hàng này — khác nhau giữa các lần mua của cùng một nhóm. Chép xuống tài sản. */
    @Column(length = 255)
    private String model;

    @Column(length = 255)
    private String manufacturer;

    @Column(length = 255)
    private String note;

    public String effectiveSupplier() {
        return supplier != null ? supplier : intake.getSupplier();
    }

    public String effectiveDocumentNo() {
        return documentNo != null ? documentNo : intake.getDocumentNo();
    }

    public LocalDate effectiveDocumentDate() {
        return documentDate != null ? documentDate : intake.getDocumentDate();
    }

    public FundingSource effectiveFundingSource() {
        return fundingSource != null ? fundingSource : intake.getFundingSource();
    }

    public AcquisitionMethod effectiveAcquisitionMethod() {
        return acquisitionMethod != null ? acquisitionMethod : intake.getAcquisitionMethod();
    }

    public Integer effectiveWarrantyMonths() {
        return warrantyMonths != null ? warrantyMonths : intake.getWarrantyMonths();
    }

    public EquipmentIntake getIntake() {
        return intake;
    }

    public void setIntake(EquipmentIntake intake) {
        this.intake = intake;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
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

    public PhysicalDigitalType getPhysicalOrDigital() {
        return physicalOrDigital;
    }

    public void setPhysicalOrDigital(PhysicalDigitalType physicalOrDigital) {
        this.physicalOrDigital = physicalOrDigital == null ? PhysicalDigitalType.PHYSICAL : physicalOrDigital;
    }

    public AssetCategory getAssetCategory() {
        return assetCategory;
    }

    public void setAssetCategory(AssetCategory assetCategory) {
        this.assetCategory = assetCategory;
    }

    public Integer getDocumentQuantity() {
        return documentQuantity;
    }

    public void setDocumentQuantity(Integer documentQuantity) {
        this.documentQuantity = documentQuantity;
    }

    public Integer getReceivedQuantity() {
        return receivedQuantity;
    }

    public void setReceivedQuantity(Integer receivedQuantity) {
        this.receivedQuantity = receivedQuantity;
    }

    public String getVarianceReason() {
        return varianceReason;
    }

    public void setVarianceReason(String varianceReason) {
        this.varianceReason = varianceReason;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public Integer getGeneratedCount() {
        return generatedCount;
    }

    public void setGeneratedCount(Integer generatedCount) {
        this.generatedCount = generatedCount == null ? 0 : generatedCount;
    }

    public String getSupplier() {
        return supplier;
    }

    public void setSupplier(String supplier) {
        this.supplier = supplier;
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

    public Integer getWarrantyMonths() {
        return warrantyMonths;
    }

    public void setWarrantyMonths(Integer warrantyMonths) {
        this.warrantyMonths = warrantyMonths;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
