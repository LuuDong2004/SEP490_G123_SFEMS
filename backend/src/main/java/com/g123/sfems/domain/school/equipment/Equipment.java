package com.g123.sfems.domain.school.equipment;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Một thiết bị (hoặc một lô thiết bị cùng loại) của trường.
 *
 * <p>{@code code} (lớp nền) là MÃ ĐỊNH DANH theo chuẩn {@code TT.TR.MH.LT.ST.NC}
 * — xem {@code EquipmentCodeService}. {@code name} là tên thiết bị.
 *
 * <p>Đây là NHÓM TRƯỜNG LÕI. Hoá đơn, hợp đồng, quyết định giao nằm ở phiếu
 * ghi tăng sinh ra thiết bị.
 */
@RowLevelResource("equipment")
@Entity
@Table(name = "equipment")
/*
 * @DynamicUpdate: chỉ ghi cột thật sự đổi. Không có @Version, nên ghi cả hàng từ bản trong bộ nhớ thì phiếu duyệt
 * (đổi phòng, trạng thái) và lần sửa hồ sơ (số serial…) chạy song song sẽ đè nhau: bên commit sau trả cột của bên kia
 * về giá trị cũ mà không để lại lịch sử nào.
 */
@DynamicUpdate
/*
 * Các quan hệ lớn (nhóm thiết bị, phòng, người quản lý, cấu hình, dòng phiếu nhập)
 * nạp bằng câu SELECT riêng thay vì JOIN: mỗi cái kéo theo cây EAGER của nó, và
 * khi tài sản được nạp theo id (qua một phiếu) Hibernate
 * gộp tất cả vào một câu — vượt giới hạn 1664 cột của PostgreSQL.
 */
public class Equipment extends SchoolOwnedEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "catalog_id", nullable = false)
    private EquipmentCatalog catalog;

    @Enumerated(EnumType.STRING)
    @Column(name = "physical_or_digital", nullable = false, length = 20)
    private PhysicalDigitalType physicalOrDigital = PhysicalDigitalType.PHYSICAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_category", length = 20)
    private AssetCategory assetCategory;

    /** Mã trước khi chuẩn hoá (sổ cũ, phần mềm trước, tệp nhập). Chỉ để tra cứu. */
    @Column(name = "legacy_code", length = 64)
    private String legacyCode;

    @Column(name = "serial_number", length = 100)
    private String serialNumber;

    /** Model và hãng sản xuất của CÁI này — khai ở dòng phiếu ghi tăng (theo lô mua) hoặc sửa tay. */
    @Column(length = 255)
    private String model;

    @Column(length = 255)
    private String manufacturer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ONE;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "origin_source_id")
    private OriginSource originSource;

    // LAZY: chỉ hồ sơ tài sản (EquipmentResponse) đọc — không phải dòng phiếu (EquipmentSummary).
    // EquipmentService.loadForResponse nạp nó cho các phản hồi của /api/equipment.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", length = 30)
    private FundingSource fundingSource;

    /** Ghi rõ khi nguồn hình thành là "Khác" / nguồn kinh phí là "Nguồn hợp pháp khác". */
    @Column(name = "origin_note", length = 255)
    private String originNote;

    @Column(name = "funding_note", length = 255)
    private String fundingNote;

    /** Ghi rõ khi hình thức mua sắm là "Khác". */
    @Column(name = "acquisition_note", length = 255)
    private String acquisitionNote;

    @Column(name = "production_year")
    private Integer productionYear;

    @Column(name = "usage_start_year")
    private Integer usageStartYear;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "original_value", precision = 18, scale = 2)
    private BigDecimal originalValue;

    @Column(name = "warranty_expiry")
    private LocalDate warrantyExpiry;

    /** Hạn sử dụng — chỉ vật tư tiêu hao, hoá chất. */
    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "manager_id")
    private Staff manager;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", length = 20)
    private EquipmentCondition condition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AssetStatus status = AssetStatus.IN_USE;

    /**
     * Dòng phiếu nhập đã sinh ra tài sản này. {@code null} với tài sản nhập tay
     * — dữ liệu có trước khi có phiếu, và màn thêm thủ công vẫn còn.
     *
     * <p>Đây là cái làm cho "mọi tài sản truy ngược được về phiếu nhập" thành
     * một khoá ngoại chứ không phải một lời hứa. {@code RESTRICT}: xoá được
     * phiếu đã sinh ra tài sản thì mất luôn nguồn gốc của chúng.
     */
    // LAZY: dòng phiếu nhập kéo theo sáu liên kết EAGER của nó và cả phiếu (trường, cơ quan...), mà chỉ
    // hồ sơ tài sản cần (số phiếu, chứng từ). EAGER thì MỌI lần nạp tài sản — mỗi dòng của mọi phiếu,
    // biên bản kiểm kê hàng nghìn dòng — đều kéo cả cây đó. Phản hồi của /api/equipment nạp nó qua
    // EquipmentService.loadForResponse; mã khác chỉ đọc nó trong giao dịch.
    @ManyToOne(fetch = FetchType.LAZY)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "intake_line_id")
    private EquipmentIntakeLine intakeLine;

    public EquipmentCatalog getCatalog() {
        return catalog;
    }

    public void setCatalog(EquipmentCatalog catalog) {
        this.catalog = catalog;
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

    public String getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
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

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity == null ? BigDecimal.ONE : quantity;
    }

    public OriginSource getOriginSource() {
        return originSource;
    }

    public void setOriginSource(OriginSource originSource) {
        this.originSource = originSource;
    }

    public AcquisitionMethod getAcquisitionMethod() {
        return acquisitionMethod;
    }

    public void setAcquisitionMethod(AcquisitionMethod acquisitionMethod) {
        this.acquisitionMethod = acquisitionMethod;
    }

    public FundingSource getFundingSource() {
        return fundingSource;
    }

    public void setFundingSource(FundingSource fundingSource) {
        this.fundingSource = fundingSource;
    }

    public String getOriginNote() {
        return originNote;
    }

    public void setOriginNote(String originNote) {
        this.originNote = originNote;
    }

    public String getFundingNote() {
        return fundingNote;
    }

    public void setFundingNote(String fundingNote) {
        this.fundingNote = fundingNote;
    }

    public String getAcquisitionNote() {
        return acquisitionNote;
    }

    public void setAcquisitionNote(String acquisitionNote) {
        this.acquisitionNote = acquisitionNote;
    }

    public Integer getProductionYear() {
        return productionYear;
    }

    public void setProductionYear(Integer productionYear) {
        this.productionYear = productionYear;
    }

    public Integer getUsageStartYear() {
        return usageStartYear;
    }

    public void setUsageStartYear(Integer usageStartYear) {
        this.usageStartYear = usageStartYear;
    }

    public LocalDate getReceivedDate() {
        return receivedDate;
    }

    public void setReceivedDate(LocalDate receivedDate) {
        this.receivedDate = receivedDate;
    }

    public LocalDate getPurchaseDate() {
        return purchaseDate;
    }

    public void setPurchaseDate(LocalDate purchaseDate) {
        this.purchaseDate = purchaseDate;
    }

    public BigDecimal getOriginalValue() {
        return originalValue;
    }

    public void setOriginalValue(BigDecimal originalValue) {
        this.originalValue = originalValue;
    }

    public LocalDate getWarrantyExpiry() {
        return warrantyExpiry;
    }

    public void setWarrantyExpiry(LocalDate warrantyExpiry) {
        this.warrantyExpiry = warrantyExpiry;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public Staff getManager() {
        return manager;
    }

    public void setManager(Staff manager) {
        this.manager = manager;
    }

    public EquipmentCondition getCondition() {
        return condition;
    }

    public void setCondition(EquipmentCondition condition) {
        this.condition = condition;
    }

    public AssetStatus getStatus() {
        return status;
    }

    public void setStatus(AssetStatus status) {
        this.status = status == null ? AssetStatus.IN_USE : status;
    }

    public EquipmentIntakeLine getIntakeLine() {
        return intakeLine;
    }

    public void setIntakeLine(EquipmentIntakeLine intakeLine) {
        this.intakeLine = intakeLine;
    }

    /** Mã chuẩn của Sở: {@code TT.TR.MH.LT.ST.NC}, vd. {@code 79.A1.08.TB.01.25}. */
    public static final Pattern STANDARD_CODE = Pattern.compile("^\\d{2}\\.[A-Z0-9]{2}\\.\\d{2}\\.(TB|PM|HL)\\.\\d{3,4}\\.\\d{2}$");
    public static final String STANDARD_CODE_SQL = "^[0-9]{2}\\.[A-Z0-9]{2}\\.[0-9]{2}\\.(TB|PM|HL)\\.[0-9]{3,4}\\.[0-9]{2}$";

    /**
     * Hồ sơ còn thiếu gì — TÍNH RA, không lưu. Rỗng là hồ sơ chuẩn.
     *
     * <p>Hồ sơ thiếu mã chuẩn, đơn vị tính thì báo cáo và kiểm kê dựa trên nó đều sai theo.
     *
     * <p>Nguyên giá KHÔNG nằm trong điều kiện: HSMT 3.5.3 chỉ đòi "nguyên giá hoặc giá trị theo
     * dữ liệu được cung cấp" — có thì ghi, không có thì để trống.
     *
     * <p>Số serial KHÔNG nằm trong điều kiện: bản đồ, tranh, bàn ghế không có serial của
     * nhà sản xuất, và mã tài sản chuẩn đã phân biệt được từng cái.
     *
     * <p>Điều kiện này viết hai lần — ở đây và bằng SQL trong
     * {@code EquipmentService.incompleteProfile} để lọc được ở server. Hai bản phải đi cùng nhau.
     */
    public List<String> missingProfile() {
        List<String> missing = new ArrayList<>();
        if (getCode() == null || !STANDARD_CODE.matcher(getCode()).matches()) {
            missing.add("mã chuẩn TT.TR.MH.LT.ST.NC");
        }
        if (unit == null) {
            missing.add("đơn vị tính");
        }
        if (fundingSource == null) {
            missing.add("nguồn kinh phí");
        }
        if (receivedDate == null) {
            missing.add("ngày tiếp nhận");
        }
        return missing;
    }

    public boolean isProfileComplete() {
        return missingProfile().isEmpty();
    }

    public String getLegacyCode() {
        return legacyCode;
    }

    public void setLegacyCode(String legacyCode) {
        this.legacyCode = legacyCode;
    }
}
