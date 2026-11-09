package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.movementreason.MovementDirection;
import com.g123.sfems.domain.catalog.movementreason.MovementReason;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.coderule.AssetCodeService;
import com.g123.sfems.module.school.voucher.VoucherService;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.ListParams;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.hibernate.Hibernate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Phiếu nhập thiết bị (PN-01..03): lập, sửa nháp, trình, và ghi tăng tài sản lúc duyệt cuối. Vòng duyệt
 * và phạm vi dữ liệu là của {@link VoucherService}; ở đây chỉ có phần riêng của phiếu nhập.
 */
@Service
public class EquipmentIntakeService
        extends VoucherService<EquipmentIntake, EquipmentIntakeRequest, EquipmentIntakeRequest> {

    private static final String RESOURCE = "equipment_intakes";
    /** Loại phòng là kho: thiết bị đặt ở đây chưa đưa vào sử dụng. */
    private static final String WAREHOUSE_ROOM_TYPE = "KHO";

    private final AssetCodeService assetCodes;

    public EquipmentIntakeService(VoucherServiceDeps deps, EquipmentIntakeRepository repository,
            AssetCodeService assetCodes) {
        super(deps, repository, EquipmentIntake.class, EquipmentIntake::new);
        this.assetCodes = assetCodes;
    }

    // ------------------------------------------------------------------ ghi

    @Override
    protected void applyCreate(EquipmentIntake intake, EquipmentIntakeRequest request) {
        apply(intake, request);
    }

    @Override
    protected void applyUpdate(EquipmentIntake intake, EquipmentIntakeRequest request) {
        apply(intake, request);
    }

    private void apply(EquipmentIntake intake, EquipmentIntakeRequest request) {
        intake.setIntakeDate(request.intakeDate());
        intake.setDocumentNo(trimToNull(request.documentNo()));
        intake.setDocumentDate(request.documentDate());
        intake.setSupplier(trimToNull(request.supplier()));
        intake.setFundingSource(request.fundingSource());
        intake.setOriginSource(find(OriginSource.class, request.originSource(), "originSource", "Nguồn hình thành"));
        intake.setOriginNote(trimToNull(request.originNote()));
        intake.setAcquisitionMethod(find(AcquisitionMethod.class, request.acquisitionMethod(), "acquisitionMethod",
                "Hình thức mua sắm"));
        intake.setSchoolYear(find(SchoolYear.class, request.schoolYear(), "schoolYear", "Năm học"));
        intake.setWarrantyMonths(request.warrantyMonths());
        intake.setNote(trimToNull(request.note()));
        intake.setDeliverer(trimToNull(request.deliverer()));
        intake.setDelivererRepresentative(trimToNull(request.delivererRepresentative()));
        intake.setReceiver(trimToNull(request.receiver()));
        intake.setReceiverPosition(trimToNull(request.receiverPosition()));
        intake.setStorekeeper(trimToNull(request.storekeeper()));
        intake.setInspectionResult(request.inspectionResult());
        intake.setHandoverNo(trimToNull(request.handoverNo()));
        applyLines(intake, request.lines() == null ? List.of() : request.lines());
    }

    /**
     * Ghi các dòng THEO VỊ TRÍ: dòng thứ i sửa tại chỗ dòng thứ i đang có, thiếu thì thêm, thừa thì bỏ.
     * Xoá hết rồi chèn lại có thể vấp unique {@code (intake_id, line_no)} nếu lệnh chèn chạy trước lệnh xoá.
     */
    private void applyLines(EquipmentIntake intake, List<EquipmentIntakeLineInput> inputs) {
        List<EquipmentIntakeLine> current = intake.getLines();
        List<EquipmentIntakeLine> next = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            EquipmentIntakeLine line = i < current.size() ? current.get(i) : new EquipmentIntakeLine();
            applyLine(intake, line, inputs.get(i), i);
            next.add(line);
        }
        intake.replaceLines(next);
    }

    private void applyLine(EquipmentIntake intake, EquipmentIntakeLine line, EquipmentIntakeLineInput in, int index) {
        String prefix = "lines." + index + ".";
        EquipmentCatalog catalog = find(EquipmentCatalog.class, in.catalog(), prefix + "catalog", "Nhóm thiết bị");
        if (catalog == null) {
            throw new FieldValidationException(prefix + "catalog", "Chọn nhóm thiết bị");
        }
        line.setLineNo(index + 1);
        line.setCatalog(catalog);
        String name = trimToNull(in.name());
        line.setName(name != null ? name : catalog.getName());
        line.setPhysicalOrDigital(in.physicalOrDigital() != null ? in.physicalOrDigital() : catalog.getPhysicalOrDigital());
        line.setAssetCategory(in.assetCategory() != null ? in.assetCategory() : catalog.getAssetCategory());
        line.setDocumentQuantity(in.documentQuantity());
        line.setReceivedQuantity(in.receivedQuantity());
        line.setVarianceReason(trimToNull(in.varianceReason()));
        line.setUnitPrice(in.unitPrice());
        line.setRoom(room(intake, in.room(), prefix + "room"));
        line.setSupplier(trimToNull(in.supplier()));
        line.setDocumentNo(trimToNull(in.documentNo()));
        line.setDocumentDate(in.documentDate());
        line.setFundingSource(in.fundingSource());
        line.setFundingNote(trimToNull(in.fundingNote()));
        line.setAcquisitionMethod(find(AcquisitionMethod.class, in.acquisitionMethod(), prefix + "acquisitionMethod",
                "Hình thức mua sắm"));
        line.setAcquisitionNote(trimToNull(in.acquisitionNote()));
        line.setWarrantyMonths(in.warrantyMonths());
        line.setModel(trimToNull(in.model()));
        line.setManufacturer(trimToNull(in.manufacturer()));
        line.setNote(trimToNull(in.note()));
        MovementReason reason = find(MovementReason.class, in.movementReason(), prefix + "movementReason", "Lý do tăng");
        if (reason != null && reason.getDirection() != MovementDirection.INCREASE) {
            throw new FieldValidationException(prefix + "movementReason", "Lý do này không phải lý do tăng");
        }
        line.setMovementReason(reason);
    }

    /** Phòng nhận phải thuộc đúng trường của phiếu. */
    private Room room(EquipmentIntake intake, IdRef ref, String field) {
        Room room = find(Room.class, ref, field, "Phòng");
        if (room != null && !Objects.equals(room.getSchool().getId(), intake.getSchool().getId())) {
            throw new FieldValidationException(field, "Phòng không thuộc trường của phiếu");
        }
        return room;
    }

    private <T extends CatalogEntity> T find(Class<T> type, IdRef ref, String field, String label) {
        if (ref == null || ref.id() == null) {
            return null;
        }
        T found = entityManager.find(type, ref.id());
        if (found == null) {
            throw new FieldValidationException(field, label + " không tồn tại");
        }
        return found;
    }

    // ------------------------------------------------------------------ luật

    @Override
    protected void validate(EquipmentIntake intake) {
        LocalDate today = LocalDate.now();
        if (intake.getIntakeDate() != null && intake.getIntakeDate().isAfter(today)) {
            throw new FieldValidationException("intakeDate", "Ngày nhập không được sau hôm nay");
        }
        if (intake.getDocumentDate() != null && intake.getDocumentDate().isAfter(today)) {
            throw new FieldValidationException("documentDate", "Ngày chứng từ không được sau hôm nay");
        }
        List<EquipmentIntakeLine> lines = intake.getLines();
        for (int i = 0; i < lines.size(); i++) {
            EquipmentIntakeLine line = lines.get(i);
            if (!Objects.equals(line.getDocumentQuantity(), line.getReceivedQuantity())
                    && line.getVarianceReason() == null) {
                throw new FieldValidationException("lines." + i + ".varianceReason",
                        "Số thực nhận khác chứng từ, ghi lý do chênh lệch");
            }
            if (line.getDocumentDate() != null && line.getDocumentDate().isAfter(today)) {
                throw new FieldValidationException("lines." + i + ".documentDate",
                        "Ngày hoá đơn không được sau hôm nay");
            }
        }
    }

    /**
     * Luật lúc trình (GBR-09, GBR-10). Chạy lại y hệt lúc duyệt cuối trước khi ghi tăng: danh mục (đơn vị
     * tính, mã môn) và bộ mã có thể đã đổi trong lúc phiếu chờ duyệt.
     */
    @Override
    protected void validateSubmit(EquipmentIntake intake) {
        validate(intake);
        List<EquipmentIntakeLine> lines = intake.getLines();
        if (lines.isEmpty()) {
            throw new FieldValidationException("lines", "Phiếu chưa có dòng thiết bị nào");
        }
        if (intake.getDeliverer() == null) {
            throw new FieldValidationException("deliverer", "Nhập người giao");
        }
        if (lines.stream().allMatch(l -> received(l) == 0)) {
            throw new FieldValidationException("lines", "Phiếu không có thiết bị nào thực nhận");
        }
        for (int i = 0; i < lines.size(); i++) {
            validateLineForSubmit(intake, lines.get(i), "lines." + i + ".");
        }
        checkCodeCapacity(intake);
    }

    /**
     * Một dòng đủ để trình: có lý do tăng; có hàng nhận thì thiết bị có đơn vị tính và cấp được mã; thiết bị
     * quản lý từng cái còn phải có đơn giá (nguyên giá) và nguồn kinh phí ({@link Equipment#missingProfile}).
     */
    private void validateLineForSubmit(EquipmentIntake intake, EquipmentIntakeLine line, String prefix) {
        if (line.getMovementReason() == null) {
            throw new FieldValidationException(prefix + "movementReason", "Chọn lý do tăng");
        }
        if (received(line) == 0) {
            return;
        }
        EquipmentCatalog catalog = line.getCatalog();
        if (catalog.getUnit() == null) {
            throw new FieldValidationException(prefix + "catalog",
                    "Thiết bị \"" + catalog.getName() + "\" chưa có đơn vị tính (sửa ở danh mục)");
        }
        if (catalog.getTrackingType() != TrackingType.BULK) {
            if (line.getUnitPrice() == null) {
                throw new FieldValidationException(prefix + "unitPrice", "Nhập đơn giá");
            }
            if (line.getFundingSource() == null && intake.getFundingSource() == null) {
                throw new FieldValidationException(prefix + "fundingSource", "Chọn nguồn kinh phí");
            }
        }
        assetCodes.missing(intake.getSchool(), catalog).ifPresent(reason -> {
            throw new FieldValidationException(prefix + "catalog", "Chưa cấp được mã tài sản: " + reason);
        });
    }

    /** Mỗi bộ mã {@code TT.TR.MH.LT.NC} còn đủ số thứ tự cho các dòng rơi vào nó (GBR-10). */
    private void checkCodeCapacity(EquipmentIntake intake) {
        Map<String, Integer> need = new LinkedHashMap<>();
        Map<String, EquipmentIntakeLine> first = new HashMap<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            int count = EquipmentIntakeResponse.expectedAssets(line);
            if (count > 0) {
                need.merge(codeSetKey(line), count, Integer::sum);
                first.putIfAbsent(codeSetKey(line), line);
            }
        }
        int year = intake.getIntakeDate().getYear();
        for (Map.Entry<String, Integer> e : need.entrySet()) {
            EquipmentIntakeLine line = first.get(e.getKey());
            int left = assetCodes.remaining(intake.getSchool(), line.getCatalog(), line.getPhysicalOrDigital(), year);
            if (left < e.getValue()) {
                throw new FieldValidationException("lines." + intake.getLines().indexOf(line) + ".receivedQuantity",
                        "Bộ mã của \"" + line.getName() + "\" chỉ còn " + left + " số, phiếu cần " + e.getValue()
                                + ". Hãy tách bớt sang phiếu khác");
            }
        }
    }

    /** Dòng cùng môn (mã dạy học) và cùng loại vật lý/số thì chung một bộ mã; trường và năm là của phiếu. */
    private static String codeSetKey(EquipmentIntakeLine line) {
        return line.getCatalog().getSubject().getTeachingCode() + "|" + line.getPhysicalOrDigital();
    }

    private static int received(EquipmentIntakeLine line) {
        return line.getReceivedQuantity() == null ? 0 : line.getReceivedQuantity();
    }

    // ------------------------------------------------------------------ ghi tăng

    /** Duyệt cuối = ghi tăng (GBR-11): kiểm lại, sinh tài sản, hoàn tất — lỗi ở đâu cũng huỷ cả giao dịch. */
    @Override
    protected void onApproved(EquipmentIntake intake) {
        validateSubmit(intake);
        int created = writeUp(intake);
        workflow.complete(intake, "Ghi tăng " + created + " tài sản.");
    }

    /** Chỉ chạy với phiếu đã dừng ở "đã duyệt" từ trước khi có ghi tăng: duyệt mới thì đã ghi ở {@link #onApproved}. */
    @Override
    protected void onCompleted(EquipmentIntake intake) {
        writeUp(intake);
    }

    /**
     * Sinh tài sản từ các dòng: quản lý từng cái thì mỗi cái một tài sản, quản lý theo lô thì một tài sản
     * mang cả số lượng. Dòng đã sinh thì bỏ qua; dòng phiếu đang bị khoá nên không có hai lần ghi song song.
     */
    private int writeUp(EquipmentIntake intake) {
        int year = intake.getIntakeDate().getYear();
        Map<String, AssetCodeService.Batch> batches = new HashMap<>();
        Long actorId = CurrentUser.id().orElse(null);
        String actorName = actorName(actorId);
        int created = 0;
        for (EquipmentIntakeLine line : intake.getLines()) {
            int received = line.getReceivedQuantity() == null ? 0 : line.getReceivedQuantity();
            if (received == 0 || line.getGeneratedCount() > 0) {
                continue;
            }
            boolean bulk = line.getCatalog().getTrackingType() == TrackingType.BULK;
            int count = bulk ? 1 : received;
            for (int i = 0; i < count; i++) {
                Equipment asset = newAsset(intake, line, BigDecimal.valueOf(bulk ? received : 1));
                // Một lượt cấp cho mỗi bộ mã, dùng chung giữa các dòng: lượt mới sẽ đọc lại số cuối từ bảng.
                asset.setCode(batches.computeIfAbsent(codeSetKey(line), k -> assetCodes.begin(intake.getSchool(),
                        line.getCatalog(), line.getPhysicalOrDigital(), year)).next());
                entityManager.persist(asset);
                entityManager.persist(new EquipmentHistory(asset.getId(), EquipmentHistory.Action.GHI_TANG, null, null,
                        null, RESOURCE, intake.getId(), intake.getCode(), "Ghi tăng theo phiếu nhập " + intake.getCode(),
                        actorId, actorName));
            }
            line.setGeneratedCount(count);
            created += count;
        }
        return created;
    }

    /** Một tài sản do phiếu sinh ra, đủ để liệt kê và mở hồ sơ. */
    public record WrittenUpAsset(Long id, Integer lineNo, String code, String name, BigDecimal quantity,
            String room, AssetStatus status) {
    }

    /** Tài sản phiếu đã sinh. Đọc theo phạm vi của PHIẾU: thấy phiếu thì thấy những gì phiếu đã ghi tăng. */
    public List<WrittenUpAsset> writtenUpAssets(Long id) {
        EquipmentIntake intake = readable(id);
        return entityManager.createQuery("""
                        SELECT e FROM Equipment e JOIN e.intakeLine l
                        WHERE l.intake.id = :id ORDER BY l.lineNo, e.code""", Equipment.class)
                .setParameter("id", intake.getId())
                .getResultList().stream()
                .map(e -> new WrittenUpAsset(e.getId(), e.getIntakeLine().getLineNo(), e.getCode(), e.getName(),
                        e.getQuantity(), e.getRoom() == null ? null : e.getRoom().getName(), e.getStatus()))
                .toList();
    }

    /** Khoản khai riêng ở dòng được ưu tiên, trống thì theo đầu phiếu. */
    private static Equipment newAsset(EquipmentIntake intake, EquipmentIntakeLine line, BigDecimal quantity) {
        EquipmentCatalog catalog = line.getCatalog();
        Equipment asset = new Equipment();
        asset.setSchool(intake.getSchool());
        asset.setName(line.getName());
        asset.setCatalog(catalog);
        asset.setPhysicalOrDigital(line.getPhysicalOrDigital());
        asset.setAssetCategory(line.getAssetCategory() != null ? line.getAssetCategory() : catalog.getAssetCategory());
        asset.setModel(line.getModel() != null ? line.getModel() : catalog.getModel());
        asset.setManufacturer(line.getManufacturer() != null ? line.getManufacturer() : catalog.getManufacturer());
        asset.setUnit(catalog.getUnit());
        asset.setQuantity(quantity);
        asset.setOriginSource(intake.getOriginSource());
        asset.setOriginNote(intake.getOriginNote());
        asset.setAcquisitionMethod(line.getAcquisitionMethod() != null ? line.getAcquisitionMethod() : intake.getAcquisitionMethod());
        asset.setAcquisitionNote(line.getAcquisitionNote());
        asset.setFundingSource(line.getFundingSource() != null ? line.getFundingSource() : intake.getFundingSource());
        asset.setFundingNote(line.getFundingNote());
        asset.setUsageStartYear(intake.getIntakeDate().getYear());
        asset.setReceivedDate(intake.getIntakeDate());
        asset.setPurchaseDate(line.getDocumentDate() != null ? line.getDocumentDate() : intake.getDocumentDate());
        asset.setOriginalValue(line.getUnitPrice());
        asset.setRemainingValue(line.getUnitPrice());
        Integer warranty = line.getWarrantyMonths() != null ? line.getWarrantyMonths() : intake.getWarrantyMonths();
        asset.setWarrantyExpiry(warranty == null ? null : intake.getIntakeDate().plusMonths(warranty));
        asset.setRoom(line.getRoom());
        asset.setCondition(EquipmentCondition.TOT);
        asset.setStatus(inWarehouse(line.getRoom()) ? AssetStatus.IN_STOCK : AssetStatus.IN_USE);
        asset.setIntakeLine(line);
        return asset;
    }

    private static boolean inWarehouse(Room room) {
        return room == null || (room.getRoomType() != null && WAREHOUSE_ROOM_TYPE.equals(room.getRoomType().getCode()));
    }

    private String actorName(Long actorId) {
        if (actorId == null) {
            return null;
        }
        return (String) entityManager.createNativeQuery("SELECT COALESCE(NULLIF(full_name, ''), username) FROM users WHERE id = :id")
                .setParameter("id", actorId)
                .getSingleResult();
    }

    // ------------------------------------------------------------------ đọc

    @Override
    protected EquipmentIntake initialize(EquipmentIntake intake) {
        Hibernate.initialize(intake.getLines());
        return intake;
    }

    @Override
    protected Specification<EquipmentIntake> filters(ListParams params) {
        List<Specification<EquipmentIntake>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            switch (c.field()) {
                case "intakeDate" -> {
                    LocalDate date = date(c.value());
                    if (date != null) {
                        specs.add(switch (c.operator()) {
                            case GTE -> (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("intakeDate"), date);
                            case LTE -> (root, q, cb) -> cb.lessThanOrEqualTo(root.get("intakeDate"), date);
                            default -> (root, q, cb) -> cb.equal(root.get("intakeDate"), date);
                        });
                    }
                }
                case "supplier" -> specs.add((root, q, cb) -> ListParams.foldedLike(cb, root.get("supplier"), c.value()));
                case "schoolYear" -> {
                    Long id = number(c.value());
                    if (id != null) {
                        specs.add((root, q, cb) -> cb.equal(root.get("schoolYear").get("id"), id));
                    }
                }
                default -> {
                }
            }
        }
        return Specification.allOf(specs);
    }

    @Override
    protected Set<String> sortable() {
        return Set.of("id", "code", "status", "createdAt", "updatedAt", "submittedAt", "intakeDate", "supplier");
    }

    @Override
    protected Sort defaultSort() {
        return Sort.by(Sort.Order.desc("intakeDate"), Sort.Order.desc("id"));
    }

    private static LocalDate date(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.substring(0, Math.min(10, value.length())));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Long number(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
