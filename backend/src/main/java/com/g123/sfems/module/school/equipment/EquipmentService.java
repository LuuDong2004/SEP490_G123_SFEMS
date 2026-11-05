package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
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
import com.g123.sfems.module.school.equipment.EquipmentLifecycle.VoucherRef;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
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
    private final EquipmentHistoryRepository historyRows;
    private final EquipmentLifecycle lifecycle;
    private final UnitService units;
    private final OriginSourceService originSources;
    private final AcquisitionMethodService acquisitionMethods;

    public EquipmentService(
            EquipmentRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            EquipmentHistoryRepository historyRows,
            EquipmentLifecycle lifecycle,
            UnitService units,
            OriginSourceService originSources,
            AcquisitionMethodService acquisitionMethods) {
        super(repository, rowLevel, Equipment.class, Equipment::new, "Thiết bị", schools, principals);
        this.items = repository;
        this.historyRows = historyRows;
        this.lifecycle = lifecycle;
        this.units = units;
        this.originSources = originSources;
        this.acquisitionMethods = acquisitionMethods;
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

    @Override
    protected void applyUpdateOwned(Equipment item, EquipmentPatchRequest request) {
        if (request.status() != null && request.status() != item.getStatus()) {
            lifecycle.status(item, request.status(), Action.CAP_NHAT, null, null);
        }
        if (request.condition() != null && request.condition() != item.getCondition()) {
            lifecycle.condition(item, request.condition(), Action.CAP_NHAT, null, null);
        }
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
        if (request.quantity() != null) {
            item.setQuantity(request.quantity());
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
