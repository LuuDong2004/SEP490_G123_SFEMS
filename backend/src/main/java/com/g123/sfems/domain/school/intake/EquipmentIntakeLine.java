package com.g123.sfems.domain.school.intake;

import com.g123.sfems.domain.base.BaseEntity;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
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
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.unit.Unit;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Một dòng của phiếu nhập: một LOẠI thiết bị và số lượng của nó.
 *
 * <p>Hai cột số lượng chứ không phải một. {@link #documentQuantity} là con số
 * trên hoá đơn, {@link #receivedQuantity} là con số đếm được lúc mở thùng, và
 * việc ghi tăng đi theo cái thứ hai. Gộp làm một sẽ mất đúng thông tin mà cả
 * quy trình nhận hàng tồn tại để bắt: hàng về thiếu. Lệch nhau thì
 * {@link #varianceReason} là bắt buộc.
 *
 * <p>Nhà cung cấp, hoá đơn, nguồn kinh phí, nguồn hình thành, hình thức mua sắm và bảo hành
 * nằm trên ĐẦU PHIẾU làm mặc định chung; dòng khai riêng khi khác đi (một phiếu gom hàng của
 * nhiều nhà cung cấp, nhiều nguồn). Các {@code effective*} là giá trị thật của dòng — cột của
 * dòng nếu có, không thì của phiếu — và là thứ duy nhất nên đọc khi sinh tài sản.
 */
@Entity
@Table(name = "equipment_intake_lines")
public class EquipmentIntakeLine extends BaseEntity {
    /** Trường chứng từ theo app Jmix cũ, JSON — hình dạng do {@code voucher-forms/*.json} quyết định. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String details = "{}";

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details == null ? "{}" : details;
    }


    /**
     * Phiếu chứa dòng này. EAGER vì một dòng chỉ được đọc qua hai đường, và cả
     * hai đều cần phiếu: màn phiếu (đã có sẵn nó) và hồ sơ tài sản, nơi câu
     * "sinh ra từ phiếu NK-2026-00001" là cả điểm của việc truy ngược. Để LAZY
     * thì đường thứ hai đọc ngoài transaction và vỡ.
     *
     * <p>Không thành vòng EAGER với {@code EquipmentIntake.lines} vì phía kia
     * là LAZY — xem chú thích ở đó.
     */
    // Cùng lý do như trong EquipmentCatalog: dòng phiếu nhập được nạp kèm mọi
    // tài sản nó sinh ra, nên một JOIN ở đây nhân lên theo số tài sản.
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
    @Column(name = "asset_category", length = 20)
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

    /** Vị trí nhận. {@code null} = Kho (chưa giao về phòng nào). */
    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @JoinColumn(name = "room_id")
    private Room room;

    /**
     * Số tài sản đã sinh (hoặc số lượng đã cộng vào tồn) khi xác nhận. Là kết
     * quả của việc ghi tăng, không phải thứ người dùng nhập — giữ lại để màn
     * phiếu nói được "dòng này đã sinh ra 50 tài sản" mà không phải đếm lại.
     */
    @Column(name = "generated_count", nullable = false)
    private Integer generatedCount = 0;

    // Khai riêng của dòng — null = theo đầu phiếu.
    /**
     * Hoá đơn mà dòng thuộc về (254). Chứng từ của hoá đơn được chép xuống các cột chứng từ của dòng mỗi lần lưu, nên
     * mọi chỗ đọc dòng vẫn đọc {@code effective*}; cột này chỉ để gom dòng theo hoá đơn và tìm tệp hoá đơn.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private EquipmentIntakeDocument document;

    @Column(length = 255)
    private String supplier;

    @Column(name = "document_no", length = 100)
    private String documentNo;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", length = 30)
    private FundingSource fundingSource;

    /** Ghi rõ khi nguồn kinh phí là "Nguồn hợp pháp khác". */
    @Column(name = "funding_note", length = 255)
    private String fundingNote;

    /** Ghi rõ khi hình thức mua sắm là "Khác". */
    @Column(name = "acquisition_note", length = 255)
    private String acquisitionNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.JOIN)
    @JoinColumn(name = "origin_source_id")
    private OriginSource originSource;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.JOIN)
    @JoinColumn(name = "acquisition_method_id")
    private AcquisitionMethod acquisitionMethod;

    @Column(name = "warranty_months")
    private Integer warrantyMonths;

    /**
     * Model và hãng sản xuất của LÔ hàng này — khác nhau giữa các lần mua của
     * cùng một nhóm thiết bị, nên khai theo dòng chứ không theo danh mục.
     * Xác nhận phiếu thì chép xuống tài sản.
     */
    @Column(length = 255)
    private String model;

    @Column(length = 255)
    private String manufacturer;

    /** Thông tin khác của lô (chép xuống tài sản khi duyệt) — cấu hình, công suất, xuất xứ…: chữ tự do, không tách trường. */
    @Column(name = "other_info", length = 500)
    private String otherInfo;

    /** Hạn sử dụng của LÔ vật tư tiêu hao, hoá chất; thiết bị từng cái không có. Chép xuống tài sản. */
    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    /**
     * Quy cách bao bì — ĐÃ BỎ quy đổi: phiếu lưu từ nay luôn để trống, số lượng của dòng theo đơn vị tính của
     * danh mục (g, ml…). Chỉ dòng cũ còn mang: đơn vị bao bì (Lọ, Chai…) và lượng trong một bao
     * bì tính theo đơn vị của thiết bị (100 ml). Có quy cách thì số lượng của dòng đếm theo bao bì và đơn giá
     * là giá một bao bì; lô vào sổ mang số lượng đã quy đổi ({@link #stockQuantity()}). Cùng trống hoặc cùng có.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "pack_unit_id")
    private Unit packUnit;

    @Column(name = "pack_size", precision = 14, scale = 3)
    private BigDecimal packSize;

    /**
     * Số serial khai lúc nhận hàng (changelog 247), mỗi dòng một số, đã bỏ khoảng trắng và viết hoa. Chỉ dòng thiết bị
     * từng cái mới có; lúc duyệt, thiết bị sinh ra nhận lần lượt các số này theo thứ tự.
     */
    @Column(name = "serial_numbers", columnDefinition = "text")
    private String serialNumbers;

    /** Phòng nhận của TỪNG cái, theo vị trí (cái thứ i ↔ dòng thứ i); dòng trống = theo {@link #room} của cả dòng. */
    @Column(name = "unit_room_ids", columnDefinition = "text")
    private String unitRoomIds;

    /** Model / hãng / bảo hành (tháng) / thông tin khác của TỪNG cái, theo vị trí; trống = theo ô cùng tên của dòng (256). */
    @Column(name = "unit_models", columnDefinition = "text")
    private String unitModels;

    @Column(name = "unit_manufacturers", columnDefinition = "text")
    private String unitManufacturers;

    @Column(name = "unit_warranty_months", columnDefinition = "text")
    private String unitWarrantyMonths;

    @Column(name = "unit_other_infos", columnDefinition = "text")
    private String unitOtherInfos;

    /** Các số serial ĐÃ KHAI (bỏ chỗ trống) — để kiểm trùng, đếm. */
    public List<String> serialList() {
        return serialSlots().stream().filter(s -> !s.isEmpty()).toList();
    }

    /**
     * Serial THEO VỊ TRÍ: phần tử thứ i là serial của thiết bị thứ i sinh từ dòng, chuỗi rỗng = máy đó chưa khai
     * (trưởng nhóm 13/11/2026 — form khai từng máy, máy 2 để trống thì máy 3 vẫn mang đúng số của nó).
     */
    /** Phòng riêng của từng cái theo vị trí; {@code null} ở vị trí nào là cái đó theo phòng nhận của dòng. */
    public List<Long> unitRoomSlots() {
        if (unitRoomIds == null || unitRoomIds.isBlank()) {
            return List.of();
        }
        return Arrays.stream(unitRoomIds.split("\n", -1)).map(String::strip)
                .map(s -> s.isEmpty() ? null : Long.valueOf(s)).collect(java.util.stream.Collectors.toList());
    }

    /** Ghi phòng riêng theo vị trí; bỏ phần trống ở cuối, toàn trống thì xoá. */
    public void setUnitRoomSlots(List<Long> ids) {
        List<String> list = new java.util.ArrayList<>((ids == null ? List.<Long>of() : ids).stream()
                .map(id -> id == null ? "" : id.toString()).toList());
        while (!list.isEmpty() && list.getLast().isEmpty()) {
            list.removeLast();
        }
        this.unitRoomIds = list.isEmpty() ? null : String.join("\n", list);
    }

    /** Chuỗi theo vị trí → danh sách; ô trống là chuỗi rỗng. */
    private static List<String> slotsOf(String raw) {
        return raw == null || raw.isBlank() ? List.of() : Arrays.stream(raw.split("\n", -1)).map(String::strip).toList();
    }

    /** Danh sách theo vị trí → chuỗi; xuống dòng trong giá trị thành khoảng trắng, bỏ phần trống ở cuối. */
    private static String joinSlots(List<?> values) {
        List<String> list = new java.util.ArrayList<>((values == null ? List.of() : values).stream()
                .map(v -> v == null ? "" : v.toString().replaceAll("\\s*\\R\\s*", " ").strip()).toList());
        while (!list.isEmpty() && list.getLast().isEmpty()) {
            list.removeLast();
        }
        return list.isEmpty() ? null : String.join("\n", list);
    }

    private static String at(List<String> slots, int i) {
        return i < slots.size() && !slots.get(i).isEmpty() ? slots.get(i) : null;
    }

    public List<String> unitModels() {
        return slotsOf(unitModels);
    }

    public List<String> unitManufacturers() {
        return slotsOf(unitManufacturers);
    }

    public List<String> unitOtherInfos() {
        return slotsOf(unitOtherInfos);
    }

    public List<Integer> unitWarrantyMonths() {
        return slotsOf(unitWarrantyMonths).stream().map(s -> s.isEmpty() ? null : Integer.valueOf(s)).collect(java.util.stream.Collectors.toList());
    }

    public void setUnitDetails(List<String> models, List<String> manufacturers, List<Integer> warranties, List<String> otherInfos) {
        this.unitModels = joinSlots(models);
        this.unitManufacturers = joinSlots(manufacturers);
        this.unitWarrantyMonths = joinSlots(warranties);
        this.unitOtherInfos = joinSlots(otherInfos);
    }

    /** Model của cái thứ i: của riêng nó, không thì của dòng. */
    public String modelOf(int i) {
        String own = at(unitModels(), i);
        return own != null ? own : model;
    }

    public String manufacturerOf(int i) {
        String own = at(unitManufacturers(), i);
        return own != null ? own : manufacturer;
    }

    public String otherInfoOf(int i) {
        String own = at(unitOtherInfos(), i);
        return own != null ? own : otherInfo;
    }

    /** Bảo hành (tháng) của cái thứ i: của riêng nó, không thì của dòng / đầu phiếu. */
    public Integer warrantyMonthsOf(int i) {
        List<Integer> own = unitWarrantyMonths();
        return i < own.size() && own.get(i) != null ? own.get(i) : effectiveWarrantyMonths();
    }

    public List<String> serialSlots() {
        if (serialNumbers == null || serialNumbers.isBlank()) {
            return List.of();
        }
        return Arrays.stream(serialNumbers.split("\n", -1)).map(String::strip).toList();
    }

    /** Ghi serial theo vị trí; chỗ trống giữ chỗ, chỗ trống ở cuối bỏ đi; không còn số nào là không khai. */
    public void setSerialList(List<String> slots) {
        List<String> list = slots == null ? List.of() : new java.util.ArrayList<>(slots.stream().map(s -> s == null ? "" : s.strip()).toList());
        while (!list.isEmpty() && list.get(list.size() - 1).isEmpty()) {
            list.remove(list.size() - 1);
        }
        this.serialNumbers = list.isEmpty() ? null : String.join("\n", list);
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

    public String getOtherInfo() {
        return otherInfo;
    }

    public void setOtherInfo(String otherInfo) {
        this.otherInfo = otherInfo;
    }

    /** Số lượng vào sổ theo đơn vị của thiết bị: số nhận × quy cách, hoặc số nhận khi không quy đổi. */
    public BigDecimal stockQuantity() {
        BigDecimal received = BigDecimal.valueOf(receivedQuantity == null ? 0 : receivedQuantity);
        return packSize == null ? received : received.multiply(packSize);
    }

    public Unit getPackUnit() {
        return packUnit;
    }

    public void setPackUnit(Unit packUnit) {
        this.packUnit = packUnit;
    }

    public BigDecimal getPackSize() {
        return packSize;
    }

    public void setPackSize(BigDecimal packSize) {
        this.packSize = packSize;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
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

    public Integer getWarrantyMonths() {
        return warrantyMonths;
    }

    public void setWarrantyMonths(Integer warrantyMonths) {
        this.warrantyMonths = warrantyMonths;
    }

    public EquipmentIntakeDocument getDocument() {
        return document;
    }

    public void setDocument(EquipmentIntakeDocument document) {
        this.document = document;
    }

    /** Id hoá đơn của dòng mà không nạp hoá đơn (proxy LAZY trả id không cần truy vấn). */
    public Long documentId() {
        return document == null ? null : document.getId();
    }

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

    /** Nguồn hình thành là của CẢ PHIẾU (từ changelog 109) — dòng không còn mang riêng. */
    public OriginSource effectiveOriginSource() {
        return intake.getOriginSource();
    }

    /** Chỉ hàng MUA mới có hình thức mua sắm — nguồn hình thành khác thì không có, dù cột còn giá trị cũ. */
    public AcquisitionMethod effectiveAcquisitionMethod() {
        boolean purchased = OriginRule.of(intake.getOriginSource()).map(OriginRule::acquisitionMethod).orElse(true);
        if (!purchased) {
            return null;
        }
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
}
