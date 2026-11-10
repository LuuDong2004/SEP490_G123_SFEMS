package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.module.catalog.acquisitionmethod.AcquisitionMethodService;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.originsource.OriginSourceService;
import com.g123.sfems.module.catalog.unit.UnitService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.coderule.AssetCodeService;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle.VoucherRef;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hồ sơ thiết bị (TS-01) — đường ghi DUY NHẤT cho tài sản của trường.
 *
 * <p>Có hai cách tạo tài sản, và cả hai đi qua đây:
 * <ul>
 *   <li>Ghi tăng từ phiếu nhập: phiếu gọi {@link #generateFromIntakeLine} trong giao dịch xác nhận của
 *       nó. Phiếu chỉ nói "dòng này, ngần này cái"; việc dựng từng tài sản là của feature thiết bị.</li>
 *   <li>Nhập tay (hoặc nhập từ tệp, TS-07): {@link #create}. {@code intakeLine} để {@code null}.</li>
 * </ul>
 *
 * <p>Mọi thay đổi trạng thái, tình trạng và các trường hồ sơ đều ghi lịch sử qua
 * {@link EquipmentLifecycle}.
 *
 * <p>Đọc ngoài phạm vi trả 404 (qua {@link #get}), không phải 403 — dòng của trường khác coi như không
 * tồn tại.
 */
@Service
public class EquipmentService extends SchoolOwnedService<Equipment, EquipmentRequest, EquipmentPatchRequest> {

    /** Tài sản đã ra khỏi sổ: chỉ những cái này được xoá hồ sơ. Khớp quyền {@code equipment:delete}. */
    public static final Set<AssetStatus> OFF_BOOK = EnumSet.of(AssetStatus.LIQUIDATED, AssetStatus.LOST);

    /**
     * Các trường được ghi lịch sử khi sửa tay. Tên và mã chưa có dòng lịch sử riêng: lớp cha đặt chúng trực
     * tiếp, không đi qua {@link #track}.
     */
    private static final String FIELD_SERIAL = "serialNumber";
    private static final String FIELD_MODEL = "model";
    private static final String FIELD_MANUFACTURER = "manufacturer";
    private static final String FIELD_LEGACY_CODE = "legacyCode";
    private static final String FIELD_ORIGINAL_VALUE = "originalValue";
    private static final String FIELD_WARRANTY_EXPIRY = "warrantyExpiry";

    private final EquipmentRepository items;
    private final RowLevelSecurity scopes;
    private final EquipmentHistoryRepository historyRows;
    private final EquipmentLifecycle lifecycle;
    private final UnitService units;
    private final OriginSourceService originSources;
    private final AcquisitionMethodService acquisitionMethods;
    private final AssetCodeService assetCodes;
    private final SchoolService schools;
    private final RowLevelPrincipalResolver principals;

    public EquipmentService(
            EquipmentRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            EquipmentHistoryRepository historyRows,
            EquipmentLifecycle lifecycle,
            UnitService units,
            OriginSourceService originSources,
            AcquisitionMethodService acquisitionMethods,
            AssetCodeService assetCodes) {
        super(repository, rowLevel, Equipment.class, Equipment::new, "Thiết bị", schools, principals);
        this.items = repository;
        this.scopes = rowLevel;
        this.historyRows = historyRows;
        this.lifecycle = lifecycle;
        this.units = units;
        this.originSources = originSources;
        this.acquisitionMethods = acquisitionMethods;
        this.assetCodes = assetCodes;
        this.schools = schools;
        this.principals = principals;
    }

    /** Kết quả của {@link #nextCode}: mã dự kiến, hoặc lý do chưa cấp được. */
    public record NextCode(String code, String reason) {
    }

    /**
     * Mã sẽ cấp cho form tạo mới (không tăng bộ đếm). Trường vắng thì lấy trường của tài khoản đăng nhập.
     */
    @Transactional(readOnly = true)
    public NextCode nextCode(Long schoolId, Long catalogId, PhysicalDigitalType type,
            LocalDate receivedDate, LocalDate purchaseDate) {
        Long sid = schoolId != null ? schoolId
                : principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (sid == null) {
            return new NextCode(null, "Chọn trường để sinh mã");
        }
        School school = schools.get(sid);
        EquipmentCatalog catalog = catalogOf(new IdRef(catalogId));
        PhysicalDigitalType kind = type != null ? type : catalog.getPhysicalOrDigital();
        int year = yearOf(receivedDate, purchaseDate);
        String code = assetCodes.peek(school, catalog, kind, year).orElse(null);
        if (code != null) {
            return new NextCode(code, null);
        }
        String reason = assetCodes.missing(school, catalog)
                .map(r -> "chưa cấp được mã tài sản: " + r)
                .orElse("đã hết số thứ tự 001-999 cho bộ mã này");
        return new NextCode(null, reason);
    }

    /**
     * Mã để trống thì máy cấp theo quy tắc của trường (TS-06). Mã gõ tay giữ nguyên và vẫn đi qua kiểm
     * trùng như trước.
     */
    @Override
    protected String resolveCode(Equipment item, String code) {
        if (code != null && !code.isBlank()) {
            return code;
        }
        EquipmentCatalog catalog = item.getCatalog();
        if (catalog == null) {
            throw new FieldValidationException("catalog", "Chọn nhóm thiết bị để máy cấp mã tài sản");
        }
        int year = yearOf(item.getReceivedDate(), item.getPurchaseDate());
        return assetCodes.begin(item.getSchool(), catalog, item.getPhysicalOrDigital(), year).next();
    }

    /**
     * Cấp mã chuẩn cho tài sản đang mang mã cũ (sổ cũ, tệp nhập). Mã cũ chuyển sang {@code legacyCode} để
     * tem cũ vẫn tra được; lịch sử ghi lại lần đổi mã.
     */
    @Transactional
    public Equipment standardizeCode(Long id) {
        Equipment item = getWritable(id);
        if (Equipment.STANDARD_CODE.matcher(item.getCode()).matches()) {
            throw new FieldValidationException("code", "Tài sản đã mang mã chuẩn " + item.getCode());
        }
        String old = item.getCode();
        if (item.getLegacyCode() == null) {
            item.setLegacyCode(old);
        }
        EquipmentCatalog catalog = item.getCatalog();
        int year = yearOf(item.getReceivedDate(), item.getPurchaseDate());
        String code = assetCodes.begin(item.getSchool(), catalog, item.getPhysicalOrDigital(), year).next();
        requireCodeFree(item.getSchool(), code);
        item.setCode(code);
        lifecycle.change(item, Action.CAP_NHAT, "code", old, code, null, "Cấp mã chuẩn thay mã cũ " + old);
        // Entity đang được quản lý trong giao dịch (getWritable), nên thay đổi ghi khi commit.
        return item;
    }

    /** Năm cấp mã: ngày tiếp nhận, không có thì ngày mua, không có nữa thì năm nay. */
    private static int yearOf(LocalDate receivedDate, LocalDate purchaseDate) {
        if (receivedDate != null) {
            return receivedDate.getYear();
        }
        return purchaseDate != null ? purchaseDate.getYear() : LocalDate.now().getYear();
    }

    /**
     * Tạo hồ sơ thủ công. Sau khi lưu mới có id để ghi dòng "ghi tăng" đầu tiên vào lịch sử.
     */
    @Override
    @Transactional
    public Equipment create(EquipmentRequest request) {
        Equipment saved = super.create(request);
        lifecycle.event(saved, Action.GHI_TANG, null, "Nhập hồ sơ thủ công");
        return saved;
    }

    /**
     * Sinh N tài sản từ một dòng phiếu nhập — vế "theo từng cái" của việc ghi tăng. Gọi từ slice phiếu
     * nhập, trong giao dịch xác nhận của nó.
     *
     * <p>Dòng theo từng cái ({@code SERIAL}) ra N tài sản, mỗi cái một bản ghi. Dòng theo lô ({@code BULK})
     * ra MỘT bản ghi với số lượng = số nhận được.
     *
     * <p>Mỗi tài sản cần một mã riêng theo chuẩn của Sở. Thiếu quy tắc sinh mã thì cả lần xác nhận bị từ
     * chối, nêu rõ dòng nào. Đó là lựa chọn có giá: đi tiếp với mã tạm thì mã sai sẽ lan vào mọi báo cáo.
     */
    @Transactional
    public List<Equipment> generateFromIntakeLine(EquipmentIntakeLine line) {
        EquipmentIntake intake = line.getIntake();
        School school = intake.getSchool();
        EquipmentCatalog catalog = line.getCatalog();
        int received = line.getReceivedQuantity() == null ? 0 : line.getReceivedQuantity();
        boolean bulk = catalog.getTrackingType() == TrackingType.BULK;
        int rows = bulk ? (received > 0 ? 1 : 0) : received;

        VoucherRef voucher = new VoucherRef("equipment_intakes", intake.getId(), intake.getCode());
        List<Equipment> out = new ArrayList<>();
        for (int seq = 1; seq <= rows; seq++) {
            Equipment item = new Equipment();
            item.setSchool(school);
            item.setCatalog(catalog);
            item.setName(line.getName());
            item.setPhysicalOrDigital(line.getPhysicalOrDigital());
            item.setAssetCategory(line.getAssetCategory());
            item.setModel(line.getModel());
            item.setManufacturer(line.getManufacturer());
            item.setQuantity(bulk ? BigDecimal.valueOf(received) : BigDecimal.ONE);
            item.setOriginSource(intake.getOriginSource());
            item.setOriginNote(intake.getOriginNote());
            item.setAcquisitionMethod(
                    line.getAcquisitionMethod() != null ? line.getAcquisitionMethod() : intake.getAcquisitionMethod());
            item.setFundingSource(
                    line.getFundingSource() != null ? line.getFundingSource() : intake.getFundingSource());
            item.setFundingNote(line.getFundingNote());
            item.setAcquisitionNote(line.getAcquisitionNote());
            item.setOriginalValue(line.getUnitPrice());
            item.setReceivedDate(intake.getIntakeDate());
            item.setPurchaseDate(intake.getDocumentDate());
            item.setWarrantyExpiry(warrantyExpiry(intake.getIntakeDate(), line.getWarrantyMonths()));
            item.setRoom(line.getRoom());
            item.setStatus(AssetStatus.IN_STOCK);
            item.setIntakeLine(line);
            item.setActive(true);
            item.setCode(allocateCode(school, line, seq));
            requireCodeFree(school, item.getCode());

            Equipment saved = items.persist(item);
            items.flush();
            lifecycle.event(saved, Action.GHI_TANG, voucher, null);
            out.add(saved);
        }
        return out;
    }

    /**
     * Mã tài sản cho cái thứ {@code seq} của dòng phiếu. Chưa có quy tắc TS-06 nên chưa cấp được — lần
     * xác nhận phiếu nhập sẽ bị từ chối cho tới khi TS-06 xong. Đây là chỗ TS-06 cắm vào.
     */
    protected String allocateCode(School school, EquipmentIntakeLine line, int seq) {
        throw new FieldValidationException("code", "Chưa có quy tắc sinh mã tài sản (TS-06) — không ghi tăng được "
                + "dòng \"%s\" của trường %s".formatted(line.getName(), school.getName()));
    }

    @Override
    protected void applyCreateOwned(Equipment item, EquipmentRequest request) {
        item.setCatalog(catalogOf(request.catalog()));
        // Vắng thì lấy của nhóm thiết bị — cùng quy tắc với dòng phiếu nhập.
        item.setPhysicalOrDigital(request.physicalOrDigital() != null
                ? request.physicalOrDigital()
                : item.getCatalog().getPhysicalOrDigital());
        item.setAssetCategory(request.assetCategory() != null
                ? request.assetCategory()
                : item.getCatalog().getAssetCategory());
        item.setLegacyCode(blankToNull(request.legacyCode()));
        item.setSerialNumber(blankToNull(request.serialNumber()));
        requireSerialFree(item, item.getSerialNumber());
        item.setModel(blankToNull(request.model()));
        item.setManufacturer(blankToNull(request.manufacturer()));
        item.setUnit(unitOf(request.unit()));
        item.setQuantity(request.quantity());
        item.setOriginSource(originSourceOf(request.originSource()));
        item.setAcquisitionMethod(acquisitionMethodOf(request.acquisitionMethod()));
        item.setFundingSource(request.fundingSource());
        item.setOriginNote(blankToNull(request.originNote()));
        item.setFundingNote(blankToNull(request.fundingNote()));
        item.setAcquisitionNote(blankToNull(request.acquisitionNote()));
        item.setProductionYear(request.productionYear());
        item.setUsageStartYear(request.usageStartYear());
        item.setReceivedDate(request.receivedDate());
        item.setPurchaseDate(request.purchaseDate());
        item.setOriginalValue(request.originalValue());
        item.setWarrantyExpiry(request.warrantyExpiry());
        if (request.specs() != null) {
            item.setSpecs(request.specs());
        }
    }

    /**
     * Trạng thái, tình trạng và số lượng chỉ đổi qua phiếu đã duyệt (SRS TS-01, GBR-14), không sửa thẳng
     * trên hồ sơ. Gửi lại đúng giá trị hiện có thì không tính là đổi, vì form sửa gửi lại cả ba trường.
     */
    private static void rejectDirectChanges(Equipment item, EquipmentPatchRequest request) {
        List<String> changed = new ArrayList<>();
        if (request.status() != null && request.status() != item.getStatus()) {
            changed.add("trạng thái (phiếu tương ứng)");
        }
        if (request.condition() != null && request.condition() != item.getCondition()) {
            changed.add("tình trạng (phiếu báo hỏng / sửa chữa / kiểm kê)");
        }
        if (request.quantity() != null
                && (item.getQuantity() == null || request.quantity().compareTo(item.getQuantity()) != 0)) {
            changed.add("số lượng (phiếu ghi tăng / xuất kho)");
        }
        if (!changed.isEmpty()) {
            throw new FieldValidationException("status", "Không sửa thẳng trên hồ sơ được: "
                    + String.join(", ", changed) + ". Những thứ này chỉ đổi qua phiếu, để có người duyệt và để lại chứng từ.");
        }
    }

    @Override
    protected void applyUpdateOwned(Equipment item, EquipmentPatchRequest request) {
        rejectDirectChanges(item, request);
        if (request.catalog() != null) {
            item.setCatalog(catalogOf(request.catalog()));
        }
        if (request.physicalOrDigital() != null) {
            item.setPhysicalOrDigital(request.physicalOrDigital());
        }
        if (request.assetCategory() != null) {
            item.setAssetCategory(request.assetCategory());
        }
        if (request.legacyCode() != null) {
            track(item, FIELD_LEGACY_CODE, item.getLegacyCode(), blankToNull(request.legacyCode()),
                    item::setLegacyCode);
        }
        if (request.serialNumber() != null) {
            String serial = blankToNull(request.serialNumber());
            requireSerialFree(item, serial);
            track(item, FIELD_SERIAL, item.getSerialNumber(), serial, item::setSerialNumber);
        }
        if (request.model() != null) {
            track(item, FIELD_MODEL, item.getModel(), blankToNull(request.model()), item::setModel);
        }
        if (request.manufacturer() != null) {
            track(item, FIELD_MANUFACTURER, item.getManufacturer(), blankToNull(request.manufacturer()),
                    item::setManufacturer);
        }
        if (request.unit() != null) {
            item.setUnit(unitOf(request.unit()));
        }
        if (request.originSource() != null) {
            item.setOriginSource(originSourceOf(request.originSource()));
        }
        if (request.acquisitionMethod() != null) {
            item.setAcquisitionMethod(acquisitionMethodOf(request.acquisitionMethod()));
        }
        if (request.fundingSource() != null) {
            item.setFundingSource(request.fundingSource());
        }
        if (request.originNote() != null) {
            item.setOriginNote(blankToNull(request.originNote()));
        }
        if (request.fundingNote() != null) {
            item.setFundingNote(blankToNull(request.fundingNote()));
        }
        if (request.acquisitionNote() != null) {
            item.setAcquisitionNote(blankToNull(request.acquisitionNote()));
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
            track(item, FIELD_ORIGINAL_VALUE, item.getOriginalValue(), request.originalValue(),
                    item::setOriginalValue);
        }
        if (request.warrantyExpiry() != null) {
            track(item, FIELD_WARRANTY_EXPIRY, item.getWarrantyExpiry(), request.warrantyExpiry(),
                    item::setWarrantyExpiry);
        }
        if (request.specs() != null) {
            item.setSpecs(request.specs());
        }
    }

    /**
     * Bộ lọc riêng của hồ sơ. Lớp cha chỉ nhận id, mã, tên, ghi chú, active và trường; trường không khai ở
     * đây thì bị bỏ qua lặng lẽ.
     *
     * <ul>
     *   <li>{@code status}, {@code assetStatus}, {@code condition}: một hoặc nhiều giá trị cách nhau bằng
     *       dấu phẩy ({@code IN_STOCK,IN_USE}). {@code assetStatus} là bộ lọc nâng cao của màn; {@code status}
     *       là lối "chỉ xem đã ra khỏi sổ" — hai tên riêng để hai thứ cộng dồn được.</li>
     *   <li>{@code catalog.id}, {@code room.id}: mở bảng Theo tài sản từ một dòng của bảng tổng hợp.
     *       {@code room.id=none} là tài sản chưa xếp phòng (đang ở kho).</li>
     *   <li>{@code type}, {@code subject}: id loại thiết bị / môn học của nhóm thiết bị, hoặc {@code none}
     *       — cột lọc nhanh bên trái.</li>
     * </ul>
     */
    @Override
    protected Specification<Equipment> ownedFilters(ListParams params) {
        Specification<Equipment> spec = CatalogSpecifications.<Equipment>referenceFilter(params, "catalog")
                .and(CatalogSpecifications.referenceFilter(params, "room"));
        for (ListParams.Criterion criterion : params.filters()) {
            spec = switch (criterion.field()) {
                case "status", "assetStatus" -> spec.and(enumSpec("status", criterion, AssetStatus.class));
                case "condition" -> spec.and(enumSpec("condition", criterion, EquipmentCondition.class));
                case "physicalOrDigital" -> spec.and(enumSpec("physicalOrDigital", criterion, PhysicalDigitalType.class));
                case "type" -> spec.and(catalogRef("equipmentType", criterion));
                case "subject" -> spec.and(catalogRef("subject", criterion));
                default -> spec;
            };
        }
        return spec;
    }

    /**
     * Lọc theo một hoặc nhiều hằng enum (cách nhau bằng dấu phẩy). Giá trị lạ trả về không khớp dòng nào,
     * không phải lỗi 500.
     */
    private static <E extends Enum<E>> Specification<Equipment> enumSpec(
            String attribute, ListParams.Criterion criterion, Class<E> type) {
        List<E> values = new ArrayList<>();
        try {
            for (String part : criterion.value().split(",")) {
                if (!part.isBlank()) {
                    values.add(Enum.valueOf(type, part.trim()));
                }
            }
        } catch (IllegalArgumentException | NullPointerException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        if (values.isEmpty()) {
            return Specification.unrestricted();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.not(root.get(attribute).in(values))
                : (root, query, cb) -> root.get(attribute).in(values);
    }

    /** Lọc theo một tham chiếu của NHÓM thiết bị (loại, môn): id, hoặc {@code none} là nhóm chưa gắn. */
    private static Specification<Equipment> catalogRef(String attribute, ListParams.Criterion criterion) {
        String raw = criterion.value() == null ? "" : criterion.value().trim();
        if ("none".equals(raw)) {
            return (root, query, cb) -> cb.isNull(root.get("catalog").get(attribute));
        }
        Long id;
        try {
            id = Long.valueOf(raw);
        } catch (NumberFormatException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> cb.equal(root.get("catalog").get(attribute).get("id"), id);
    }

    /**
     * Chỉ tài sản đã ra khỏi sổ mới xoá được hồ sơ. Tài sản còn trong sổ phải được ghi giảm trước — xoá
     * thẳng là mất dấu giá trị và lịch sử của nó.
     */
    @Override
    protected void beforeDelete(Equipment item) {
        if (!OFF_BOOK.contains(item.getStatus())) {
            throw new ConflictException("Chỉ xoá được hồ sơ đã ra khỏi sổ (đã thanh lý hoặc mất)");
        }
    }

    /** Lịch sử của một tài sản, mới nhất trước. Đi qua {@link #get} để ngoài phạm vi thì 404. */
    @Transactional(readOnly = true)
    public List<EquipmentHistory> history(Long id) {
        Equipment item = get(id);
        return historyRows.findByEquipmentIdOrderByCreatedAtDescIdDesc(item.getId());
    }

    /**
     * Tra cứu theo mã (TS-02): khớp đúng mã chuẩn hoặc mã cũ, không phân biệt hoa thường. Chỉ trả hồ sơ trong
     * phạm vi đọc của người gọi; ngoài phạm vi coi như không có, nên danh sách rỗng chứ không lỗi 403/404.
     */
    @Transactional(readOnly = true)
    public List<Equipment> lookupByCode(String code) {
        String term = code == null ? "" : code.trim().toLowerCase(Locale.ROOT);
        if (term.isEmpty()) {
            return List.of();
        }
        Specification<Equipment> exact = (root, query, cb) -> cb.or(
                cb.equal(cb.lower(root.get("code")), term),
                cb.equal(cb.lower(root.get("legacyCode")), term));
        return items.findAll(
                scopes.<Equipment>scope(Equipment.class, com.g123.sfems.shared.security.rowlevel.Action.READ)
                        .and(exact));
    }

    /** Ghi một trường hồ sơ nếu giá trị thật sự đổi. {@code setter} áp giá trị mới. */
    private <V> void track(Equipment item, String field, V before, V after, java.util.function.Consumer<V> setter) {
        if (Objects.equals(before, after)) {
            return;
        }
        setter.accept(after);
        lifecycle.change(item, Action.CAP_NHAT, field, valueText(before), valueText(after), null, null);
    }

    private EquipmentCatalog catalogOf(IdRef ref) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("catalog", "Chọn danh mục thiết bị");
        }
        // Chưa có service của danh mục thiết bị (DM-02). Khi có, đổi sang service đó.
        EquipmentCatalog catalog = entityManager().find(EquipmentCatalog.class, ref.id());
        if (catalog == null) {
            throw new ResourceNotFoundException("EquipmentCatalog", ref.id());
        }
        return catalog;
    }

    private Unit unitOf(IdRef ref) {
        return ref == null || ref.id() == null ? null : units.get(ref.id());
    }

    private OriginSource originSourceOf(IdRef ref) {
        return ref == null || ref.id() == null ? null : originSources.get(ref.id());
    }

    private AcquisitionMethod acquisitionMethodOf(IdRef ref) {
        return ref == null || ref.id() == null ? null : acquisitionMethods.get(ref.id());
    }

    /** Số serial không trùng trong cùng một trường (serial là duy nhất theo trường, không theo cả bảng). */
    private void requireSerialFree(Equipment item, String serial) {
        if (serial == null) {
            return;
        }
        long selfId = item.getId() == null ? -1L : item.getId();
        Long taken = entityManager().createQuery(
                        "SELECT count(e) FROM Equipment e WHERE e.school.id = :school"
                                + " AND LOWER(e.serialNumber) = LOWER(:serial) AND e.id <> :self", Long.class)
                .setParameter("school", item.getSchool().getId())
                .setParameter("serial", serial)
                .setParameter("self", selfId)
                .getSingleResult();
        if (taken > 0) {
            throw new FieldValidationException("serialNumber", "Số serial \"%s\" đã có trong trường".formatted(serial));
        }
    }

    private void requireCodeFree(School school, String code) {
        if (items.findBySchoolIdAndCodeIgnoreCase(school.getId(), code).isPresent()) {
            throw new ConflictException("Mã tài sản %s đã có trong trường".formatted(code));
        }
    }

    /** Ngày hết bảo hành = ngày nhập + số tháng bảo hành của dòng phiếu. */
    private static LocalDate warrantyExpiry(LocalDate intakeDate, Integer warrantyMonths) {
        if (intakeDate == null || warrantyMonths == null) {
            return null;
        }
        return intakeDate.plusMonths(warrantyMonths);
    }

    private static String valueText(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.toPlainString();
        }
        return value.toString();
    }

}
