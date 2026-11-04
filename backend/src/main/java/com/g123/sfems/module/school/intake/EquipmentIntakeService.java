package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.voucher.VoucherService;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.hibernate.Hibernate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Phiếu nhập thiết bị (PN-01): lập, sửa nháp, trình. Vòng duyệt và phạm vi dữ liệu là của
 * {@link VoucherService}; ở đây chỉ có phần riêng của phiếu nhập: ghi đầu phiếu, ghi các dòng, và
 * các luật của dòng.
 *
 * <p>Ghi tăng tài sản lúc duyệt cuối (PN-03) chưa làm: phiếu duyệt xong dừng ở trạng thái đã duyệt.
 */
@Service
public class EquipmentIntakeService
        extends VoucherService<EquipmentIntake, EquipmentIntakeRequest, EquipmentIntakeRequest> {

    public EquipmentIntakeService(VoucherServiceDeps deps, EquipmentIntakeRepository repository) {
        super(deps, repository, EquipmentIntake.class, EquipmentIntake::new);
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
        line.setPhysicalOrDigital(in.physicalOrDigital());
        line.setAssetCategory(in.assetCategory());
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

    @Override
    protected void validateSubmit(EquipmentIntake intake) {
        validate(intake);
        if (intake.getLines().isEmpty()) {
            throw new FieldValidationException("lines", "Phiếu chưa có dòng thiết bị nào");
        }
        if (intake.getLines().stream().allMatch(l -> l.getReceivedQuantity() == null || l.getReceivedQuantity() == 0)) {
            throw new FieldValidationException("lines", "Phiếu không có thiết bị nào thực nhận");
        }
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
