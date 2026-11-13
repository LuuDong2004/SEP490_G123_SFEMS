package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.school.voucher.VoucherService;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.module.school.voucher.VoucherSpecs;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đề xuất mua sắm (NC-02..NC-04). Vòng đời:
 *
 * <pre>
 * Nháp → Chờ duyệt (lãnh đạo trường → cơ quan quản lý) → Đã duyệt
 *      → [vào kế hoạch của cơ quan quản lý, kế hoạch được duyệt] → Hoàn tất
 *      → [hàng về] Lập phiếu nhập
 * </pre>
 *
 * <p>Đề xuất KHÔNG tự hoàn tất: không có nút "hoàn tất" nào trên nó. Có tiền hay không là quyết định của
 * kế hoạch, và chỉ {@link ProcurementPlanService} đóng nó lại. Làm khác đi thì trường tự ghi "đã được cấp"
 * cho thứ chưa ai duyệt chi.
 *
 * <p>Phần trình / duyệt / trả lại / từ chối / huỷ lấy nguyên từ {@link VoucherService}: đề xuất là một
 * loại phiếu như phiếu nhập và phiếu kiểm kê, chỉ khác hình payload và luật riêng.
 *
 * <p><b>NC-07 chưa nối:</b> "lập phiếu nhập từ đề xuất" cần hai hàm của {@code EquipmentIntakeService}
 * ({@code receivedBySource}, {@code createFromPurchase}) và {@code record PurchasedItem} — cả ba có trong
 * repo nguồn nhưng chưa có trong bản của nhóm, và {@code module/school/intake} là vùng của DongLV. Hành
 * động {@code intake} trên đề xuất, đường {@code /{id}/intake-lines} và {@code POST /{id}/intake} làm
 * ngay khi ba thứ đó có.
 */
@Service
public class PurchaseProposalService
        extends VoucherService<PurchaseProposal, PurchaseProposalApi.Request, PurchaseProposalApi.Patch> {

    public static final String RESOURCE = "purchase_proposals";

    private final EquipmentCatalogService catalogs;
    private final AdequacyService adequacy;

    public PurchaseProposalService(VoucherServiceDeps deps, PurchaseProposalRepository repository,
            EquipmentCatalogService catalogs, AdequacyService adequacy) {
        super(deps, repository, PurchaseProposal.class, PurchaseProposal::new);
        this.catalogs = catalogs;
        this.adequacy = adequacy;
    }

    // ------------------------------------------------------------------ ghi

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

    // ------------------------------------------------------------------ luật

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

    /** Không có "hoàn tất" bằng tay: kế hoạch đóng đề xuất. */
    @Override
    @Transactional
    public PurchaseProposal complete(Long id, String note) {
        throw new FieldValidationException("status",
                "Đề xuất hoàn tất khi kế hoạch mua sắm chứa nó được duyệt, không hoàn tất bằng tay");
    }

    /**
     * Các nút bấm được trên một đề xuất. Không có "hoàn tất"; đang nằm trong kế hoạch thì không huỷ. Còn
     * hàng chưa nhập thì có "intake" — lập phiếu ghi tăng.
     */
    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(PurchaseProposal voucher, Map<String, Boolean> can, boolean canApprove) {
        Set<String> actions = new LinkedHashSet<>(super.actions(voucher, can, canApprove));
        actions.remove("complete");
        if (voucher.getPlan() != null) {
            actions.remove("cancel");
        }
        // Chưa có phiếu ghi tăng nào thì còn nhập được ngay; đã có thì xem còn thiết bị chưa nhập đủ không
        // (chỉ đề xuất đã hoàn tất và đã nhập một phần mới phải đếm — không tốn truy vấn cho mỗi dòng danh sách).
        // Hành động "intake" (lập phiếu nhập) chờ NC-07: cần bộ đếm số đã nhập của EquipmentIntakeService.
        return actions;
    }

    // ------------------------------------------------------------------ xin trùng

    /** Đề xuất còn "đang xin": chưa bị từ chối / huỷ và hàng chưa về (chưa lập phiếu ghi tăng). */
    private static final Set<VoucherStatus> LIVE = Set.of(VoucherStatus.DRAFT, VoucherStatus.PENDING,
            VoucherStatus.APPROVED, VoucherStatus.COMPLETED);

    /**
     * Các thiết bị đang được xin ở những đề xuất CÒN HIỆU LỰC khác của một trường — để form và màn duyệt
     * cảnh báo xin trùng. Chỉ cảnh báo, không chặn: trường có lý do xin thêm (phiếu trước bị cắt số lượng…).
     * Tính cả phiếu nháp. Đọc qua phạm vi dòng như mọi lần đọc phiếu, nên Sở / UBND chỉ thấy đề xuất đã
     * trình tới mình.
     */
    public List<Overlap> overlaps(Long schoolId, Long excludeId) {
        Specification<PurchaseProposal> spec = rowLevel.<PurchaseProposal>scope(PurchaseProposal.class,
                        com.g123.sfems.shared.security.rowlevel.Action.READ)
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

    /**
     * Một thiết bị đang nằm trong một đề xuất khác của trường. {@code returned}: phiếu nháp bị trả về.
     * {@code code} trống với phiếu nháp chưa từng trình.
     */
    public record Overlap(Long catalogId, Long proposalId, String code, VoucherStatus status,
            ApprovalStep approvalStep, boolean returned, int quantity, String unitName) {
    }

    // ------------------------------------------------------------------ đọc

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

    // ------------------------------------------------------------------ nội bộ

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
            AdequacyService.Snapshot snapshot = adequacy.snapshot(voucher.getSchool().getId(), catalog.getId());
            line.setCurrentQuantity(snapshot.current());
            line.setRequiredQuantity(snapshot.required());
            result.add(line);
            lineNo++;
        }
        return result;
    }
}
