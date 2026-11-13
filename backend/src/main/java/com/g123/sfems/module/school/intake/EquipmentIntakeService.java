package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.movementreason.MovementDirection;
import com.g123.sfems.domain.catalog.movementreason.MovementReason;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.school.coderule.AssetCodeService;
import com.g123.sfems.module.school.voucher.InventoryFindings;
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
import java.util.stream.Collectors;
import org.hibernate.Hibernate;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        applyDetails(intake, request.details());
        applyLines(intake, request.lines() == null ? List.of() : request.lines());
        fitSources(intake);
    }

    /**
     * Biên bản giao nhận gửi theo khoá của màn hình ({@code details}) — đè lên các trường rời cùng nghĩa.
     * Khoá vắng mặt thì giữ giá trị đã gán từ trường rời.
     */
    private static void applyDetails(EquipmentIntake intake, Map<String, Object> details) {
        if (details == null) {
            return;
        }
        if (details.containsKey(DELIVERED_BY)) {
            intake.setDeliverer(text(details.get(DELIVERED_BY)));
        }
        if (details.containsKey(DELIVERY_REPRESENTATIVE)) {
            intake.setDelivererRepresentative(text(details.get(DELIVERY_REPRESENTATIVE)));
        }
        if (details.containsKey(RECEIVER_NAME)) {
            intake.setReceiver(text(details.get(RECEIVER_NAME)));
        }
        if (details.containsKey(RECEIVER_POSITION)) {
            intake.setReceiverPosition(text(details.get(RECEIVER_POSITION)));
        }
        if (details.containsKey(HANDOVER_MINUTES_NO)) {
            intake.setHandoverNo(text(details.get(HANDOVER_MINUTES_NO)));
        }
        if (details.containsKey(INSPECTION_RESULT)) {
            String value = text(details.get(INSPECTION_RESULT));
            try {
                intake.setInspectionResult(value == null ? null : EquipmentIntake.InspectionResult.valueOf(value));
            } catch (IllegalArgumentException e) {
                throw new FieldValidationException("details." + INSPECTION_RESULT, "Kết quả kiểm tra không hợp lệ");
            }
        }
        checkLength(intake.getDeliverer(), 255, DELIVERED_BY, "Người giao");
        checkLength(intake.getDelivererRepresentative(), 255, DELIVERY_REPRESENTATIVE, "Đại diện bên giao");
        checkLength(intake.getReceiver(), 255, RECEIVER_NAME, "Người nhận");
        checkLength(intake.getReceiverPosition(), 255, RECEIVER_POSITION, "Chức vụ");
        checkLength(intake.getHandoverNo(), 100, HANDOVER_MINUTES_NO, "Số biên bản bàn giao");
    }

    /** Biên bản giao nhận theo khoá của màn hình — chiều đọc của {@link #applyDetails}. */
    public static Map<String, Object> details(EquipmentIntake intake) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(DELIVERED_BY, intake.getDeliverer());
        out.put(DELIVERY_REPRESENTATIVE, intake.getDelivererRepresentative());
        out.put(RECEIVER_NAME, intake.getReceiver());
        out.put(RECEIVER_POSITION, intake.getReceiverPosition());
        out.put(INSPECTION_RESULT, intake.getInspectionResult() == null ? null : intake.getInspectionResult().name());
        out.put(HANDOVER_MINUTES_NO, intake.getHandoverNo());
        return out;
    }

    private static final String DELIVERED_BY = "deliveredBy";
    private static final String DELIVERY_REPRESENTATIVE = "deliveryRepresentative";
    private static final String RECEIVER_NAME = "receiverName";
    private static final String RECEIVER_POSITION = "receiverPosition";
    private static final String INSPECTION_RESULT = "inspectionResult";
    private static final String HANDOVER_MINUTES_NO = "handoverMinutesNo";

    private static String text(Object value) {
        return value == null ? null : trimToNull(String.valueOf(value));
    }

    private static void checkLength(String value, int max, String key, String label) {
        if (value != null && value.length() > max) {
            throw new FieldValidationException("details." + key, label + " tối đa " + max + " ký tự");
        }
    }

    /**
     * Ghi các dòng: dòng gửi kèm id đang có thì sửa tại chỗ (giữ id — tệp hoá đơn gắn theo dòng bám vào nó),
     * không thì lấy lại một dòng chưa dùng hoặc tạo mới. Dòng dư bị bỏ. Lấy lại dòng cũ thay vì xoá rồi chèn
     * để không vấp unique {@code (intake_id, line_no)} khi lệnh chèn chạy trước lệnh xoá.
     */
    private void applyLines(EquipmentIntake intake, List<EquipmentIntakeLineInput> inputs) {
        Map<Long, EquipmentIntakeLine> byId = new LinkedHashMap<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getId() != null) {
                byId.put(line.getId(), line);
            }
        }
        List<EquipmentIntakeLine> claimed = new ArrayList<>(inputs.size());
        for (EquipmentIntakeLineInput in : inputs) {
            claimed.add(in.id() != null ? byId.remove(in.id()) : null);
        }
        List<EquipmentIntakeLine> spare = new ArrayList<>(byId.values());
        List<EquipmentIntakeLine> next = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            EquipmentIntakeLine line = claimed.get(i);
            if (line == null) {
                line = spare.isEmpty() ? new EquipmentIntakeLine() : spare.remove(0);
            }
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
        // Màn lập phiếu không hỏi lý do tăng từng dòng: suy từ nguồn hình thành của phiếu.
        line.setMovementReason(reason != null ? reason : defaultReason(intake));
        boolean bulk = catalog.getTrackingType() == TrackingType.BULK;
        // Hạn sử dụng và quy cách chỉ có nghĩa với dòng quản lý theo số lượng; dòng từng cái gửi kèm thì gỡ đi.
        line.setExpiryDate(bulk ? in.expiryDate() : null);
        applyPack(line, in, catalog, bulk, index);
    }

    /**
     * Quy cách bao bì của dòng: phải khai đủ cả đơn vị bao bì và lượng. Bao bì trùng đơn vị của thiết bị là
     * không quy đổi gì — gỡ đi.
     */
    private void applyPack(EquipmentIntakeLine line, EquipmentIntakeLineInput in, EquipmentCatalog catalog,
            boolean bulk, int index) {
        Unit pack = find(Unit.class, in.packUnit(), "lines." + index + ".packUnit", "Đơn vị bao bì");
        BigDecimal size = in.packSize();
        if (!bulk || (pack == null && size == null)) {
            line.setPackUnit(null);
            line.setPackSize(null);
            return;
        }
        if (pack == null || size == null) {
            throw new FieldValidationException("lines",
                    where(line) + ": khai đủ quy cách — đơn vị bao bì và lượng trong một bao bì");
        }
        if (catalog.getUnit() != null && catalog.getUnit().getId().equals(pack.getId())) {
            line.setPackUnit(null);
            line.setPackSize(null);
            return;
        }
        line.setPackUnit(pack);
        line.setPackSize(size);
    }

    /** Lý do tăng mặc định theo nguồn hình thành của phiếu. */
    private MovementReason defaultReason(EquipmentIntake intake) {
        String code = OriginRule.of(intake.getOriginSource()).map(rule -> switch (rule) {
            case PHAN_BO -> "CAPPHAT";
            case TANG_TAI_TRO -> "TAITRO";
            case KIEM_KE_THUA -> "THUA_KK";
            default -> "MUAMOI";
        }).orElse("MUAMOI");
        return entityManager.createQuery("SELECT r FROM MovementReason r WHERE r.code = :code", MovementReason.class)
                .setParameter("code", code)
                .getResultStream().findFirst().orElse(null);
    }

    private static String where(EquipmentIntakeLine line) {
        return "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
    }

    /**
     * Nguồn hình thành ↔ nguồn kinh phí ↔ hình thức mua sắm phải KHỚP nhau ở mọi lần lưu, kể cả nháp: một cặp
     * mâu thuẫn ("Được tặng" + "Ngân sách") là dữ liệu sai chứ không phải dữ liệu thiếu. Thứ không còn nghĩa với
     * nguồn hình thành đang chọn thì được GỠ chứ không báo lỗi — người dùng đổi nguồn không phải xoá tay từng ô.
     */
    private static void fitSources(EquipmentIntake intake) {
        OriginRule rule = OriginRule.of(intake.getOriginSource()).orElse(null);
        if (rule == null) {
            return;
        }
        if (!rule.noteRequired()) {
            intake.setOriginNote(null);
        }
        if (!rule.acquisitionMethod()) {
            intake.setAcquisitionMethod(null);
        }
        if (intake.getFundingSource() != null && !rule.allows(intake.getFundingSource())) {
            intake.setFundingSource(null);
        }
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (!rule.acquisitionMethod()) {
                line.setAcquisitionMethod(null);
            }
            FundingSource funding = line.getFundingSource();
            if (funding != null && !rule.allows(funding)) {
                throw new FieldValidationException("lines",
                        "%s: nguồn kinh phí \"%s\" không đi với nguồn hình thành \"%s\". Chọn một trong: %s".formatted(
                                where(line), funding.label(), rule.label(), fundingChoices(rule)));
            }
            if (funding != FundingSource.OTHER) {
                line.setFundingNote(null);
            }
            if (!isOtherMethod(line.getAcquisitionMethod() != null ? line.getAcquisitionMethod()
                    : intake.getAcquisitionMethod())) {
                line.setAcquisitionNote(null);
            }
        }
    }

    private static String fundingChoices(OriginRule rule) {
        return rule.fundingSources().stream().map(FundingSource::label).collect(Collectors.joining(", "));
    }

    /** Hình thức mua sắm "Khác" — mục duy nhất phải ghi rõ. */
    private static boolean isOtherMethod(AcquisitionMethod method) {
        return method != null && "KHAC".equals(method.getCode());
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
        if (intake.getSchoolYear() == null) {
            throw new FieldValidationException("schoolYear",
                    "Chọn năm học của phiếu. Chưa có năm học nào thì khai ở danh mục Năm học trước.");
        }
        requireSources(intake);
        for (int i = 0; i < lines.size(); i++) {
            validateLineForSubmit(intake, lines.get(i), "lines." + i + ".");
        }
        checkCodeCapacity(intake);
    }

    /**
     * Nguồn trước khi trình: nguồn hình thành của phiếu, phần ghi rõ khi là "Khác", và nguồn kinh phí của từng
     * dòng theo luật của nguồn hình thành. Dòng không bắt buộc nguồn kinh phí (kiểm kê thừa, tự làm không tốn
     * tiền) mà để trống thì ghi "Chưa xác định nguồn" — khác với "chưa ai khai".
     */
    private static void requireSources(EquipmentIntake intake) {
        OriginRule rule = OriginRule.of(intake.getOriginSource()).orElseThrow(() -> new FieldValidationException(
                "originSource",
                "Chọn nguồn hình thành của phiếu: mua sắm, được Sở phân bổ, được tặng, kiểm kê thừa, tự làm hay khác"));
        if (rule.noteRequired() && intake.getOriginNote() == null) {
            throw new FieldValidationException("originNote",
                    "Nguồn hình thành \"%s\": ghi rõ là nguồn gì".formatted(rule.label()));
        }
        fitSources(intake);
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (received(line) <= 0) {
                continue;
            }
            FundingSource funding = line.getFundingSource() != null ? line.getFundingSource() : intake.getFundingSource();
            if (funding == null) {
                if (rule.requiresFunding(line.getUnitPrice())) {
                    throw new FieldValidationException("fundingSource",
                            "%s: chọn nguồn kinh phí. Với nguồn hình thành \"%s\" chọn được: %s".formatted(
                                    where(line), rule.label(), fundingChoices(rule)));
                }
                line.setFundingSource(FundingSource.UNDETERMINED);
            } else if (funding == FundingSource.OTHER && line.getFundingNote() == null) {
                throw new FieldValidationException("lines",
                        "%s: nguồn kinh phí \"%s\" phải ghi rõ là nguồn gì".formatted(where(line), funding.label()));
            }
            AcquisitionMethod method = line.getAcquisitionMethod() != null ? line.getAcquisitionMethod()
                    : intake.getAcquisitionMethod();
            if (isOtherMethod(method) && line.getAcquisitionNote() == null) {
                throw new FieldValidationException("lines",
                        "%s: hình thức mua sắm \"Khác\" phải ghi rõ là hình thức gì".formatted(where(line)));
            }
        }
    }

    /**
     * Một dòng đủ để trình: có hàng nhận thì thiết bị có đơn vị tính và cấp được mã; hoá chất có hạn sử dụng; thiết
     * bị quản lý từng cái không quá 999 cái một dòng. Đơn giá KHÔNG bắt buộc: nguyên giá chỉ ghi khi có dữ liệu.
     */
    private void validateLineForSubmit(EquipmentIntake intake, EquipmentIntakeLine line, String prefix) {
        if (line.getMovementReason() == null) {
            line.setMovementReason(defaultReason(intake));
        }
        if (received(line) == 0) {
            return;
        }
        EquipmentCatalog catalog = line.getCatalog();
        boolean bulk = catalog.getTrackingType() == TrackingType.BULK;
        if (catalog.getUnit() == null) {
            throw new FieldValidationException(prefix + "catalog",
                    ("%s: nhóm thiết bị \"%s\" chưa khai đơn vị tính. Khai ở danh mục Nhóm thiết bị rồi trình lại.")
                            .formatted(where(line), catalog.getName()));
        }
        AssetCategory category = line.getAssetCategory() != null ? line.getAssetCategory() : catalog.getAssetCategory();
        if (bulk && category == AssetCategory.CHEMICAL && line.getExpiryDate() == null) {
            throw new FieldValidationException(prefix + "expiryDate",
                    "%s: nhập hạn sử dụng — hoá chất bắt buộc có hạn sử dụng.".formatted(where(line)));
        }
        if (!bulk && received(line) > 999) {
            throw new FieldValidationException(prefix + "receivedQuantity",
                    "%s: quá 999 cái một dòng, hãy tách sang phiếu khác".formatted(where(line)));
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

    // ------------------------------------------------------------------ lập từ biên bản kiểm kê

    /**
     * Kiểm kê thấy tài sản THỪA (KK-06): lập một phiếu nhập NHÁP mang các dòng đó, nguồn hình thành "Kiểm kê thừa",
     * nguồn chứng từ là biên bản. Ghi tăng vẫn phải qua lãnh đạo trường duyệt như mọi lần ghi tăng khác.
     */
    @EventListener
    @Transactional
    public void onSurplus(InventoryFindings.Surplus findings) {
        EquipmentIntake draft = new EquipmentIntake();
        draft.setSchool(schools.get(findings.schoolId()));
        draft.setStatus(VoucherStatus.DRAFT);
        draft.setIntakeDate(LocalDate.now());
        draft.setSchoolYear(currentSchoolYear());
        draft.setOriginSource(originSourceOf(OriginRule.KIEM_KE_THUA));
        draft.setSource("inventory_sessions", findings.sourceId(), findings.sourceCode());
        draft.setNote("Ghi tăng tài sản thừa theo biên bản kiểm kê " + findings.sourceCode());
        List<EquipmentIntakeLine> lines = new ArrayList<>();
        int lineNo = 1;
        for (InventoryFindings.Item item : findings.items()) {
            EquipmentIntakeLine line = new EquipmentIntakeLine();
            line.setLineNo(lineNo++);
            line.setCatalog(entityManager.getReference(EquipmentCatalog.class, item.catalogId()));
            line.setName(item.name());
            line.setPhysicalOrDigital(PhysicalDigitalType.PHYSICAL);
            line.setDocumentQuantity(item.quantity());
            line.setReceivedQuantity(item.quantity());
            line.setRoom(item.roomId() == null ? null : entityManager.getReference(Room.class, item.roomId()));
            lines.add(line);
        }
        draft.replaceLines(lines);
        repository.persist(draft);
    }

    /** Năm học đang dùng; chưa khai thì để trống, người lập chọn khi sửa phiếu nháp. */
    private SchoolYear currentSchoolYear() {
        return entityManager.createQuery("select y from SchoolYear y where y.current = true", SchoolYear.class)
                .getResultStream().findFirst().orElse(null);
    }

    /** Dòng danh mục của một trong sáu nguồn hình thành cố định — mã dòng chính là tên luật. */
    private OriginSource originSourceOf(OriginRule rule) {
        return entityManager.createQuery("select o from OriginSource o where o.code = :code", OriginSource.class)
                .setParameter("code", rule.name())
                .getResultStream().findFirst().orElse(null);
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
                // Lô vật tư vào sổ theo số đã quy đổi bao bì; thiết bị từng cái mỗi hồ sơ một cái.
                Equipment asset = newAsset(intake, line, bulk ? line.stockQuantity() : BigDecimal.ONE);
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

    /** Người lập phiếu (tên đăng nhập, họ tên); {@code null} khi phiếu do hệ thống lập. */
    public RefSummary creator(EquipmentIntake intake) {
        Long id = intake.getCreatedById();
        if (id == null) {
            return null;
        }
        List<?> rows = entityManager.createNativeQuery(
                        "SELECT username, COALESCE(NULLIF(full_name, ''), username) FROM users WHERE id = :id")
                .setParameter("id", id)
                .getResultList();
        if (rows.isEmpty()) {
            return null;
        }
        Object[] row = (Object[]) rows.get(0);
        return new RefSummary(id, (String) row[0], (String) row[1]);
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
