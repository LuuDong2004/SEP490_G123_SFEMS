package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.school.intake.EquipmentIntakeService;
import com.g123.sfems.module.school.intake.EquipmentIntakeService.PurchasedItem;
import com.g123.sfems.module.school.voucher.VoucherService;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.module.school.voucher.VoucherSpecs;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.validation.Num;
import com.g123.sfems.shared.validation.NumberRule;
import com.g123.sfems.shared.web.ListParams;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đề xuất mua sắm. Vòng đời:
 *
 * <pre>
 * Nháp → Chờ duyệt (lãnh đạo trường → cơ quan quản lý) → Đã duyệt
 *      → [vào kế hoạch của cơ quan quản lý, kế hoạch được duyệt] → Hoàn tất
 *      → [hàng về] Lập phiếu nhập
 * </pre>
 *
 * <p>Đề xuất KHÔNG tự hoàn tất: không có nút "hoàn tất" nào trên nó. Có tiền hay
 * không là quyết định của kế hoạch, và chỉ {@link ProcurementPlanService} đóng
 * nó lại. Làm khác đi thì trường tự ghi "đã được cấp" cho thứ chưa ai duyệt chi.
 */
@Service
public class PurchaseProposalService
        extends VoucherService<PurchaseProposal, PurchaseProposalApi.Request, PurchaseProposalApi.Patch> {

    public static final String RESOURCE = "purchase_proposals";

    private final EquipmentCatalogService catalogs;
    private final AdequacyService adequacy;
    private final EquipmentIntakeService intakes;

    public PurchaseProposalService(VoucherServiceDeps deps, PurchaseProposalRepository repository,
            EquipmentCatalogService catalogs, AdequacyService adequacy, EquipmentIntakeService intakes) {
        super(deps, repository, PurchaseProposal.class, RESOURCE, PurchaseProposal::new);
        this.catalogs = catalogs;
        this.adequacy = adequacy;
        this.intakes = intakes;
    }

    private List<ProposalSubmitGuard> submitGuards = List.of();

    /** Kiểm khi trình của hồ sơ năm học — tiêm qua setter (tránh vòng phụ thuộc). */
    @Autowired
    void setSubmitGuards(List<ProposalSubmitGuard> guards) {
        this.submitGuards = guards;
    }

    @Override
    protected void applyCreate(PurchaseProposal voucher, PurchaseProposalApi.Request request) {
        voucher.setProposalDate(request.proposalDate());
        voucher.setBudgetYear(request.budgetYear() != null ? request.budgetYear()
                : request.proposalDate().getYear() + 1);
        voucher.setFundingSource(request.fundingSource());
        voucher.setReason(trimToNull(request.reason()));
        voucher.setNote(trimToNull(request.note()));
        voucher.replaceLines(buildLines(voucher, request.lines()));
    }

    @Override
    protected void applyUpdate(PurchaseProposal voucher, PurchaseProposalApi.Patch request) {
        if (request.proposalDate() != null) {
            voucher.setProposalDate(request.proposalDate());
        }
        if (request.budgetYear() != null) {
            voucher.setBudgetYear(request.budgetYear());
        }
        if (request.fundingSource() != null) {
            voucher.setFundingSource(request.fundingSource());
        }
        if (request.reason() != null) {
            voucher.setReason(trimToNull(request.reason()));
        }
        if (request.note() != null) {
            voucher.setNote(trimToNull(request.note()));
        }
        if (request.lines() != null) {
            voucher.replaceLines(buildLines(voucher, request.lines()));
        }
    }

    @Override
    protected void validate(PurchaseProposal voucher) {
        Set<Long> seen = new HashSet<>();
        for (PurchaseProposalLine line : voucher.getLines()) {
            if (!seen.add(line.getCatalog().getId())) {
                throw new FieldValidationException("lines",
                        "Nhóm thiết bị %s xuất hiện hai lần — gộp thành một dòng".formatted(line.getCatalog().getName()));
            }
        }
        if (voucher.getBudgetYear() != null && (voucher.getBudgetYear() < 2000 || voucher.getBudgetYear() > 2100)) {
            throw new FieldValidationException("budgetYear", "Năm ngân sách không hợp lệ");
        }
    }

    @Override
    protected void validateSubmit(PurchaseProposal voucher) {
        validate(voucher);
        if (voucher.getLines().isEmpty()) {
            throw new FieldValidationException("lines", "Đề xuất chưa có dòng nào");
        }
        if (voucher.getReason() == null) {
            throw new FieldValidationException("reason", "Nêu sự cần thiết của đề xuất trước khi trình");
        }
        for (ProposalSubmitGuard guard : submitGuards) {
            guard.beforeSubmit(voucher.getId(), voucher.getSchool().getId());
        }
        // Đơn giá dự kiến KHÔNG bắt buộc: trường đề xuất NHU CẦU (thiếu gì, bao nhiêu), thường chưa biết giá — ép nhập
        // thì ra con số bịa. Giá do cơ quan lập kế hoạch xác định; kế hoạch mới bắt đủ giá (ProcurementPlanService).
    }

    /** Đề xuất đã nằm trong một kế hoạch thì không huỷ ngang được — phải rút khỏi kế hoạch trước. */
    @Override
    @Transactional
    public PurchaseProposal cancel(Long id, String note) {
        PurchaseProposal voucher = writable(id);
        lockAndReread(voucher);
        if (voucher.getPlan() != null) {
            throw new FieldValidationException("plan",
                    "Đề xuất đang nằm trong kế hoạch \"%s\" — cơ quan quản lý phải rút nó khỏi kế hoạch trước"
                            .formatted(voucher.getPlan().getTitle()));
        }
        return super.cancel(id, note);
    }

    /**
     * Một dòng của đề xuất khi nhập hàng: số đưa vào kế hoạch, số đã vào phiếu ghi tăng ({@code received}, gồm cả
     * {@code pending} — phần ở phiếu chưa hoàn tất, vẫn giữ chỗ), số còn phải nhập.
     */
    public record IntakeLine(Long lineId, Long catalogId, String catalogCode, String name, String unitName,
            int planned, int received, int remaining, BigDecimal unitPrice, int pending) {
    }

    /** Dòng chọn nhập đợt này. */
    public record IntakePick(Long lineId,
            @Num(value = NumberRule.QUANTITY_OR_ZERO, label = "Số lượng nhập") Integer quantity) {
    }

    /**
     * Các dòng của đề xuất với số còn phải nhập. Số đã nhập cộng từ các phiếu ghi tăng lập từ đề xuất này
     * theo THIẾT BỊ; hai dòng cùng thiết bị thì phần đã nhập trừ lần lượt từ dòng trên xuống.
     */
    public List<IntakeLine> intakeLines(Long id) {
        return intakeLines(get(id));
    }

    private List<IntakeLine> intakeLines(PurchaseProposal voucher) {
        Map<Long, Integer> received = new HashMap<>(intakes.receivedBySource(RESOURCE, voucher.getId()));
        // Phần đã HOÀN TẤT trừ trước, phần còn ở phiếu đang lập trừ sau — để dòng nào "đang lập" thì đúng dòng đó.
        Map<Long, Integer> pending = intakes.pendingBySource(RESOURCE, voucher.getId());
        Map<Long, Integer> completedLeft = new HashMap<>();
        received.forEach((catalog, total) -> completedLeft.put(catalog, total - pending.getOrDefault(catalog, 0)));
        List<IntakeLine> result = new ArrayList<>();
        for (PurchaseProposalLine l : voucher.getLines()) {
            int planned = l.effectiveQuantity();
            if (planned <= 0) {
                continue;
            }
            Long catalogId = l.getCatalog().getId();
            int got = Math.min(planned, received.getOrDefault(catalogId, 0));
            received.merge(catalogId, -got, Integer::sum);
            int done = Math.min(got, Math.max(0, completedLeft.getOrDefault(catalogId, 0)));
            completedLeft.merge(catalogId, -done, Integer::sum);
            result.add(new IntakeLine(l.getId(), catalogId, l.getCatalog().getCode(), l.getName(),
                    l.getUnitName() != null ? l.getUnitName()
                            : l.getCatalog().getUnit() != null ? l.getCatalog().getUnit().getName() : null,
                    planned, got, planned - got, l.effectiveUnitPrice(), got - done));
        }
        return result;
    }

    /**
     * Lập phiếu ghi tăng nháp từ đề xuất. Hàng về nhiều đợt: {@code picks} là các dòng và số nhập ĐỢT NÀY
     * (không quá số còn phải nhập); vắng thì nhập hết phần còn lại. Đề xuất còn lập được phiếu ghi tăng tiếp cho tới
     * khi mọi dòng đã nhập đủ.
     */
    @Transactional
    public EquipmentIntake createIntake(Long id, List<IntakePick> picks) {
        PurchaseProposal voucher = writable(id);
        lockAndReread(voucher);
        if (voucher.getStatus() != VoucherStatus.COMPLETED) {
            throw new FieldValidationException("status",
                    "Chỉ lập phiếu ghi tăng cho đề xuất đã vào kế hoạch được duyệt");
        }
        // Số ĐƯA VÀO KẾ HOẠCH (126), không phải số trường xin: dòng cơ quan bỏ (0) không thành dòng phiếu ghi tăng.
        List<IntakeLine> lines = intakeLines(voucher);
        List<PurchasedItem> items = new ArrayList<>();
        if (picks == null) {
            for (IntakeLine l : lines) {
                if (l.remaining() > 0) {
                    items.add(new PurchasedItem(l.catalogId(), l.name(), l.remaining(), l.unitPrice()));
                }
            }
        } else {
            Map<Long, IntakeLine> byId = new HashMap<>();
            lines.forEach(l -> byId.put(l.lineId(), l));
            for (IntakePick pick : picks) {
                IntakeLine l = pick == null ? null : byId.get(pick.lineId());
                if (l == null) {
                    throw new FieldValidationException("lines", "Dòng không thuộc đề xuất này");
                }
                int qty = pick.quantity() == null ? l.remaining() : pick.quantity();
                if (qty <= 0) {
                    continue;
                }
                if (qty > l.remaining()) {
                    throw new FieldValidationException("lines", "\"%s\" chỉ còn %d chưa nhập".formatted(l.name(), l.remaining()));
                }
                items.add(new PurchasedItem(l.catalogId(), l.name(), qty, l.unitPrice()));
            }
        }
        if (items.isEmpty()) {
            throw new FieldValidationException("lines", lines.stream().allMatch(l -> l.remaining() == 0)
                    ? "Đề xuất này đã nhập đủ hàng" : "Chọn ít nhất một thiết bị để nhập");
        }
        // Đơn vị giao mặc định (cấp trên mua tập trung): cơ quan lập kế hoạch.
        String deliveringUnit = voucher.getPlan() == null || voucher.getPlan().getManagingBody() == null ? null
                : voucher.getPlan().getManagingBody().getName();
        EquipmentIntake intake = intakes.createFromPurchase(voucher.getSchool().getId(), voucher.getFundingSource(),
                items, "Nhập hàng mua theo đề xuất " + voucher.getCode(), voucher.getId(), voucher.getCode(), deliveringUnit);
        if (voucher.getIntakeId() == null) {
            voucher.setIntakeId(intake.getId());
        }
        repository.persist(voucher);
        return intake;
    }

    /**
     * Không có "hoàn tất" — kế hoạch đóng đề xuất; "lập phiếu nhập" khi đề xuất
     * đã hoàn tất và chưa có phiếu nhập.
     */
    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(PurchaseProposal voucher, Map<String, Boolean> can, boolean canApprove) {
        Set<String> actions = new LinkedHashSet<>(super.actions(voucher, can, canApprove));
        actions.remove("complete");
        if (voucher.getPlan() != null) {
            actions.remove("cancel");
        }
        // Chưa có phiếu ghi tăng nào thì còn nhập được ngay; đã có thì xem còn thiết bị chưa nhập đủ không (chỉ
        // đề xuất đã hoàn tất và đã nhập một phần mới phải đếm — không tốn truy vấn cho mỗi dòng danh sách).
        if (voucher.getStatus() == VoucherStatus.COMPLETED && Boolean.TRUE.equals(can.get("write"))
                && (voucher.getIntakeId() == null || intakeLines(voucher).stream().anyMatch(l -> l.remaining() > 0))) {
            actions.add("intake");
        }
        return actions;
    }

    @Override
    @Transactional
    public PurchaseProposal complete(Long id, String note) {
        throw new FieldValidationException("status",
                "Đề xuất hoàn tất khi kế hoạch mua sắm chứa nó được duyệt, không hoàn tất bằng tay");
    }

    /**
     * Một thiết bị đang nằm trong một đề xuất khác của trường. {@code returned}: phiếu nháp bị trả
     * về. {@code code} trống với phiếu nháp chưa từng trình.
     */
    public record Overlap(Long catalogId, Long proposalId, String code, VoucherStatus status,
            ApprovalStep approvalStep, boolean returned, int quantity, String unitName) {
    }

    /** Đề xuất còn "đang xin": chưa bị từ chối / huỷ và hàng chưa về (chưa lập phiếu ghi tăng). */
    private static final Set<VoucherStatus> LIVE = Set.of(VoucherStatus.DRAFT, VoucherStatus.PENDING,
            VoucherStatus.APPROVED, VoucherStatus.COMPLETED);

    /**
     * Các thiết bị đang được xin ở những đề xuất CÒN HIỆU LỰC khác của một trường — để form và màn duyệt cảnh
     * báo xin trùng. Chỉ cảnh báo, không chặn: trường có lý do xin thêm (phiếu trước bị cắt số lượng…). Tính
     * cả phiếu nháp, vì hai bản nháp trùng nhau là đúng chỗ cột "Đề xuất" của bảng định mức không thấy. Đọc
     * qua phạm vi dòng như mọi lần đọc phiếu, nên Sở chỉ thấy đề xuất đã trình tới mình.
     */
    public List<Overlap> overlaps(Long schoolId, Long excludeId) {
        Specification<PurchaseProposal> spec = rowLevel.<PurchaseProposal>scope(PurchaseProposal.class,
                        com.g123.sfems.shared.security.rowlevel.Action.READ)
                .and(campusRead())
                .and((root, q, cb) -> cb.equal(root.get("school").get("id"), schoolId))
                .and((root, q, cb) -> root.get("status").in(LIVE))
                .and((root, q, cb) -> cb.isNull(root.get("intakeId")));
        if (excludeId != null) {
            spec = spec.and((root, q, cb) -> cb.notEqual(root.get("id"), excludeId));
        }
        List<Overlap> result = new ArrayList<>();
        for (PurchaseProposal p : repository.findAll(spec, org.springframework.data.domain.Sort.by("id"))) {
            for (PurchaseProposalLine line : p.getLines()) {
                result.add(new Overlap(line.getCatalog().getId(), p.getId(), p.getCode(), p.getStatus(),
                        p.getApprovalStep(), p.getStatus() == VoucherStatus.DRAFT && p.getReturnNote() != null,
                        line.getQuantity(), line.getUnitName()));
            }
        }
        return result;
    }

    @Override
    protected PurchaseProposal initialize(PurchaseProposal voucher) {
        voucher.getLines().size();
        if (voucher.getPlan() != null) {
            voucher.getPlan().getTitle();
        }
        return voucher;
    }

    @Override
    protected Specification<PurchaseProposal> filters(ListParams params) {
        List<Specification<PurchaseProposal>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            Specification<PurchaseProposal> spec = switch (c.field()) {
                case "proposalDate" -> VoucherSpecs.date("proposalDate", c);
                case "budgetYear" -> (root, q, cb) -> cb.equal(root.get("budgetYear"), Integer.valueOf(c.value()));
                case "plan.id" -> (root, q, cb) -> cb.equal(root.get("plan").get("id"), Long.valueOf(c.value()));
                case "unplanned" -> "true".equals(c.value())
                        ? (root, q, cb) -> cb.and(cb.isNull(root.get("plan")),
                                cb.equal(root.get("status"), VoucherStatus.APPROVED))
                        : null;
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }
        params.search().ifPresent(term -> specs.add((root, q, cb) -> cb.or(
                ListParams.foldedLike(cb, root.get("code"), term),
                ListParams.foldedLike(cb, root.get("reason"), term),
                ListParams.foldedLike(cb, root.get("school").get("name"), term))));
        return Specification.allOf(specs);
    }

    @Override
    protected Set<String> sortable() {
        return Set.of("id", "code", "status", "proposalDate", "budgetYear", "createdAt", "updatedAt");
    }

    private List<PurchaseProposalLine> buildLines(PurchaseProposal voucher, List<PurchaseProposalApi.LineInput> inputs) {
        List<PurchaseProposalLine> result = new ArrayList<>();
        if (inputs == null) {
            return result;
        }
        int lineNo = 1;
        for (PurchaseProposalApi.LineInput input : inputs) {
            if (input.catalog() == null || input.catalog().id() == null) {
                throw new FieldValidationException("lines", "Dòng %d: chưa chọn nhóm thiết bị".formatted(lineNo));
            }
            if (input.quantity() == null || input.quantity() <= 0) {
                throw new FieldValidationException("lines", "Dòng %d: số lượng phải lớn hơn 0".formatted(lineNo));
            }
            if (input.priority() != null && (input.priority() < 1 || input.priority() > 3)) {
                throw new FieldValidationException("lines", "Dòng %d: mức ưu tiên từ 1 đến 3".formatted(lineNo));
            }
            EquipmentCatalog catalog = catalogs.get(input.catalog().id());
            catalogs.requireOwnedBy(catalog, voucher.getSchool(), lineNo);
            PurchaseProposalLine line = new PurchaseProposalLine();
            line.setLineNo(lineNo);
            line.setKind(input.kind());
            line.setCatalog(catalog);
            String name = trimToNull(input.name());
            line.setName(name == null ? catalog.getName() : name);
            line.setSpecification(trimToNull(input.specification()));
            String unit = trimToNull(input.unitName());
            line.setUnitName(unit != null ? unit : catalog.getUnit() == null ? null : catalog.getUnit().getName());
            line.setQuantity(input.quantity());
            line.setUnitPrice(input.unitPrice());
            line.setPriority(input.priority());
            line.setNote(trimToNull(input.note()));
            line.setDetails(lineDetails(input.details(), voucher.getSchool(), lineNo));
            AdequacyService.Snapshot snapshot = adequacy.snapshot(voucher.getSchool().getId(), catalog.getId());
            line.setCurrentQuantity(snapshot.current());
            line.setRequiredQuantity(snapshot.required());
            result.add(line);
            lineNo++;
        }
        return result;
    }

    /** Phạm vi cơ sở: Đề xuất chỉ có danh mục — thuộc cơ sở chính. */
    @Override
    protected VoucherCampus.Shape campusShape() {
        return VoucherCampus.Shape.NONE;
    }
}
