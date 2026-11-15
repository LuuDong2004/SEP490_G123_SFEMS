package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfig;
import com.g123.sfems.domain.catalog.equipmentconfig.EquipmentConfigAttribute;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.module.catalog.acquisitionmethod.AcquisitionMethodService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.equipmentconfig.EquipmentConfigService;
import com.g123.sfems.module.catalog.originsource.OriginSourceService;
import com.g123.sfems.module.catalog.unit.UnitService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.school.equipment.history.EquipmentHistoryService;
import com.g123.sfems.module.school.voucher.VoucherHolds;
import com.g123.sfems.module.school.equipment.history.EquipmentHistoryService.VoucherRef;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.module.school.staff.StaffService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import com.g123.sfems.shared.validation.FieldRule;
import java.time.LocalDate;
import java.util.Objects;
import java.time.format.DateTimeParseException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import org.hibernate.Hibernate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.RoundingMode;
import org.springframework.data.domain.Sort;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.school.staff.Staff;
import java.util.stream.Collectors;

/**
 * Thiết bị. Quy tắc riêng:
 *
 * <ul>
 *   <li><b>Mã</b>: giữ nguyên mã gợi ý (chuẩn TT.TR.MH.LT.ST.NC) thì chốt số của
 *       bộ đếm; tự gõ mã khác thì dùng mã đó, bộ đếm không bị tiêu.</li>
 *   <li>Phòng, người quản lý phải cùng trường với thiết bị.</li>
 *   <li><b>Thông số kỹ thuật</b> kiểm theo bộ thông số đã chọn: chỉ nhận mã
 *       thông số có trong bộ, đủ thông số bắt buộc, đúng kiểu dữ liệu.</li>
 * </ul>
 */
@Service
public class EquipmentService extends SchoolOwnedService<Equipment, EquipmentRequest, EquipmentPatchRequest>
        implements RecordAccess {

    /** Đã ra khỏi sổ — thanh lý, tiêu huỷ, mất, dùng hết. */
    public static final Set<AssetStatus> OFF_BOOK = EnumSet.of(
            AssetStatus.LIQUIDATED, AssetStatus.DESTROYED, AssetStatus.LOST, AssetStatus.USED_UP,
            AssetStatus.NOT_DELIVERED);

    private final EquipmentRepository repository;
    private final EquipmentCodeService codes;
    private final EquipmentCatalogService catalogs;
    private final UnitService units;
    private final OriginSourceService originSources;
    private final AcquisitionMethodService acquisitionMethods;
    private final RoomService rooms;
    private final StaffService staff;
    private final EquipmentConfigService configs;
    private final EquipmentHistoryService history;
    private final RowLevelSecurity scopes;

    /** Tài sản đang nằm trên phiếu chạy thì không xếp chỗ trên hồ sơ — phiếu đó đang quyết định chỗ của nó. */
    private final VoucherHolds holds;

    @PersistenceContext
    private EntityManager em;

    public EquipmentService(
            EquipmentRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            EquipmentCodeService codes,
            EquipmentCatalogService catalogs,
            UnitService units,
            OriginSourceService originSources,
            AcquisitionMethodService acquisitionMethods,
            RoomService rooms,
            StaffService staff,
            EquipmentConfigService configs,
            EquipmentHistoryService history,
            VoucherHolds holds) {
        super(repository, rowLevel, Equipment.class, Equipment::new, "Thiết bị", schools, principals);
        this.repository = repository;
        this.codes = codes;
        this.catalogs = catalogs;
        this.units = units;
        this.originSources = originSources;
        this.acquisitionMethods = acquisitionMethods;
        this.rooms = rooms;
        this.staff = staff;
        this.configs = configs;
        this.history = history;
        this.scopes = rowLevel;
        this.holds = holds;
    }

    /** Tài sản trong phạm vi GHI của người gọi — cho các phiếu làm đổi tài sản. */
    public Equipment getWritable(Long id) {
        return repository.findOne(scopes.byId(Equipment.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Equipment", id));
    }

    /** Kết luận của lần xử lý hiện tại được lưu thành trạng thái, không dò lịch sử phiếu cũ. */
    public boolean isUnrepairable(Long id) {
        return repository.exists((root, query, cb) -> cb.and(
                cb.equal(root.get("id"), id), cb.equal(root.get("status"), AssetStatus.UNREPAIRABLE)));
    }

    private static Specification<Equipment> unrepairable() {
        return (root, query, cb) -> cb.equal(root.get("status"), AssetStatus.UNREPAIRABLE);
    }

    /**
     * Sổ tài sản của một trường (hoặc một phòng) — những gì còn trên sổ, tức là
     * trừ đã thanh lý và đã mất. Theo phạm vi đọc của người gọi.
     */
    public List<Equipment> onRegister(Long schoolId, Long roomId) {
        Specification<Equipment> spec = scopes.<Equipment>scope(Equipment.class, Action.READ)
                .and((root, q, cb) -> cb.equal(root.get("school").get("id"), schoolId))
                .and((root, q, cb) -> cb.not(root.get("status").in(OFF_BOOK)));
        if (roomId != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("room").get("id"), roomId));
        }
        return repository.findAll(spec, Sort.by("code"));
    }

    /**
     * Mã tài sản khác của trường, còn trên sổ, đang mang số serial này — so bỏ khoảng trắng hai đầu, không
     * phân biệt hoa thường. Serial trống thì không có gì để trùng.
     */
    public Optional<String> serialHolder(Long schoolId, String serial, Long excludeId) {
        String key = normalizeSerial(serial);
        if (schoolId == null || key == null) {
            return Optional.empty();
        }
        return repository.codesWithSerial(schoolId, key, excludeId == null ? -1L : excludeId, OFF_BOOK)
                .stream().findFirst();
    }

    /** Khoá so trùng của số serial: bỏ khoảng trắng hai đầu, chữ thường; trống là {@code null}. */
    public static String normalizeSerial(String serial) {
        if (serial == null || serial.isBlank()) {
            return null;
        }
        return serial.trim().toLowerCase(Locale.ROOT);
    }

    private void requireUniqueSerial(Equipment item) {
        if (item.getSchool() == null) {
            return;
        }
        serialHolder(item.getSchool().getId(), item.getSerialNumber(), item.getId()).ifPresent(code -> {
            throw new FieldValidationException("serialNumber",
                    "Số serial " + item.getSerialNumber().trim() + " đã có ở thiết bị " + code);
        });
    }

    @Override
    public String resource() {
        return "equipment";
    }

    /**
     * Ba liên kết LAZY mà chỉ hồ sơ tài sản ({@code EquipmentResponse}) đọc: dòng phiếu nhập (kèm phiếu),
     * bộ thông số, hình thức mua sắm — và các môn thêm của nhóm thiết bị. Nạp theo lô
     * ({@code default_batch_fetch_size}), nên một trang 20 tài sản là vài câu, không phải 20.
     */
    @Override
    protected void loadForResponse(Equipment item) {
        Hibernate.initialize(item.getIntakeLine());
        Hibernate.initialize(item.getConfig());
        Hibernate.initialize(item.getAcquisitionMethod());
        if (item.getCatalog() != null) {
            Hibernate.initialize(item.getCatalog().getExtraSubjects());
        }
    }

    @Override
    public void checkReadable(Long id) {
        get(id);
    }

    @Override
    public void checkWritable(Long id) {
        getWritable(id);
    }

    @Override
    protected void applyCreateOwned(Equipment item, EquipmentRequest request) {
        // Tên: gộp khoảng trắng thừa giữa các chữ (hai đầu lớp cha đã cắt).
        item.setName(item.getName().replaceAll("\\s+", " "));
        item.setCatalog(catalogs.get(request.catalog().id()));
        catalogs.requireOwnedBy(item.getCatalog(), item.getSchool(), 0);
        // Vắng thì lấy của nhóm thiết bị — xem chú thích ở generateFromIntakeLine.
        item.setPhysicalOrDigital(request.physicalOrDigital() != null
                ? request.physicalOrDigital()
                : item.getCatalog().getPhysicalOrDigital());
        item.setAssetCategory(request.assetCategory() != null
                ? request.assetCategory()
                : item.getCatalog().getAssetCategory());
        item.setSerialNumber(blankToNull(FieldRule.SERIAL.normalize(request.serialNumber())));
        requireUniqueSerial(item);
        item.setModel(blankToNull(request.model()));
        item.setManufacturer(blankToNull(request.manufacturer()));
        item.setOtherInfo(blankToNull(request.otherInfo()));
        // Vắng thì lấy của thiết bị trong danh mục, như phiếu nhập — tệp nhập số dư không có cột đơn vị,
        // và thiếu đơn vị là hồ sơ chưa chuẩn, không vào được phiếu nào.
        item.setUnit(request.unit() != null && request.unit().id() != null ? units.get(request.unit().id())
                : item.getCatalog().getUnit());
        item.setQuantity(request.quantity());
        requireQuantityFitsUnit(item);
        item.setOriginSource(ref(request.originSource(), originSources::get));
        item.setAcquisitionMethod(ref(request.acquisitionMethod(), acquisitionMethods::get));
        item.setFundingSource(request.fundingSource());
        requireSourcesFit(item);
        item.setProductionYear(request.productionYear());
        item.setUsageStartYear(request.usageStartYear());
        item.setReceivedDate(request.receivedDate());
        item.setPurchaseDate(request.purchaseDate());
        item.setOriginalValue(request.originalValue());
        // Tài sản khai tay là tài sản CÓ SẴN (số dư đầu kỳ): chưa khấu hao kỳ nào trên hệ
        // thống thì còn lại bằng nguyên giá, trừ khi người khai biết số khác.
        item.setRemainingValue(request.remainingValue() != null ? request.remainingValue() : request.originalValue());
        item.setWarrantyExpiry(request.warrantyExpiry());
        item.setExpiryDate(bulk(item) ? request.expiryDate() : null);
        item.setRoom(ref(request.room(), rooms::get));
        item.setManager(ref(request.manager(), staff::get));
        item.setCondition(request.condition() != null ? request.condition() : EquipmentCondition.TOT);
        // Trạng thái không chọn tay: ở kho là "trong kho", ở phòng là "đang sử dụng". Mọi
        // trạng thái khác (mượn, hỏng, sửa, điều chuyển...) chỉ phiếu mới đặt được.
        item.setStatus(isStoreroom(item.getRoom()) ? AssetStatus.IN_STOCK : AssetStatus.IN_USE);
        item.setConfig(ref(request.config(), configs::get));
        item.setSpecs(checkedSpecs(item.getConfig(), request.specs()));
        requireRules(item);

        // Mã do hệ thống cấp theo chuẩn của Sở — không gõ tay. Mã người dùng đưa vào mà
        // không phải mã gợi ý (sổ cũ, tệp nhập) được giữ làm mã cũ để tra cứu tem cũ.
        String typed = item.getCode() == null ? "" : item.getCode().trim();
        String suggested = codes.parts(item.getSchool(), item.getCatalog(), item.getPhysicalOrDigital(),
                        item.getReceivedDate(), item.getPurchaseDate())
                .flatMap(parts -> codes.peek(item.getSchool(), parts))
                .orElse("");
        assignStandardCode(item);
        if (!typed.isEmpty() && !typed.equalsIgnoreCase(suggested)) {
            item.setLegacyCode(typed);
        }
    }

    /**
     * Thiết bị KHÔNG xoá thẳng được: tài sản ra khỏi sổ bằng phiếu — thanh lý / tiêu huỷ
     * ({@code LIQUIDATED}, {@code DESTROYED}) hoặc ghi giảm do mất ({@code LOST}). Chỉ hồ sơ đã ra khỏi sổ mới
     * được xoá; xoá một tài sản đang dùng là làm nó biến mất khỏi mọi báo cáo mà không có chứng
     * từ nào giải thích.
     */
    @Override
    protected void beforeDelete(Equipment item) {
        if (item.getStatus() != AssetStatus.LIQUIDATED && item.getStatus() != AssetStatus.DESTROYED
                && item.getStatus() != AssetStatus.LOST
                && item.getStatus() != AssetStatus.USED_UP) {
            throw new FieldValidationException("status",
                    "Không xoá thẳng thiết bị được. Thiết bị ra khỏi hệ thống qua phiếu thanh lý / tiêu huỷ hoặc ghi giảm do mất; "
                            + "chỉ hồ sơ đã thanh lý hoặc đã ghi giảm mới được xoá.");
        }
    }

    /** Chốt một mã chuẩn mới cho tài sản; thiếu dữ liệu sinh mã thì nói thiếu gì. */
    private void assignStandardCode(Equipment item) {
        var parts = codes.parts(item.getSchool(), item.getCatalog(), item.getPhysicalOrDigital(),
                        item.getReceivedDate(), item.getPurchaseDate())
                .orElseThrow(() -> new FieldValidationException("catalog",
                        "Chưa cấp được mã chuẩn: trường chưa có mã EMIS hoặc môn của nhóm thiết bị chưa có mã dạy học"));
        item.setCode(codes.reserve(item.getSchool(), parts).orElseThrow(() -> new FieldValidationException(
                "catalog", "Đã hết số thứ tự 001-999 cho bộ mã %s.%s.%s.%s.xxx.%s trong năm".formatted(
                        parts.province(), parts.school(), parts.subject(), parts.type(), parts.year()))));
    }

    /**
     * Cấp mã chuẩn cho tài sản đang mang mã cũ (nhập từ sổ cũ, tệp Excel...). Mã cũ chuyển
     * sang {@code legacyCode} để tem cũ vẫn tra được; lịch sử ghi lại lần đổi mã.
     */
    @Transactional
    public Equipment standardizeCode(Long id) {
        Equipment item = getWritable(id);
        if (Equipment.STANDARD_CODE.matcher(item.getCode()).matches()) {
            throw new FieldValidationException("code", "Thiết bị đã mang mã chuẩn " + item.getCode());
        }
        loadForResponse(item);
        String old = item.getCode();
        if (item.getLegacyCode() == null) {
            item.setLegacyCode(old);
        }
        assignStandardCode(item);
        history.change(item, EquipmentHistory.Action.CAP_NHAT, "code", old, item.getCode(), null,
                "Cấp mã chuẩn thay mã cũ " + old);
        return repository.persist(item);
    }

    /**
     * Những gì trên hồ sơ CHỈ phiếu mới được đổi: vị trí, người giữ, trạng thái, tình
     * trạng, giá trị còn lại, mã. Sửa thẳng ở đây thì sổ cấp phát, sổ hỏng, sổ khấu hao
     * không còn khớp với tài sản, và không có ai duyệt thay đổi đó.
     *
     * <p>Ngoại lệ: XẾP CHỖ LẦN ĐẦU. Tài sản chưa có phòng (hoặc chưa có người giữ) — thường là
     * số dư đầu kỳ khai thiếu — được chọn phòng / người giữ ngay trên hồ sơ: đó là bổ sung
     * dữ liệu còn trống, không phải dời một tài sản đang nằm ở chỗ khác. Đã có chỗ rồi thì đổi
     * vẫn phải qua phiếu cấp phát / điều chuyển.
     */
    private static void requireVoucherOwnedUnchanged(Equipment item, EquipmentPatchRequest r) {
        List<String> changed = new ArrayList<>();
        if (r.code() != null && !r.code().trim().equalsIgnoreCase(item.getCode())) {
            changed.add("mã (dùng nút Cấp mã chuẩn)");
        }
        if (r.room() != null && item.getRoom() != null && !Objects.equals(r.room().id(),
                item.getRoom().getId())) {
            changed.add("phòng (phiếu cấp phát / điều chuyển)");
        }
        if (r.manager() != null && item.getManager() != null && !Objects.equals(r.manager().id(),
                item.getManager().getId())) {
            changed.add("người quản lý (phiếu cấp phát)");
        }
        // Số lượng của một lô vật tư là hệ quả của phiếu (nhập, xuất kho, ghi tiêu hao).
        if (r.quantity() != null && r.quantity().compareTo(item.getQuantity()) != 0) {
            changed.add("số lượng (phiếu ghi tăng / xuất kho / ghi tiêu hao)");
        }
        if (r.status() != null && r.status() != item.getStatus()) {
            changed.add("trạng thái (phiếu tương ứng)");
        }
        if (r.condition() != null && r.condition() != item.getCondition()) {
            changed.add("tình trạng (phiếu báo hỏng / sửa chữa / kiểm kê)");
        }
        // Hồ sơ chưa có giá trị (nguyên giá không bắt buộc) thì được bổ sung; đã có thì chỉ đổi qua phiếu.
        if (r.remainingValue() != null && item.getRemainingValue() != null
                && r.remainingValue().compareTo(item.getRemainingValue()) != 0) {
            changed.add("giá trị còn lại (bảng tính hao mòn)");
        }
        if (!changed.isEmpty()) {
            throw new FieldValidationException("status", "Không sửa thẳng trên hồ sơ được: "
                    + String.join(", ", changed)
                    + ". Những thứ này chỉ đổi qua phiếu, để có người duyệt và để lại chứng từ.");
        }
    }

    /**
     * Nguồn hình thành ↔ nguồn kinh phí ↔ hình thức mua sắm trên hồ sơ phải khớp nhau theo đúng luật
     * của phiếu ghi tăng ({@link OriginRule}) — tài sản khai đầu kỳ hay sửa tay cũng không được mang
     * một cặp mà phiếu sẽ từ chối. Hồ sơ chưa có nguồn hình thành thì chưa có gì để đối chiếu.
     */
    private static void requireSourcesFit(Equipment item) {
        OriginRule rule = OriginRule.of(item.getOriginSource()).orElse(null);
        if (rule == null) {
            return;
        }
        if (!rule.acquisitionMethod()) {
            // Chỉ hàng mua mới có hình thức mua sắm — gỡ chứ không báo lỗi, như trên phiếu.
            item.setAcquisitionMethod(null);
        }
        FundingSource funding = item.getFundingSource();
        if (funding != null && !rule.allows(funding)) {
            throw new FieldValidationException("fundingSource",
                    "Nguồn kinh phí \"%s\" không đi với nguồn hình thành \"%s\". Chọn một trong: %s".formatted(
                            funding.label(), rule.label(), rule.fundingSources().stream().map(FundingSource::label)
                                    .collect(Collectors.joining(", "))));
        }
    }

    /** Mã không đổi qua form sửa — lớp cha gán mã trước khi gọi móc, nên chặn ở đây. */
    @Override
    @Transactional
    public Equipment update(Long id, EquipmentPatchRequest request) {
        Equipment item = getWritable(id);
        // Khoá rồi đọc lại trước khi so: form mở từ trước mà lưu sau lần duyệt phiếu (cấp phát, điều chuyển…) thì
        // phòng / trạng thái phiếu vừa đặt bị ghi đè bằng bản cũ, và "giá trị gửi lên = giá trị đang có" so trên
        // bản cũ nên không chặn được. Sau khoá, bản so là bản mới nhất — gửi lại giá trị cũ thì bị 422 như sửa tay.
        em.refresh(item, LockModeType.PESSIMISTIC_WRITE);
        requireVoucherOwnedUnchanged(item, request);
        requireRecordFieldsKept(item, request);
        requireCatalogFits(item, request);
        return super.update(id, request);
    }

    /**
     * Những gì ĐỊNH DANH tài sản và đi vào sổ sách: chỉ bổ sung khi còn trống, đã có thì giữ nguyên. Tên của thiết bị
     * trong danh mục của Sở theo danh mục, không sửa; tên đồ ngoài danh mục, ghi chú,
     * serial, model, hãng, năm sản xuất, bảo hành, thông số thì sửa tự do — tên đổi thế nào thì tài sản vẫn gắn với
     * thiết bị trong danh mục (tối thiểu hay không), và định mức, báo cáo tính theo đó chứ không theo tên.
     *
     * <ul>
     *   <li>Thiết bị trong danh mục: tài sản sinh từ phiếu ghi tăng thì khoá (sai thì ghi giảm rồi ghi tăng lại);
     *       tài sản khai tay (số dư đầu kỳ) được đổi theo {@link #requireCatalogFits}.</li>
     *   <li>Loại tài sản, dạng thiết bị: đi theo thiết bị trong danh mục, không đổi riêng.</li>
     *   <li>Đơn vị tính, năm đưa vào sử dụng, nguyên giá, ngày tiếp nhận, ngày mua (năm trong mã), nguồn hình thành,
     *       hình thức mua sắm, nguồn kinh phí: thông tin chứng từ — có rồi thì không sửa.</li>
     * </ul>
     */
    private static void requireRecordFieldsKept(Equipment item, EquipmentPatchRequest r) {
        List<String> changed = new ArrayList<>();
        boolean catalogChanging = present(r.catalog()) && item.getCatalog() != null
                && !r.catalog().id().equals(item.getCatalog().getId());
        // Thiết bị trong danh mục của Sở: tên theo danh mục, không đổi (trưởng nhóm 15/11/2026). Đồ ngoài danh mục của
        // trường (`ownerSchool` có) thì trường tự đặt tên.
        if (!catalogChanging && item.getCatalog() != null && item.getCatalog().getOwnerSchool() == null
                && r.name() != null && !r.name().trim().replaceAll("\\s+", " ").equals(item.getName())) {
            throw new FieldValidationException("name", "Thiết bị trong danh mục giữ tên theo danh mục, không sửa tên");
        }
        if (catalogChanging && item.getIntakeLine() != null) {
            changed.add("thiết bị trong danh mục (ghi giảm rồi ghi tăng đúng thiết bị)");
        }
        if (!catalogChanging) {
            kept(changed, "phân loại kế toán", item.getAssetCategory(), r.assetCategory());
            kept(changed, "dạng thiết bị", item.getPhysicalOrDigital(), r.physicalOrDigital());
        }
        keptRef(changed, "đơn vị tính", item.getUnit() == null ? null : item.getUnit().getId(), r.unit());
        kept(changed, "năm đưa vào sử dụng", item.getUsageStartYear(), r.usageStartYear());
        if (item.getOriginalValue() != null && r.originalValue() != null
                && item.getOriginalValue().compareTo(r.originalValue()) != 0) {
            changed.add("nguyên giá");
        }
        kept(changed, "ngày tiếp nhận", item.getReceivedDate(), r.receivedDate());
        kept(changed, "ngày mua", item.getPurchaseDate(), r.purchaseDate());
        keptRef(changed, "nguồn hình thành", item.getOriginSource() == null ? null : item.getOriginSource().getId(),
                r.originSource());
        keptRef(changed, "hình thức mua sắm",
                item.getAcquisitionMethod() == null ? null : item.getAcquisitionMethod().getId(), r.acquisitionMethod());
        kept(changed, "nguồn kinh phí", item.getFundingSource(), r.fundingSource());
        if (!changed.isEmpty()) {
            throw new FieldValidationException("status", "Không sửa được: " + String.join(", ", changed) + ". "
                    + (item.getIntakeLine() != null ? "Đây là thông tin theo phiếu ghi tăng" : "Đây là thông tin đã khai trong hệ thống")
                    + " — chỉ bổ sung khi còn trống.");
        }
    }

    /** Ô đã có giá trị mà bản gửi lên khác — {@code null} gửi lên là để nguyên. */
    private static void kept(List<String> out, String label, Object current, Object next) {
        if (current != null && next != null && !current.equals(next)) {
            out.add(label);
        }
    }

    private static void keptRef(List<String> out, String label, Long current, IdRef next) {
        if (current != null && next != null && !current.equals(next.id())) {
            out.add(label);
        }
    }

    /**
     * Đổi "thiết bị trong danh mục" trên hồ sơ chỉ khi mã và cách quản lý vẫn đúng: cùng cách quản lý (từng cái / theo
     * số lượng — đổi là một tài sản thành một lô, hay ngược lại), và với tài sản đã mang mã chuẩn thì cùng phần MH
     * (môn) của mã — khác môn là tem nói một môn, sổ và định mức tính cho môn khác.
     */
    private void requireCatalogFits(Equipment item, EquipmentPatchRequest request) {
        if (!present(request.catalog()) || item.getCatalog() == null
                || request.catalog().id().equals(item.getCatalog().getId())) {
            return;
        }
        EquipmentCatalog next = catalogs.get(request.catalog().id());
        catalogs.requireOwnedBy(next, item.getSchool(), 0);
        if (next.getTrackingType() != item.getCatalog().getTrackingType()) {
            throw new FieldValidationException("catalog",
                    "Không đổi được sang mục danh mục có cách quản lý khác (từng cái / theo lô) — ghi giảm thiết bị này"
                            + " rồi ghi tăng đúng mục danh mục");
        }
        if (item.getCode() != null && Equipment.STANDARD_CODE.matcher(item.getCode()).matches()) {
            String subject = item.getCode().split("\\.")[2];
            String nextSubject = next.getSubject() == null || next.getSubject().getTeachingCode() == null
                    ? "00" : next.getSubject().getTeachingCode().trim();
            if (!subject.equals(nextSubject)) {
                throw new FieldValidationException("catalog",
                        "Thiết bị đã mang mã chuẩn %s (môn %s) — chỉ đổi được sang mục danh mục cùng môn. Mục khác môn thì"
                                .formatted(item.getCode(), subject)
                                + " ghi giảm thiết bị này rồi ghi tăng đúng mục danh mục");
            }
        }
    }

    @Override
    protected void applyUpdateOwned(Equipment item, EquipmentPatchRequest request) {
        if (request.name() != null) {
            item.setName(item.getName().replaceAll("\\s+", " "));
        }
        // Chụp những trường mà lịch sử theo dõi TRƯỚC khi sửa, để so sau khi
        // sửa: sửa tay trên hồ sơ cũng là một lần tài sản đổi chỗ, đổi người
        // giữ hay đổi tình trạng, và phải để lại vết như một phiếu.
        String roomBefore = EquipmentLifecycle.roomLabel(item.getRoom());
        String managerBefore = EquipmentLifecycle.staffLabel(item.getManager());
        String statusBefore = EquipmentLifecycle.statusLabel(item.getStatus());
        String conditionBefore = EquipmentLifecycle.conditionLabel(item.getCondition());
        boolean unplaced = item.getRoom() == null;
        String serialBefore = normalizeSerial(item.getSerialNumber());
        DateFacts datesBefore = DateFacts.of(item);
        applyPatch(item, request);
        String serialAfter = normalizeSerial(item.getSerialNumber());
        if (serialAfter != null && !serialAfter.equals(serialBefore)) {
            requireUniqueSerial(item);
        }
        requireDatesConsistent(item, datesBefore);
        requireSameSchool(item);
        if (unplaced && item.getRoom() != null) {
            holds.requireNotHeld(item.getId(), "xếp chỗ");
        }
        // Xếp chỗ lần đầu: trạng thái theo chỗ vừa xếp, như lúc khai tay (kho → trong kho,
        // phòng → đang sử dụng) — chỉ khi tài sản đang ở một trong hai trạng thái đó.
        if (unplaced && item.getRoom() != null
                && (item.getStatus() == AssetStatus.IN_STOCK || item.getStatus() == AssetStatus.IN_USE)) {
            item.setStatus(isStoreroom(item.getRoom()) ? AssetStatus.IN_STOCK : AssetStatus.IN_USE);
        }
        String note = "Sửa trên hồ sơ thiết bị";
        history.change(item, EquipmentHistory.Action.CAP_NHAT, "room", roomBefore,
                EquipmentLifecycle.roomLabel(item.getRoom()), null, note);
        history.change(item, EquipmentHistory.Action.CAP_NHAT, "manager", managerBefore,
                EquipmentLifecycle.staffLabel(item.getManager()), null, note);
        history.change(item, EquipmentHistory.Action.CAP_NHAT, "status", statusBefore,
                EquipmentLifecycle.statusLabel(item.getStatus()), null, note);
        history.change(item, EquipmentHistory.Action.CAP_NHAT, "condition", conditionBefore,
                EquipmentLifecycle.conditionLabel(item.getCondition()), null, note);
    }

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Các mốc năm / ngày của một hồ sơ, chụp trước khi sửa để biết lần sửa này chạm vào mốc nào. */
    private record DateFacts(Integer productionYear, Integer usageStartYear, LocalDate purchaseDate,
                             LocalDate receivedDate, LocalDate warrantyExpiry, LocalDate expiryDate) {
        static DateFacts of(Equipment item) {
            return new DateFacts(item.getProductionYear(), item.getUsageStartYear(), item.getPurchaseDate(),
                    item.getReceivedDate(), item.getWarrantyExpiry(), item.getExpiryDate());
        }
    }

    /**
     * Ràng buộc giữa các mốc năm / ngày khi sửa trên hồ sơ — chỉ kiểm luật có mốc VỪA ĐỔI, để hồ sơ cũ (nhập từ MISA,
     * số dư đầu kỳ) lỡ lệch vẫn sửa được tên, ghi chú… mà không bị chặn vì một mốc người sửa không chạm vào. Không
     * đặt ở lúc tạo: nhập dữ liệu đầu vào cũng tạo qua {@code create}, và dữ liệu cũ sai mốc không được làm hỏng cả tệp.
     *
     * <ul>
     *   <li>Năm sản xuất không sau năm đưa vào sử dụng.</li>
     *   <li>Hết hạn bảo hành sau ngày mua (chưa có ngày mua thì sau ngày tiếp nhận); ngày đã qua vẫn được — bảo hành
     *       hết rồi.</li>
     *   <li>Hạn sử dụng của lô vật tư, hoá chất sau ngày tiếp nhận.</li>
     * </ul>
     */
    private static void requireDatesConsistent(Equipment item, DateFacts before) {
        DateFacts now = DateFacts.of(item);
        if (now.productionYear() != null && now.usageStartYear() != null
                && now.productionYear() > now.usageStartYear()
                && (!Objects.equals(now.productionYear(), before.productionYear())
                    || !Objects.equals(now.usageStartYear(), before.usageStartYear()))) {
            throw new FieldValidationException("productionYear",
                    "Năm sản xuất không được sau năm đưa vào sử dụng (" + now.usageStartYear() + ")");
        }
        LocalDate bought = now.purchaseDate() != null ? now.purchaseDate() : now.receivedDate();
        LocalDate boughtBefore = before.purchaseDate() != null ? before.purchaseDate() : before.receivedDate();
        if (now.warrantyExpiry() != null && bought != null && !now.warrantyExpiry().isAfter(bought)
                && (!Objects.equals(now.warrantyExpiry(), before.warrantyExpiry()) || !Objects.equals(bought, boughtBefore))) {
            throw new FieldValidationException("warrantyExpiry", "Hết hạn bảo hành phải sau "
                    + (now.purchaseDate() != null ? "ngày mua" : "ngày tiếp nhận") + " (" + DAY.format(bought) + ")");
        }
        if (now.expiryDate() != null && now.receivedDate() != null && !now.expiryDate().isAfter(now.receivedDate())
                && (!Objects.equals(now.expiryDate(), before.expiryDate())
                    || !Objects.equals(now.receivedDate(), before.receivedDate()))) {
            throw new FieldValidationException("expiryDate",
                    "Hạn sử dụng phải sau ngày tiếp nhận (" + DAY.format(now.receivedDate()) + ")");
        }
    }

    private void applyPatch(Equipment item, EquipmentPatchRequest request) {
        if (present(request.catalog())) {
            item.setCatalog(catalogs.get(request.catalog().id()));
            catalogs.requireOwnedBy(item.getCatalog(), item.getSchool(), 0);
        }
        if (request.physicalOrDigital() != null) {
            item.setPhysicalOrDigital(request.physicalOrDigital());
        }
        if (request.assetCategory() != null) {
            item.setAssetCategory(request.assetCategory());
        }
        if (request.serialNumber() != null) {
            item.setSerialNumber(blankToNull(FieldRule.SERIAL.normalize(request.serialNumber())));
        }
        if (request.model() != null) {
            item.setModel(blankToNull(request.model()));
        }
        if (request.manufacturer() != null) {
            item.setManufacturer(blankToNull(request.manufacturer()));
        }
        if (request.otherInfo() != null) {
            item.setOtherInfo(blankToNull(request.otherInfo()));
        }
        if (request.unit() != null) {
            item.setUnit(ref(request.unit(), units::get));
        }
        if (request.quantity() != null) {
            item.setQuantity(request.quantity());
            requireQuantityFitsUnit(item);
        }
        // Form sửa gửi lại cả ba ô nguồn dù không đụng tới: chỉ đối chiếu khi một ô THẬT SỰ đổi, để hồ sơ
        // cũ mang cặp giá trị chưa khớp vẫn sửa được những thứ khác.
        OriginSource originBefore = item.getOriginSource();
        FundingSource fundingBefore = item.getFundingSource();
        if (request.originSource() != null) {
            item.setOriginSource(ref(request.originSource(), originSources::get));
        }
        if (request.acquisitionMethod() != null) {
            item.setAcquisitionMethod(ref(request.acquisitionMethod(), acquisitionMethods::get));
        }
        if (request.fundingSource() != null) {
            item.setFundingSource(request.fundingSource());
        }
        if (item.getOriginSource() != originBefore || item.getFundingSource() != fundingBefore) {
            requireSourcesFit(item);
        }
        if (request.productionYear() != null) {
            item.setProductionYear(request.productionYear());
        }
        if (request.usageStartYear() != null) {
            item.setUsageStartYear(request.usageStartYear());
        }
        if (request.receivedDate() != null) {
            item.setReceivedDate(request.receivedDate());
        }
        if (request.purchaseDate() != null) {
            item.setPurchaseDate(request.purchaseDate());
        }
        if (request.originalValue() != null) {
            item.setOriginalValue(request.originalValue());
        }
        if (request.remainingValue() != null) {
            item.setRemainingValue(request.remainingValue());
        } else if (request.originalValue() != null && item.getRemainingValue() == null) {
            // Bổ sung nguyên giá cho hồ sơ chưa có: còn lại bằng nguyên giá, như lúc khai mới.
            item.setRemainingValue(request.originalValue());
        }
        if (request.warrantyExpiry() != null) {
            item.setWarrantyExpiry(request.warrantyExpiry());
        }
        if (request.expiryDate() != null && bulk(item)) {
            item.setExpiryDate(request.expiryDate());
        }
        if (request.room() != null) {
            item.setRoom(ref(request.room(), rooms::get));
        }
        if (request.manager() != null) {
            item.setManager(ref(request.manager(), staff::get));
        }
        if (request.condition() != null) {
            item.setCondition(request.condition());
        }
        if (request.status() != null) {
            if (request.status() != item.getStatus()
                    && (request.status() == AssetStatus.UNREPAIRABLE || item.getStatus() == AssetStatus.UNREPAIRABLE)) {
                throw new FieldValidationException("status",
                        "Trạng thái không sửa được chỉ thay đổi qua phiếu sửa chữa và phiếu ghi giảm");
            }
            item.setStatus(request.status());
        }
        if (request.config() != null) {
            item.setConfig(ref(request.config(), configs::get));
        }
        if (request.config() != null || request.specs() != null) {
            item.setSpecs(checkedSpecs(item.getConfig(),
                    request.specs() != null ? request.specs() : item.getSpecs()));
        }
        requireRules(item);
    }

    /**
     * Sinh N tài sản từ một dòng phiếu nhập — vế "theo từng cái" của việc ghi
     * tăng. Gọi từ slice phiếu nhập, trong giao dịch xác nhận của nó.
     *
     * <p>Ở đây, chứ không ở slice phiếu: dựng một thiết bị đúng cách là việc
     * của feature thiết bị, và bộ đếm mã cũng sống ở đây. Phiếu chỉ nói "dòng
     * này, ngần này cái".
     *
     * <p>Mỗi cái nhận MỘT mã riêng theo chuẩn của Sở; thiếu dữ liệu để sinh mã
     * thì cả lần xác nhận bị từ chối, nêu rõ dòng nào và thiếu gì. Đó là lựa
     * chọn có giá: người dùng phải đi bổ sung mã EMIS của trường rồi quay lại.
     * Phương án kia — cấp một mã tạm — thì 50 tài sản mang mã không đúng chuẩn
     * sẽ đi tiếp vào mọi báo cáo, và không ai biết phải sửa cái nào.
     */
    @Transactional
    public List<Equipment> generateFromIntakeLine(EquipmentIntakeLine line) {
        EquipmentIntake intake = line.getIntake();
        School school = intake.getSchool();
        Integer warranty = line.effectiveWarrantyMonths();
        LocalDate received = receivedDateOf(line);
        LocalDate warrantyExpiry = warranty == null ? null : received.plusMonths(warranty);

        // Cả dòng chung một bộ mã (trường, môn, loại, năm): chốt N số trong MỘT câu thay vì N câu.
        List<String> reserved = reserveCodes(school, line, line.getReceivedQuantity());
        // Số serial khai lúc lập phiếu (đã kiểm không trùng trong trường): cái thứ i nhận số thứ i, phần còn lại để trống.
        List<String> serials = line.serialSlots();
        // Phòng riêng của từng cái (255): cái nào có thì về đúng phòng đó, còn lại theo phòng nhận của dòng.
        List<Long> unitRooms = line.unitRoomSlots();
        java.util.Map<Long, com.g123.sfems.domain.school.facility.Room> unitRoomCache = new java.util.HashMap<>();
        List<Equipment> created = new ArrayList<>();
        for (int i = 0; i < line.getReceivedQuantity(); i++) {
            Equipment item = new Equipment();
            com.g123.sfems.domain.school.facility.Room room = i < unitRooms.size() && unitRooms.get(i) != null
                    ? unitRoomCache.computeIfAbsent(unitRooms.get(i), rooms::get) : line.getRoom();
            item.setSchool(school);
            item.setCatalog(line.getCatalog());
            item.setName(line.getName());
            item.setCode(reserved.get(i));
            item.setSerialNumber(i < serials.size() && !serials.get(i).isEmpty() ? serials.get(i) : null);
            // Dòng phiếu nói trước, nhóm thiết bị đỡ phía sau: hai trường này
            // là tính chất của mặt hàng, nên nhóm đã khai thì dòng bỏ trống vẫn
            // ra tài sản đúng. Không có vế này thì mỗi lối vào (form, tệp nhập,
            // API) lại phải tự nhớ điền, và cái nào quên thì hồ sơ thiếu lặng lẽ.
            item.setPhysicalOrDigital(line.getPhysicalOrDigital() != null
                    ? line.getPhysicalOrDigital()
                    : line.getCatalog().getPhysicalOrDigital());
            item.setAssetCategory(line.getAssetCategory() != null
                    ? line.getAssetCategory()
                    : line.getCatalog().getAssetCategory());
            item.setUnit(line.getCatalog().getUnit());
            item.setQuantity(BigDecimal.ONE);
            // Nguồn hình thành là của phiếu; nguồn kinh phí và hình thức mua sắm là của dòng.
            item.setOriginSource(line.effectiveOriginSource());
            item.setAcquisitionMethod(line.effectiveAcquisitionMethod());
            item.setFundingSource(line.effectiveFundingSource());
            item.setOriginNote(intake.getOriginNote());
            item.setFundingNote(line.getFundingNote());
        item.setAcquisitionNote(line.getAcquisitionNote());
            item.setAcquisitionNote(line.getAcquisitionNote());
            item.setReceivedDate(received);
            // Model, hãng, bảo hành, thông tin khác: của riêng cái thứ i (256), không thì của dòng.
            Integer ownWarranty = line.warrantyMonthsOf(i);
            item.setWarrantyExpiry(ownWarranty == null ? null : received.plusMonths(ownWarranty));
            item.setModel(line.modelOf(i));
            item.setManufacturer(line.manufacturerOf(i));
            item.setOtherInfo(line.otherInfoOf(i));
            item.setUsageStartYear(received.getYear());
            // Nguyên giá = đơn giá của dòng; giá trị còn lại bằng nguyên giá
            // vì tài sản vừa về, chưa có kỳ khấu hao nào chạy qua.
            item.setOriginalValue(line.getUnitPrice());
            item.setRemainingValue(line.getUnitPrice());
            item.setRoom(room);
            // Về kho thì nằm trong tay thủ kho: người quản lý là cán bộ phụ trách phòng nhận.
            item.setManager(EquipmentLifecycle.keeperOf(null, room));
            item.setCondition(EquipmentCondition.TOT);
            // Nhập về kho thì là TRONG KHO, không phải đang sử dụng: chưa có
            // phiếu cấp phát nào, chưa ai giữ. Chỉ khi phiếu chỉ thẳng phòng
            // nhận thì tài sản mới bắt đầu ở trạng thái đang dùng.
            item.setStatus(isStoreroom(room) ? AssetStatus.IN_STOCK : AssetStatus.IN_USE);
            item.setIntakeLine(line);
            // Khoá IDENTITY: mỗi INSERT tài sản vẫn là một lượt đi về (Hibernate không gom lô được khi id
            // do CSDL cấp). Đổi sang SEQUENCE là một changelog đổi mọi bảng — chưa làm; phần gom được là
            // mã (một câu) và lịch sử (một lệnh JDBC gom lô) ở dưới.
            created.add(repository.persist(item));
        }
        VoucherRef intakeRef = new VoucherRef("equipment_intakes", intake.getId(), intake.getCode());
        history.eventAll(created, EquipmentHistory.Action.GHI_TANG, intakeRef,
                "Ghi tăng theo phiếu, dòng " + line.getLineNo());
        history.changeAll(created, EquipmentHistory.Action.GHI_TANG, "manager", null,
                saved -> EquipmentLifecycle.staffLabel(saved.getManager()), intakeRef, "Cán bộ phụ trách phòng nhận");
        // Đẩy xuống DB ngay: mã trùng hay ràng buộc hỏng phải nổ ở đây, khi còn
        // biết dòng phiếu nào gây ra, chứ không phải lúc giao dịch đóng lại.
        repository.flush();
        return created;
    }

    /**
     * Kho là "không có phòng" HOẶC một phòng thuộc loại Kho thiết bị. Trường nào
     * cũng khai kho như một phòng thật — nhập vào đó mà thành "đang sử dụng" thì
     * mọi báo cáo thiết bị đang dùng đếm cả hàng còn nằm trong kho.
     */
    /**
     * VẬT TƯ TIÊU HAO vào sổ: một dòng phiếu nhập sinh MỘT bản ghi thiết bị mang cả số lượng —
     * có mã chuẩn, tên, hồ sơ, lịch sử như mọi thiết bị; chỉ khác là đếm theo số lượng thay vì
     * mỗi cái một mã. Nguyên giá là giá trị cả lô (đơn giá × số lượng); giá trị còn lại giảm theo
     * số lượng khi xuất / tiêu hao.
     */
    @Transactional
    public Equipment generateLotFromIntakeLine(EquipmentIntakeLine line) {
        EquipmentIntake intake = line.getIntake();
        School school = intake.getSchool();
        // Số lượng vào sổ ĐÃ QUY ĐỔI theo đơn vị của thiết bị (QLTB-501): 5 lọ × 100 ml = 500 ml.
        BigDecimal quantity = line.stockQuantity();
        Equipment item = new Equipment();
        item.setSchool(school);
        item.setCatalog(line.getCatalog());
        item.setName(line.getName());
        item.setCode(reserveCode(school, line));
        item.setPhysicalOrDigital(line.getPhysicalOrDigital() != null
                ? line.getPhysicalOrDigital() : line.getCatalog().getPhysicalOrDigital());
        item.setAssetCategory(line.getAssetCategory() != null
                ? line.getAssetCategory() : line.getCatalog().getAssetCategory());
        item.setUnit(line.getCatalog().getUnit());
        item.setQuantity(quantity);
        // Quy cách bao bì của dòng đi theo lô: sau này nhập "3 lọ" là tự ra số theo đơn vị của lô.
        item.setPack(line.getPackUnit(), line.getPackSize());
        item.setOriginSource(line.effectiveOriginSource());
        item.setAcquisitionMethod(line.effectiveAcquisitionMethod());
        item.setFundingSource(line.effectiveFundingSource());
        item.setOriginNote(intake.getOriginNote());
        item.setFundingNote(line.getFundingNote());
        item.setReceivedDate(receivedDateOf(line));
        item.setPurchaseDate(line.effectiveDocumentDate());
        item.setUsageStartYear(receivedDateOf(line).getYear());
        item.setModel(line.getModel());
        item.setManufacturer(line.getManufacturer());
        item.setOtherInfo(line.getOtherInfo());
        item.setExpiryDate(line.getExpiryDate());
        // Đơn giá là giá của MỘT đơn vị trên hoá đơn (một lọ khi có quy cách) — nhân với số nhận, không với số đã quy đổi.
        BigDecimal total = line.getUnitPrice() == null ? null
                : line.getUnitPrice().multiply(BigDecimal.valueOf(line.getReceivedQuantity()));
        item.setOriginalValue(total);
        item.setRemainingValue(total);
        item.setRoom(line.getRoom());
        item.setManager(EquipmentLifecycle.keeperOf(null, line.getRoom()));
        item.setCondition(EquipmentCondition.TOT);
        item.setStatus(isStoreroom(line.getRoom()) ? AssetStatus.IN_STOCK : AssetStatus.IN_USE);
        item.setIntakeLine(line);
        Equipment saved = repository.persist(item);
        VoucherRef intakeRef = new VoucherRef("equipment_intakes", intake.getId(), intake.getCode());
        history.event(saved, EquipmentHistory.Action.GHI_TANG, intakeRef,
                "Ghi tăng %s %s theo phiếu, dòng %d".formatted(plain(quantity),
                        saved.getUnit() == null ? "" : saved.getUnit().getName(), line.getLineNo()));
        history.change(saved, EquipmentHistory.Action.GHI_TANG, "manager", null,
                EquipmentLifecycle.staffLabel(saved.getManager()), intakeRef, "Cán bộ phụ trách phòng nhận");
        repository.flush();
        return saved;
    }

    /**
     * Trừ {@code amount} vật tư của (trường, mặt hàng, chỗ để) — xuất kho, ghi tiêu hao. Lấy từ lô
     * cũ trước (ngày tiếp nhận, rồi id); lô về 0 thành "đã dùng hết" và ra khỏi sổ nhưng giữ hồ
     * sơ và lịch sử. Không đủ thì từ chối cả thao tác, nêu số còn — âm kho là sổ nói có thứ không
     * tồn tại. Đọc KHÔNG qua phạm vi dòng: quyền ghi đã được kiểm ở phiếu gọi tới đây.
     */
    @Transactional
    public void consumeLot(School school, EquipmentCatalog catalog, Room room, BigDecimal amount,
            EquipmentHistory.Action action, VoucherRef ref, String where) {
        if (amount == null || amount.signum() <= 0) {
            throw new FieldValidationException("lines", where + ": số lượng phải lớn hơn 0");
        }
        if (!Unit.accepts(catalog.getUnit(), amount)) {
            throw new FieldValidationException("lines", "%s: %s tính theo %s — không chia lẻ được, nhập số nguyên"
                    .formatted(where, catalog.getName(), unitName(catalog.getUnit())));
        }
        Long roomId = room == null ? null : room.getId();
        List<Equipment> lots = repository.findAll((root, q, cb) -> cb.and(
                        cb.equal(root.get("school").get("id"), school.getId()),
                        cb.equal(root.get("catalog").get("id"), catalog.getId()),
                        roomId == null ? cb.isNull(root.get("room")) : cb.equal(root.get("room").get("id"), roomId),
                        cb.greaterThan(root.get("quantity"), BigDecimal.ZERO),
                        root.get("status").in(AssetStatus.IN_STOCK, AssetStatus.IN_USE)),
                Sort.by("receivedDate", "id"));
        // Khoá các lô (theo id, để hai phiếu không khoá chéo nhau) rồi đọc lại số lượng: đọc không khoá thì hai phiếu
        // xuất song song cùng thấy đủ, và lần ghi sau đè số của lần ghi trước — xuất 14 từ 10 mà sổ còn 4.
        lots.stream().sorted(Comparator.comparing(Equipment::getId))
                .forEach(lot -> em.refresh(lot, LockModeType.PESSIMISTIC_WRITE));
        lots = lots.stream().filter(lot -> lot.getQuantity() != null && lot.getQuantity().signum() > 0
                && (lot.getStatus() == AssetStatus.IN_STOCK || lot.getStatus() == AssetStatus.IN_USE)).toList();
        BigDecimal have = lots.stream().map(Equipment::getQuantity).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (have.compareTo(amount) < 0) {
            throw new FieldValidationException("lines", "%s: %s %s chỉ còn %s, không đủ %s".formatted(
                    where, catalog.getName(), room == null ? "trong kho" : "ở " + room.getName(), plain(have), plain(amount)));
        }
        BigDecimal left = amount;
        for (Equipment lot : lots) {
            if (left.signum() <= 0) {
                break;
            }
            BigDecimal before = lot.getQuantity();
            BigDecimal take = before.min(left);
            BigDecimal after = before.subtract(take);
            if (lot.getRemainingValue() != null && before.signum() > 0) {
                lot.setRemainingValue(lot.getRemainingValue().multiply(after).divide(before, 0, RoundingMode.HALF_UP));
            }
            lot.setQuantity(after);
            if (after.signum() == 0) {
                lot.setStatus(AssetStatus.USED_UP);
            }
            history.change(lot, action, "quantity", plain(before), plain(after), ref,
                    "%s: lấy %s, còn %s".formatted(where, plain(take), plain(after)));
            repository.persist(lot);
            left = left.subtract(take);
        }
    }

    /** Trừ đúng lô ghi trên phiếu tiêu hao, không tự chuyển sang lô cùng loại. */
    @Transactional
    public void consumeSelectedLot(School school, Equipment lot, BigDecimal amount,
            EquipmentHistory.Action action, VoucherRef ref, String where) {
        if (!lot.getSchool().getId().equals(school.getId())
                || lot.getCatalog().getTrackingType() != TrackingType.BULK
                || (lot.getStatus() != AssetStatus.IN_STOCK && lot.getStatus() != AssetStatus.IN_USE)) {
            throw new FieldValidationException("equipment", "Lô vật tư đã chọn không còn dùng được cho phiếu tiêu hao");
        }
        Unit unit = lot.getUnit() != null ? lot.getUnit() : lot.getCatalog().getUnit();
        if (amount == null || amount.signum() <= 0 || !Unit.accepts(unit, amount)) {
            throw new FieldValidationException("quantity",
                    "Số lượng tiêu hao không hợp lệ với đơn vị của lô " + lot.getCode());
        }
        BigDecimal before = lot.getQuantity();
        if (before == null || before.compareTo(amount) < 0) {
            throw new FieldValidationException("quantity", "%s: lô %s chỉ còn %s %s, không đủ %s".formatted(
                    where, lot.getCode(), before == null ? "0" : plain(before),
                    unitName(unit), plain(amount)));
        }
        BigDecimal after = before.subtract(amount);
        if (lot.getRemainingValue() != null) {
            lot.setRemainingValue(lot.getRemainingValue().multiply(after).divide(before, 0, RoundingMode.HALF_UP));
        }
        lot.setQuantity(after);
        if (after.signum() == 0) {
            lot.setStatus(AssetStatus.USED_UP);
        }
        history.change(lot, action, "quantity", plain(before), plain(after), ref,
                "%s: lấy %s, còn %s".formatted(where, plain(amount), plain(after)));
        repository.persist(lot);
    }

    /** Chia lô khi chỉ bàn giao một phần: lô gốc giữ phần còn lại, phần giao có mã riêng ở phòng nhận. */
    @Transactional
    public Equipment transferLot(Equipment source, BigDecimal amount, Room target,
            Staff receiver, AssetStatus targetStatus,
            EquipmentHistory.Action action, VoucherRef ref, String note) {
        BigDecimal before = source.getQuantity();
        if (source.getCatalog().getTrackingType() != TrackingType.BULK || amount == null
                || amount.signum() <= 0 || amount.compareTo(before) >= 0) {
            throw new FieldValidationException("lines", "Chỉ tách được một phần của lô vật tư còn tồn");
        }
        var parts = codes.parts(source.getSchool(), source.getCatalog(), source.getPhysicalOrDigital(),
                source.getReceivedDate(), source.getPurchaseDate())
                .orElseThrow(() -> new FieldValidationException("lines", "Không sinh được mã cho phần vật tư bàn giao"));
        String newCode = codes.reserve(source.getSchool(), parts)
                .orElseThrow(() -> new FieldValidationException("lines", "Đã hết mã thiết bị cho phần vật tư bàn giao"));

        Equipment moved = new Equipment();
        moved.setSchool(source.getSchool());
        moved.setCode(newCode);
        moved.setName(source.getName());
        moved.setSortOrder(source.getSortOrder());
        moved.setActive(source.getActive());
        moved.setNote(source.getNote());
        moved.setCatalog(source.getCatalog());
        moved.setPhysicalOrDigital(source.getPhysicalOrDigital());
        moved.setAssetCategory(source.getAssetCategory());
        moved.setModel(source.getModel());
        moved.setManufacturer(source.getManufacturer());
        moved.setOtherInfo(source.getOtherInfo());
        moved.setUnit(source.getUnit());
        moved.setQuantity(amount);
        moved.setOriginSource(source.getOriginSource());
        moved.setAcquisitionMethod(source.getAcquisitionMethod());
        moved.setFundingSource(source.getFundingSource());
        moved.setOriginNote(source.getOriginNote());
        moved.setFundingNote(source.getFundingNote());
        moved.setAcquisitionNote(source.getAcquisitionNote());
        moved.setProductionYear(source.getProductionYear());
        moved.setUsageStartYear(source.getUsageStartYear());
        moved.setReceivedDate(source.getReceivedDate());
        moved.setPurchaseDate(source.getPurchaseDate());
        moved.setWarrantyExpiry(source.getWarrantyExpiry());
        moved.setExpiryDate(source.getExpiryDate());
        moved.setRoom(target);
        moved.setManager(EquipmentLifecycle.keeperOf(receiver, target));
        moved.setCondition(source.getCondition());
        moved.setStatus(targetStatus);
        moved.setConfig(source.getConfig());
        moved.setSpecs(source.getSpecs());
        moved.setIntakeLine(source.getIntakeLine());
        moved.setPack(source.getPackUnit(), source.getPackSize());

        BigDecimal after = before.subtract(amount);
        if (source.getOriginalValue() != null) {
            BigDecimal movedValue = source.getOriginalValue().multiply(amount)
                    .divide(before, 2, RoundingMode.HALF_UP);
            moved.setOriginalValue(movedValue);
            BigDecimal keptValue = source.getOriginalValue().subtract(movedValue);
            history.change(source, action, "originalValue", source.getOriginalValue().toPlainString(),
                    keptValue.toPlainString(), ref, note);
            source.setOriginalValue(keptValue);
        }
        if (source.getRemainingValue() != null) {
            BigDecimal movedValue = source.getRemainingValue().multiply(amount)
                    .divide(before, 2, RoundingMode.HALF_UP);
            moved.setRemainingValue(movedValue);
            BigDecimal keptValue = source.getRemainingValue().subtract(movedValue);
            history.change(source, action, "remainingValue", source.getRemainingValue().toPlainString(),
                    keptValue.toPlainString(), ref, note);
            source.setRemainingValue(keptValue);
        }
        String unit = unitName(source.getUnit() != null ? source.getUnit() : source.getCatalog().getUnit());
        history.change(source, action, "quantity", before.stripTrailingZeros().toPlainString(),
                after.stripTrailingZeros().toPlainString(), ref,
                note + ": giao " + amount.stripTrailingZeros().toPlainString() + " " + unit);
        source.setQuantity(after);
        repository.persist(source);
        Equipment saved = repository.persist(moved);
        history.event(saved, action, ref,
                note + ": nhận " + amount.stripTrailingZeros().toPlainString() + " " + unit
                        + " từ lô " + source.getCode());
        return saved;
    }

    /** Số lượng lẻ chỉ khi đơn vị tính của tài sản (hoặc của mặt hàng) chia được. */
    private static void requireQuantityFitsUnit(Equipment item) {
        Unit unit = item.getUnit() != null ? item.getUnit() : item.getCatalog() == null ? null : item.getCatalog().getUnit();
        if (!Unit.accepts(unit, item.getQuantity())) {
            throw new FieldValidationException("quantity",
                    "Đơn vị %s không chia lẻ được — nhập số nguyên".formatted(unitName(unit)));
        }
    }

    private static String unitName(Unit unit) {
        return unit == null ? "(chưa có đơn vị tính)" : unit.getName();
    }

    /** 12.000 → "12", 0.250 → "0.25": số lượng đọc như người viết. */
    private static String plain(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    /** Phòng và người giữ phải thuộc CHÍNH trường của tài sản. */
    private static void requireSameSchool(Equipment item) {
        Long school = item.getSchool() == null ? null : item.getSchool().getId();
        if (item.getRoom() != null && item.getRoom().getSchool() != null
                && !item.getRoom().getSchool().getId().equals(school)) {
            throw new FieldValidationException("room", "Phòng không thuộc trường của thiết bị");
        }
        if (item.getManager() != null && item.getManager().getSchool() != null
                && !item.getManager().getSchool().getId().equals(school)) {
            throw new FieldValidationException("manager", "Cán bộ không thuộc trường của thiết bị");
        }
    }

    /** Vật tư tiêu hao, hoá chất — chỉ chúng mang hạn sử dụng. */
    private static boolean bulk(Equipment item) {
        return item.getCatalog() != null && item.getCatalog().getTrackingType() == TrackingType.BULK;
    }

    public static boolean isStoreroom(Room room) {
        return room == null
                || (room.getRoomType() != null && "KHO".equals(room.getRoomType().getCode()));
    }

    /**
     * Phiếu này cần bao nhiêu mã, bộ đếm còn bao nhiêu — hỏi TRƯỚC khi ghi tăng.
     *
     * <p>Không có bước này thì một phiếu 100 máy đi qua lập, trình, và chỉ đổ ở
     * câu {@code reserve} cuối cùng, tức là dưới tay người duyệt: giao dịch cuộn
     * lại sạch nhưng phiếu kẹt ở "chờ duyệt" và không ai sửa được nữa (phiếu đã
     * trình thì phải trả lại mới sửa). Hỏi lúc trình thì người lập còn tách được
     * phiếu.
     *
     * <p><b>Gộp theo bộ đếm, không theo dòng</b>, vì nhiều dòng dùng chung một
     * bộ: mã không chứa nhóm thiết bị, chỉ chứa MÔN của nhóm — nên máy tính để
     * bàn và máy tính xách tay của cùng một trường, cùng một năm, đều ăn vào
     * {@code 79.JP.00.TB.26} nếu cả hai chưa gắn môn. Kiểm từng dòng riêng lẻ sẽ
     * cho qua một phiếu 60 + 60 mà bộ đếm chỉ còn 99.
     */
    public void checkCodeCapacity(EquipmentIntake intake) {
        Map<String, Integer> needed = new LinkedHashMap<>();
        Map<String, EquipmentCodeService.CodeParts> byKey = new LinkedHashMap<>();
        Map<String, String> firstLine = new LinkedHashMap<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getReceivedQuantity() == null || line.getReceivedQuantity() <= 0) {
                continue;
            }
            // Từng cái: mỗi cái một mã. Vật tư tiêu hao: cả dòng một mã (một bản ghi có số lượng).
            int codesNeeded = line.getCatalog().getTrackingType() == TrackingType.SERIAL ? line.getReceivedQuantity() : 1;
            var parts = codes.parts(intake.getSchool(), line.getCatalog(), line.getPhysicalOrDigital(),
                            intake.getIntakeDate(), line.effectiveDocumentDate())
                    .orElseThrow(() -> new FieldValidationException("lines",
                            "Dòng %d (%s): chưa sinh được mã thiết bị — trường chưa có mã EMIS hoặc môn của nhóm thiết bị chưa có mã dạy học"
                                    .formatted(line.getLineNo(), line.getName())));
            String key = parts.counterKey();
            byKey.putIfAbsent(key, parts);
            firstLine.putIfAbsent(key, "Dòng %d (%s)".formatted(line.getLineNo(), line.getName()));
            needed.merge(key, codesNeeded, Integer::sum);
        }
        for (Map.Entry<String, Integer> e : needed.entrySet()) {
            var parts = byKey.get(e.getKey());
            int left = codes.remaining(intake.getSchool(), parts);
            if (e.getValue() > left) {
                throw new FieldValidationException("lines",
                        ("%s: cần %d mã thiết bị nhưng bộ mã %s chỉ còn %d. "
                                + "Số thứ tự trong mã có ba chữ số nên mỗi bộ chứa tối đa 999 thiết bị một năm. "
                                + "Tách bớt số lượng sang phiếu khác, hoặc khai mã dạy học của môn cho nhóm thiết bị "
                                + "để nhóm có bộ đếm riêng.")
                                .formatted(firstLine.get(e.getKey()), e.getValue(), parts.mask(), left));
            }
        }
    }

    /**
     * Ngày nhận hàng của thiết bị = ngày hoá đơn (chứng từ) của dòng (trưởng nhóm 14/11/2026); dòng không có chứng từ
     * (tự làm, kiểm kê thừa…) thì ngày ghi tăng — ngày phiếu được duyệt. Bảo hành và năm bắt đầu sử dụng tính từ đây.
     */
    private static LocalDate receivedDateOf(EquipmentIntakeLine line) {
        LocalDate document = line.effectiveDocumentDate();
        return document != null ? document : line.getIntake().getIntakeDate();
    }

    /** {@link #reserveCode} cho {@code count} tài sản của cùng một dòng, một câu. */
    private List<String> reserveCodes(School school, EquipmentIntakeLine line, int count) {
        var parts = codes.parts(school, line.getCatalog(), line.getPhysicalOrDigital(),
                        line.getIntake().getIntakeDate(), line.effectiveDocumentDate())
                .orElseThrow(() -> new FieldValidationException("lines",
                        "Dòng %d: chưa sinh được mã thiết bị — trường chưa có mã EMIS hoặc môn của nhóm thiết bị chưa có mã dạy học"
                                .formatted(line.getLineNo())));
        return codes.reserveBlock(school, parts, count)
                .orElseThrow(() -> new FieldValidationException("lines",
                        "Dòng %d: đã hết số thứ tự 001-999 cho bộ mã này, không sinh thêm thiết bị được"
                                .formatted(line.getLineNo())));
    }

    private String reserveCode(School school, EquipmentIntakeLine line) {
        var parts = codes.parts(school, line.getCatalog(), line.getPhysicalOrDigital(),
                        line.getIntake().getIntakeDate(), line.effectiveDocumentDate())
                .orElseThrow(() -> new FieldValidationException("lines",
                        "Dòng %d: chưa sinh được mã thiết bị — trường chưa có mã EMIS hoặc môn của nhóm thiết bị chưa có mã dạy học"
                                .formatted(line.getLineNo())));
        return codes.reserve(school, parts)
                .orElseThrow(() -> new FieldValidationException("lines",
                        "Dòng %d: đã hết số thứ tự 001-999 cho bộ mã này, không sinh thêm thiết bị được"
                                .formatted(line.getLineNo())));
    }

    /**
     * Lọc thêm: {@code catalog.id}, {@code room.id}, {@code manager.id},
     * {@code intake.id} và {@code profileComplete}.
     *
     * <p>Hai cái cuối không phải cột nào cả. {@code intake.id} đi qua dòng phiếu
     * (hai chặng khoá ngoại) để màn phiếu liệt kê được tài sản nó đã sinh ra, và
     * {@code profileComplete} là câu hỏi "hồ sơ đã đủ chưa" — vốn là một điều
     * kiện phụ thuộc cách quản lý của nhóm thiết bị chứ không phải một ô để so
     * sánh. Cùng kiểu với cột "quá hạn" của một danh sách công việc: tính ở
     * server, lọc ở server, nên màn "Tài sản chưa hoàn thiện hồ sơ" không phải
     * tải cả bảng về rồi tự lọc.
     */
    /** Bảng thiết bị sắp được thêm theo trạng thái, tình trạng, số lượng, số serial, hạn dùng, năm sản xuất. */
    private static final Set<String> SORTABLE = Set.of("id", "code", "name", "sortOrder", "active", "createdAt", "updatedAt",
            "status", "condition", "quantity", "serialNumber", "expiryDate", "productionYear", "usageStartYear");

    @Override
    protected Set<String> sortable() {
        return SORTABLE;
    }

    @Override
    protected Specification<Equipment> ownedFilters(ListParams params) {
        List<Specification<Equipment>> specs = new ArrayList<>(List.of(
                CatalogSpecifications.<Equipment>referenceFilter(params, "catalog"),
                CatalogSpecifications.<Equipment>referenceFilter(params, "room"),
                CatalogSpecifications.<Equipment>referenceFilter(params, "manager"),
                CatalogSpecifications.<Equipment>referenceFilter(params, "intakeLine")));

        for (ListParams.Criterion criterion : params.filters()) {
            if (criterion.field().equals("intake.id")) {
                Long id = parseLong(criterion.value());
                specs.add(id == null
                        ? (root, query, cb) -> cb.disjunction()
                        : (root, query, cb) -> cb.equal(
                                root.join("intakeLine", JoinType.LEFT).join("intake", JoinType.LEFT).get("id"), id));
            } else if (criterion.field().equals("status") || criterion.field().equals("condition")) {
                // Nhiều giá trị ngăn bằng dấu phẩy: ô chọn tài sản của phiếu hỏi
                // "những cái đang trong kho HOẶC đang dùng". Giá trị lạ thì rỗng.
                specs.add(enumIn(criterion.field(), criterion.value(), criterion.operator() == ListParams.Operator.NE));
            } else if (criterion.field().equals("catalogTree")) {
                // Chọn một nhóm trên cây = nhóm đó VÀ mọi nhóm con cháu, như cây của Jmix.
                Long id = parseLong(criterion.value());
                List<Long> ids = id == null ? List.of() : catalogs.subtreeIds(id);
                specs.add(ids.isEmpty()
                        ? (root, query, cb) -> cb.disjunction()
                        : (root, query, cb) -> root.get("catalog").get("id").in(ids));
            } else if (criterion.field().equals("catalogType")) {
                // Chọn một LOẠI thiết bị trên cây = mọi tài sản mà mặt hàng của nó thuộc loại đó;
                // "none" = mặt hàng chưa khai loại.
                String raw = criterion.value().trim();
                if (raw.equals("none")) {
                    specs.add((root, query, cb) -> cb.isNull(root.get("catalog").get("equipmentType")));
                } else {
                    Long id = parseLong(raw);
                    specs.add(id == null
                            ? (root, query, cb) -> cb.disjunction()
                            : (root, query, cb) -> cb.equal(
                                    root.get("catalog").get("equipmentType").get("id"), id));
                }
            } else if (criterion.field().equals("subject")) {
                // Lọc theo MÔN của mặt hàng; "none" = mặt hàng chưa gắn môn.
                String raw = criterion.value().trim();
                if (raw.equals("none")) {
                    specs.add((root, query, cb) -> cb.isNull(root.get("catalog").get("subject")));
                } else {
                    Long id = parseLong(raw);
                    specs.add(id == null
                            ? (root, query, cb) -> cb.disjunction()
                            : (root, query, cb) -> cb.equal(root.get("catalog").get("subject").get("id"), id));
                }
            } else if (criterion.field().equals("schoolBody")) {
                // Chọn một cơ quan quản lý = thiết bị của mọi trường nó quản lý;
                // "none" = các trường chưa xác định cơ quan quản lý.
                String raw = criterion.value().trim();
                if (raw.equals("none")) {
                    specs.add((root, query, cb) -> cb.isNull(root.get("school").get("departmentOfEducation")));
                } else {
                    Long id = parseLong(raw);
                    specs.add(id == null
                            ? (root, query, cb) -> cb.disjunction()
                            : (root, query, cb) -> cb.equal(
                                    root.get("school").get("departmentOfEducation").get("id"), id));
                }
            } else if (criterion.field().equals("catalogScope")) {
                // in: thiết bị trong danh mục của Sở; out: ngoài danh mục (trường tự thêm).
                boolean out = "out".equals(criterion.value() == null ? "" : criterion.value().trim());
                specs.add((root, query, cb) -> out ? cb.isNotNull(root.get("catalog").get("ownerSchool"))
                        : cb.isNull(root.get("catalog").get("ownerSchool")));
            } else if (criterion.field().equals("legacyCode")) {
                // Tra theo mã cũ — tem cũ còn dán trên thiết bị, sổ giấy còn ghi mã cũ.
                String code = criterion.value().trim().toLowerCase();
                specs.add((root, query, cb) -> cb.equal(cb.lower(root.get("legacyCode")), code));
            } else if (criterion.field().equals("profileComplete")) {
                Boolean complete = parseBoolean(criterion.value());
                if (complete == null) {
                    specs.add((root, query, cb) -> cb.disjunction());
                } else {
                    specs.add(complete ? EquipmentService::completeProfile : EquipmentService::incompleteProfile);
                }
            } else if (criterion.field().equals("disposalEligible")) {
                specs.add("unrepairable".equals(criterion.value())
                        ? unrepairable() : (root, query, cb) -> cb.disjunction());
            } else if (criterion.field().equals("expiry")) {
                // `expired`: lô đã quá hạn sử dụng (tiêu huỷ do hết hạn, QLTB-565); `valid`: không ghi hạn hoặc còn hạn.
                LocalDate today = LocalDate.now();
                specs.add("expired".equals(criterion.value())
                        ? (root, query, cb) -> cb.lessThan(root.get("expiryDate"), today)
                        : "valid".equals(criterion.value())
                                ? (root, query, cb) -> cb.or(cb.isNull(root.get("expiryDate")),
                                        cb.greaterThanOrEqualTo(root.get("expiryDate"), today))
                                : (root, query, cb) -> cb.disjunction());
            }
        }
        return Specification.allOf(specs);
    }

    private static Specification<Equipment> enumIn(String attribute, String raw, boolean negate) {
        List<Enum<?>> values = new ArrayList<>();
        for (String part : raw.split(",")) {
            String name = part.trim().toUpperCase();
            try {
                values.add(attribute.equals("status")
                        ? AssetStatus.valueOf(name)
                        : com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition.valueOf(name));
            } catch (IllegalArgumentException e) {
                // bỏ qua giá trị lạ
            }
        }
        if (values.isEmpty()) {
            return (root, query, cb) -> cb.disjunction();
        }
        return negate
                ? (root, query, cb) -> cb.not(root.get(attribute).in(values))
                : (root, query, cb) -> root.get(attribute).in(values);
    }

    /**
     * Hồ sơ CHƯA chuẩn — cùng điều kiện với {@code Equipment.missingProfile()}, viết lần
     * thứ hai bằng SQL vì không lọc được một phương thức Java trong câu truy vấn. Hai bản
     * phải đi cùng nhau.
     */
    private static Predicate incompleteProfile(Root<Equipment> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        return cb.or(
                cb.isFalse(cb.function("textregexeq", Boolean.class, root.get("code"),
                        cb.literal(Equipment.STANDARD_CODE_SQL))),
                cb.isNull(root.get("unit")),
                cb.isNull(root.get("fundingSource")),
                cb.isNull(root.get("receivedDate")));
    }

    private static Predicate completeProfile(Root<Equipment> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        return cb.not(incompleteProfile(root, query, cb));
    }

    private static Long parseLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Boolean parseBoolean(String value) {
        String trimmed = value.trim();
        if (trimmed.equalsIgnoreCase("true")) {
            return Boolean.TRUE;
        }
        return trimmed.equalsIgnoreCase("false") ? Boolean.FALSE : null;
    }

    private static void requireRules(Equipment item) {
        requireSameSchool(item, item.getRoom(), "room");
        requireSameSchool(item, item.getManager(), "manager");
        if (item.getOriginalValue() != null && item.getRemainingValue() != null
                && item.getRemainingValue().compareTo(item.getOriginalValue()) > 0) {
            throw new FieldValidationException("remainingValue", "Giá trị còn lại không vượt quá nguyên giá");
        }
    }

    /**
     * Thông số hợp lệ theo bộ: bỏ ô trống, từ chối mã lạ, bắt đủ thông số bắt
     * buộc, kiểm kiểu. Không có bộ thì không lưu thông số nào.
     */
    private static Map<String, String> checkedSpecs(EquipmentConfig config, Map<String, String> input) {
        Map<String, String> result = new LinkedHashMap<>();
        if (config == null) {
            return result;
        }
        Map<String, EquipmentConfigAttribute> byCode = new LinkedHashMap<>();
        for (EquipmentConfigAttribute attr : config.getAttributes()) {
            byCode.put(attr.getCode(), attr);
        }
        Map<String, String> values = input == null ? Map.of() : input;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (!byCode.containsKey(entry.getKey())) {
                throw new FieldValidationException("specs", "Thông số " + entry.getKey() + " không thuộc bộ đã chọn");
            }
        }
        for (EquipmentConfigAttribute attr : byCode.values()) {
            String raw = values.get(attr.getCode());
            String value = raw == null ? "" : raw.trim();
            if (value.isEmpty()) {
                if (Boolean.TRUE.equals(attr.getRequired())) {
                    throw new FieldValidationException("specs", "Nhập thông số " + attr.getName());
                }
                continue;
            }
            requireType(attr, value);
            result.put(attr.getCode(), value);
        }
        return result;
    }

    private static void requireType(EquipmentConfigAttribute attr, String value) {
        boolean ok = switch (attr.getDataType()) {
            case TEXT -> true;
            case INTEGER -> value.matches("-?\\d+");
            case DECIMAL -> parses(() -> new BigDecimal(value));
            case BOOLEAN -> value.equals("true") || value.equals("false");
            case DATE -> parses(() -> LocalDate.parse(value));
            case ENUM -> attr.getOptionList().contains(value);
        };
        if (!ok) {
            throw new FieldValidationException("specs", "Thông số " + attr.getName() + " sai định dạng");
        }
    }

    private static boolean parses(Runnable parse) {
        try {
            parse.run();
            return true;
        } catch (NumberFormatException | DateTimeParseException e) {
            return false;
        }
    }

    private static boolean present(IdRef ref) {
        return ref != null && ref.id() != null;
    }

    private static <R> R ref(IdRef ref, Function<Long, R> loader) {
        return present(ref) ? loader.apply(ref.id()) : null;
    }
}
