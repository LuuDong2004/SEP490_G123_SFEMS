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
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.shared.security.rowlevel.RowLevelResource;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Hồ sơ thiết bị (TS-01) — một thiết bị, hoặc một lô thiết bị cùng loại, của trường.
 *
 * <p>{@code code} (lớp nền) là MÃ TÀI SẢN theo chuẩn {@code TT.TR.MH.LT.ST.NC} (TS-05, TS-06);
 * {@code name} là tên thiết bị. Mã duy nhất trong trường.
 *
 * <p>{@code @DynamicUpdate}: chỉ ghi cột thật sự đổi. Không có {@code @Version}, nên ghi cả hàng từ bản
 * trong bộ nhớ thì phiếu kiểm kê (đổi phòng, tình trạng) và lần sửa hồ sơ (số serial…) chạy song song
 * sẽ đè nhau mà không để lại lịch sử.
 *
 * <p>Các quan hệ lớn nạp bằng SELECT riêng thay vì JOIN: mỗi cái kéo theo cây EAGER của nó, gộp vào
 * một câu khi tài sản được nạp qua phiếu là quá rộng.
 */
@RowLevelResource("equipment")
@Entity
@Table(name = "equipment")
@DynamicUpdate
public class Equipment extends SchoolOwnedEntity {

    /** Mã chuẩn của Sở: {@code TT.TR.MH.LT.ST.NC}, vd. {@code 79.MK.04.TB.001.25}. */
    public static final Pattern STANDARD_CODE =
            Pattern.compile("^\\d{2}\\.[A-Z0-9]{2}\\.\\d{2}\\.(TB|PM|HL)\\.\\d{3}\\.\\d{2}$");

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "catalog_id", nullable = false)
    private EquipmentCatalog catalog;

    @Enumerated(EnumType.STRING)
    @Column(name = "physical_or_digital", nullable = false, length = 20)
    private PhysicalDigitalType physicalOrDigital = PhysicalDigitalType.PHYSICAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_category", length = 30)
    private AssetCategory assetCategory;

    /** Mã trước khi chuẩn hoá (sổ cũ, phần mềm trước, tệp nhập TS-07). Chỉ để tra cứu. */
    @Column(name = "legacy_code", length = 64)
    private String legacyCode;

    @Column(name = "serial_number", length = 100)
    private String serialNumber;

    /** Model và hãng của CÁI này — khai ở dòng phiếu ghi tăng (theo lô mua) hoặc sửa tay. */
    @Column(length = 255)
    private String model;

    @Column(length = 255)
    private String manufacturer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    /** Số lượng — 1 với thiết bị quản lý từng cái; lớn hơn với lô ({@code TrackingType.BULK}). */
    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ONE;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "origin_source_id")
    private OriginSource originSource;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", length = 30)
    private FundingSource fundingSource;

    /** Ghi rõ khi nguồn hình thành / nguồn kinh phí / hình thức mua sắm là "Khác". */
    @Column(name = "origin_note", length = 255)
    private String originNote;

    @Column(name = "funding_note", length = 255)
    private String fundingNote;

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

    @Column(name = "remaining_value", precision = 18, scale = 2)
    private BigDecimal remainingValue;

    @Column(name = "warranty_expiry")
    private LocalDate warrantyExpiry;

    /** Nơi đặt. {@code null} = chưa giao về phòng nào (kho). */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "room_id")
    private Room room;

    /** Người được giao quản lý / sử dụng. */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "manager_id")
    private User manager;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", length = 20)
    private EquipmentCondition condition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AssetStatus status = AssetStatus.IN_USE;

    /** Thông số kỹ thuật tự do: tên thông số → giá trị dạng chuỗi (JSONB). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> specs = new LinkedHashMap<>();

    /**
     * Dòng phiếu nhập đã sinh ra tài sản này (PN-03). {@code null} với tài sản nhập tay hoặc từ tệp.
     * Khoá ngoại {@code RESTRICT}: xoá được phiếu đã sinh tài sản thì mất nguồn gốc của chúng.
     */
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

    public String getLegacyCode() {
        return legacyCode;
    }

    public void setLegacyCode(String legacyCode) {
        this.legacyCode = legacyCode;
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

    public BigDecimal getRemainingValue() {
        return remainingValue;
    }

    public void setRemainingValue(BigDecimal remainingValue) {
        this.remainingValue = remainingValue;
    }

    public LocalDate getWarrantyExpiry() {
        return warrantyExpiry;
    }

    public void setWarrantyExpiry(LocalDate warrantyExpiry) {
        this.warrantyExpiry = warrantyExpiry;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public User getManager() {
        return manager;
    }

    public void setManager(User manager) {
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

    public Map<String, String> getSpecs() {
        return specs;
    }

    public void setSpecs(Map<String, String> specs) {
        this.specs = specs == null ? new LinkedHashMap<>() : new LinkedHashMap<>(specs);
    }

    public EquipmentIntakeLine getIntakeLine() {
        return intakeLine;
    }

    public void setIntakeLine(EquipmentIntakeLine intakeLine) {
        this.intakeLine = intakeLine;
    }

    /**
     * Hồ sơ còn thiếu gì — TÍNH RA, không lưu. Rỗng là hồ sơ chuẩn. Phiếu nghiệp vụ chỉ nhận tài sản có
     * hồ sơ chuẩn; số serial KHÔNG nằm trong điều kiện (bản đồ, bàn ghế không có serial).
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
        if (originalValue == null) {
            missing.add("nguyên giá");
        }
        return missing;
    }

    public boolean isProfileComplete() {
        return missingProfile().isEmpty();
    }
}
