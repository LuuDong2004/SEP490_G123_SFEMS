package com.g123.sfems.domain.school.intake;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
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
import org.hibernate.annotations.BatchSize;

/**
 * Phiếu nhập thiết bị (PN-01..03) — chứng từ GHI TĂNG tài sản của trường.
 *
 * <p>Vòng đời là của mọi phiếu ({@link SchoolVoucher}): nháp → trình → lãnh đạo trường duyệt → hoàn tất.
 * Lần duyệt cuối CHÍNH LÀ thời điểm ghi tăng: mỗi dòng sinh ra {@code receivedQuantity} tài sản (hoặc
 * một lô) trỏ ngược về dòng đó.
 *
 * <p>Thông tin chung ghi MỘT LẦN ở đầu phiếu và mọi tài sản sinh ra kế thừa: nhà cung cấp, chứng từ,
 * nguồn kinh phí, nguồn hình thành, hình thức mua sắm, bảo hành. Dòng khai riêng khi khác đi.
 */
@RowLevelResource("equipment_intakes")
@Entity
@Table(name = "equipment_intakes")
public class EquipmentIntake extends SchoolVoucher {

    /** Ngày nhập hàng về trường. */
    @Column(name = "intake_date", nullable = false)
    private LocalDate intakeDate;

    /** Số hoá đơn / hợp đồng / biên bản bàn giao. */
    @Column(name = "document_no", length = 100)
    private String documentNo;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @Column(length = 255)
    private String supplier;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", length = 30)
    private FundingSource fundingSource;

    /** Nguồn hình thành của CẢ PHIẾU — một lần ghi tăng là một nguồn (mua sắm, được cấp, tài trợ...). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "origin_source_id")
    private OriginSource originSource;

    /** Ghi rõ khi nguồn hình thành là "Khác". */
    @Column(name = "origin_note", length = 255)
    private String originNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    /** Năm học của lần ghi tăng; sổ tài sản và báo cáo tăng giảm đọc theo năm học. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "school_year_id")
    private SchoolYear schoolYear;

    /** Thời hạn bảo hành tính bằng THÁNG; ngày hết hạn của từng tài sản tính ra lúc ghi tăng. */
    @Column(name = "warranty_months")
    private Integer warrantyMonths;

    /** Biên bản giao nhận (PN-01). Người giao bắt buộc khi trình. */
    @Column(length = 255)
    private String deliverer;

    @Column(name = "deliverer_representative", length = 255)
    private String delivererRepresentative;

    @Column(length = 255)
    private String receiver;

    @Column(name = "receiver_position", length = 255)
    private String receiverPosition;

    @Column(length = 255)
    private String storekeeper;

    @Enumerated(EnumType.STRING)
    @Column(name = "inspection_result", length = 20)
    private InspectionResult inspectionResult;

    @Column(name = "handover_no", length = 100)
    private String handoverNo;

    /** Kết quả kiểm tra hàng lúc giao nhận. */
    public enum InspectionResult {
        PASSED,
        PARTIAL,
        FAILED
    }

    /**
     * Phiếu nghiệp vụ đã sinh ra phiếu này (đề xuất mua sắm, biên bản kiểm kê thừa); cả ba trống là phiếu
     * lập tay.
     */
    @Column(name = "source_resource", length = 40)
    private String sourceResource;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "source_code", length = 50)
    private String sourceCode;

    /**
     * Các dòng "loại × số lượng". Quan hệ THÀNH PHẦN: dòng không sống ngoài phiếu, nên
     * {@code orphanRemoval}. LAZY và service nạp tường minh trước khi trả về; EAGER sẽ tạo vòng với
     * {@code EquipmentIntakeLine.intake}.
     */
    @OneToMany(mappedBy = "intake", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    @BatchSize(size = 50)
    private List<EquipmentIntakeLine> lines = new ArrayList<>();

    @Override
    public String resource() {
        return "equipment_intakes";
    }

    @Override
    public String numberPrefix() {
        return "NK";
    }

    @Override
    public LocalDate documentDate() {
        return intakeDate;
    }

    /** Tổng tiền của phiếu: đơn giá × số lượng thực nhận, cộng mọi dòng. */
    @Override
    public BigDecimal approvalAmount() {
        return lines.stream()
                .filter(l -> l.getUnitPrice() != null && l.getReceivedQuantity() != null)
                .map(l -> l.getUnitPrice().multiply(BigDecimal.valueOf(l.getReceivedQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public LocalDate getIntakeDate() {
        return intakeDate;
    }

    public void setIntakeDate(LocalDate intakeDate) {
        this.intakeDate = intakeDate;
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

    public String getSupplier() {
        return supplier;
    }

    public void setSupplier(String supplier) {
        this.supplier = supplier;
    }

    public FundingSource getFundingSource() {
        return fundingSource;
    }

    public void setFundingSource(FundingSource fundingSource) {
        this.fundingSource = fundingSource;
    }

    public OriginSource getOriginSource() {
        return originSource;
    }

    public void setOriginSource(OriginSource originSource) {
        this.originSource = originSource;
    }

    public String getOriginNote() {
        return originNote;
    }

    public void setOriginNote(String originNote) {
        this.originNote = originNote;
    }

    public AcquisitionMethod getAcquisitionMethod() {
        return acquisitionMethod;
    }

    public void setAcquisitionMethod(AcquisitionMethod acquisitionMethod) {
        this.acquisitionMethod = acquisitionMethod;
    }

    public SchoolYear getSchoolYear() {
        return schoolYear;
    }

    public void setSchoolYear(SchoolYear schoolYear) {
        this.schoolYear = schoolYear;
    }

    public Integer getWarrantyMonths() {
        return warrantyMonths;
    }

    public void setWarrantyMonths(Integer warrantyMonths) {
        this.warrantyMonths = warrantyMonths;
    }

    public String getSourceResource() {
        return sourceResource;
    }

    public Long getSourceId() {
        return sourceId;
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public void setSource(String resource, Long id, String code) {
        this.sourceResource = resource;
        this.sourceId = id;
        this.sourceCode = code;
    }

    public List<EquipmentIntakeLine> getLines() {
        return lines;
    }

    /** Thay toàn bộ các dòng, giữ đúng một chiều của quan hệ hai chiều. */
    public void replaceLines(List<EquipmentIntakeLine> replacement) {
        lines.clear();
        if (replacement != null) {
            for (EquipmentIntakeLine line : replacement) {
                line.setIntake(this);
                lines.add(line);
            }
        }
    }

    public String getDeliverer() {
        return deliverer;
    }

    public void setDeliverer(String deliverer) {
        this.deliverer = deliverer;
    }

    public String getDelivererRepresentative() {
        return delivererRepresentative;
    }

    public void setDelivererRepresentative(String delivererRepresentative) {
        this.delivererRepresentative = delivererRepresentative;
    }

    public String getReceiver() {
        return receiver;
    }

    public void setReceiver(String receiver) {
        this.receiver = receiver;
    }

    public String getReceiverPosition() {
        return receiverPosition;
    }

    public void setReceiverPosition(String receiverPosition) {
        this.receiverPosition = receiverPosition;
    }

    public String getStorekeeper() {
        return storekeeper;
    }

    public void setStorekeeper(String storekeeper) {
        this.storekeeper = storekeeper;
    }

    public InspectionResult getInspectionResult() {
        return inspectionResult;
    }

    public void setInspectionResult(InspectionResult inspectionResult) {
        this.inspectionResult = inspectionResult;
    }

    public String getHandoverNo() {
        return handoverNo;
    }

    public void setHandoverNo(String handoverNo) {
        this.handoverNo = handoverNo;
    }
}
