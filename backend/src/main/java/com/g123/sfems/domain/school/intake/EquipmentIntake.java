package com.g123.sfems.domain.school.intake;

import java.math.BigDecimal;
import com.g123.sfems.domain.school.voucher.ApprovalFlowType;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.AttributeOverride;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.BatchSize;

/**
 * Phiếu nhập — chứng từ GHI TĂNG tài sản của trường.
 *
 * <p>Không kế thừa {@code SchoolOwnedEntity} dù cũng thuộc một trường: một phiếu
 * không phải một mục danh mục. Nó không có {@code name}, không có thứ tự hiển
 * thị, và {@code active} trên một chứng từ đã xác nhận không có nghĩa gì — thứ
 * quyết định phiếu còn tác dụng hay không là {@link #status}. Cái nó vay của
 * danh mục chỉ có một: mã duy nhất trong trường, và ở đây mã là SỐ PHIẾU.
 *
 * <p>Vòng đời là của mọi phiếu ({@link SchoolVoucher}): nháp → trình → lãnh đạo
 * trường duyệt → hoàn tất. Lần duyệt cuối CHÍNH LÀ thời điểm ghi tăng — cột
 * {@code confirmed_at} giữ tên cũ vì nó vẫn đúng nghĩa: lúc nhận hàng được xác
 * nhận.
 *
 * <p>Thông tin chung ở đây ghi MỘT LẦN và mọi tài sản sinh ra kế thừa: nguồn
 * vốn, nhà cung cấp, nguồn hình thành, hình thức mua sắm, thời hạn bảo hành.
 * Đó là lý do chúng nằm trên phiếu chứ không lặp ở từng dòng.
 */
@RowLevelResource("equipment_intakes")
@Entity
@Table(name = "equipment_intakes")
@AttributeOverride(name = "completedAt", column = @Column(name = "confirmed_at"))
@AttributeOverride(name = "completedById", column = @Column(name = "confirmed_by_id"))
public class EquipmentIntake extends SchoolVoucher {

    @Override
    public String numberPrefix() {
        return "NK";
    }

    @Override
    public LocalDate documentDate() {
        return intakeDate;
    }

    /** Phiếu nhập chỉ duyệt ở cấp trường; UBND, Sở chỉ thấy số liệu trên báo cáo. */
    @Override
    public List<ApprovalStep> approvalChain() {
        return ApprovalFlowType.EQUIPMENT_INTAKES.defaultSteps();
    }


    /** Tổng tiền của phiếu: đơn giá × số lượng thực nhận, cộng mọi dòng. */
    @Override
    public BigDecimal approvalAmount() {
        return lines.stream()
                .filter(l -> l.getUnitPrice() != null && l.getReceivedQuantity() != null)
                .map(l -> l.getUnitPrice().multiply(BigDecimal.valueOf(l.getReceivedQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }


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

    /**
     * Nguồn hình thành của CẢ PHIẾU — một lần ghi tăng là một nguồn (mua sắm, được phân bổ, được
     * tặng, kiểm kê thừa, tự làm, khác). Nó quyết định nguồn kinh phí nào chọn được ở từng dòng và
     * dòng có hình thức mua sắm hay không ({@link com.g123.sfems.domain.catalog.originsource.OriginRule}).
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "origin_source_id")
    private OriginSource originSource;

    /** Ghi rõ khi nguồn hình thành là "Khác". */
    @Column(name = "origin_note", length = 255)
    private String originNote;

    /**
     * Năm học của lần ghi tăng. Mặc định là năm học chứa ngày nhập; sổ tài sản và báo cáo
     * tăng giảm đọc theo năm học, nên lúc trình phải có.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "school_year_id")
    private SchoolYear schoolYear;

    /**
     * Phiếu nghiệp vụ đã sinh ra phiếu này (đề xuất mua sắm, biên bản kiểm kê); cả ba null là phiếu
     * lập tay. Có phiếu nguồn thì nguồn hình thành do phiếu nguồn quyết định, không đổi được.
     */
    @Column(name = "source_resource", length = 40)
    private String sourceResource;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "source_code", length = 50)
    private String sourceCode;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    /**
     * Thời hạn bảo hành tính bằng THÁNG, không phải một ngày hết hạn: chứng từ
     * ghi "bảo hành 24 tháng", và ngày hết hạn của từng tài sản được tính ra từ
     * ngày nhập lúc ghi tăng.
     */
    @Column(name = "warranty_months")
    private Integer warrantyMonths;

    /**
     * Các dòng "loại × số lượng". Quan hệ THÀNH PHẦN: dòng không sống ngoài
     * phiếu, nên {@code orphanRemoval} — bỏ một dòng khỏi danh sách là xoá nó.
     *
     * <p>LAZY, và service nạp nó tường minh trước khi trả về (mọi màn phiếu đều
     * cần các dòng, kể cả danh sách — tổng tiền và số dòng tính từ chúng). EAGER
     * sẽ tạo vòng với {@code EquipmentIntakeLine.intake}, khiến mỗi dòng bảng
     * thiết bị kéo theo cả phiếu VÀ toàn bộ các dòng của phiếu đó.
     *
     * <p>{@code @BatchSize} biến N+1 của một trang danh sách thành hai câu truy
     * vấn: một cho phiếu, một cho tất cả các dòng của chúng.
     */
    @OneToMany(mappedBy = "intake", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    @BatchSize(size = 50)
    private List<EquipmentIntakeLine> lines = new ArrayList<>();

    /**
     * Hoá đơn (chứng từ) của phiếu (254) — thiết bị nằm dưới hoá đơn của nó. Thành phần như các dòng: bỏ khỏi danh sách
     * là xoá. LAZY + nạp tường minh như {@link #lines}.
     */
    @OneToMany(mappedBy = "intake", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("docNo ASC")
    @BatchSize(size = 50)
    private List<EquipmentIntakeDocument> documents = new ArrayList<>();

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

    public SchoolYear getSchoolYear() {
        return schoolYear;
    }

    public void setSchoolYear(SchoolYear schoolYear) {
        this.schoolYear = schoolYear;
    }

    public String getOriginNote() {
        return originNote;
    }

    public void setOriginNote(String originNote) {
        this.originNote = originNote;
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

    public AcquisitionMethod getAcquisitionMethod() {
        return acquisitionMethod;
    }

    public void setAcquisitionMethod(AcquisitionMethod acquisitionMethod) {
        this.acquisitionMethod = acquisitionMethod;
    }

    public Integer getWarrantyMonths() {
        return warrantyMonths;
    }

    public void setWarrantyMonths(Integer warrantyMonths) {
        this.warrantyMonths = warrantyMonths;
    }

    public List<EquipmentIntakeLine> getLines() {
        return lines;
    }

    public List<EquipmentIntakeDocument> getDocuments() {
        return documents;
    }

    /** Thay toàn bộ các hoá đơn (giữ instance đã có — tệp gắn theo id). */
    public void replaceDocuments(List<EquipmentIntakeDocument> replacement) {
        documents.clear();
        if (replacement != null) {
            for (EquipmentIntakeDocument document : replacement) {
                document.setIntake(this);
                documents.add(document);
            }
        }
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
}
