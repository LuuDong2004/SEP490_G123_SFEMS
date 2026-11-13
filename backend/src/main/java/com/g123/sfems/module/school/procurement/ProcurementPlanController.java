package com.g123.sfems.module.school.procurement;

import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.school.procurement.ProcurementPlan;
import com.g123.sfems.domain.school.procurement.PurchaseProposal;
import com.g123.sfems.domain.school.procurement.PurchaseProposalLine;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/procurement_plans} — kế hoạch mua sắm của UBND / Sở (NC-05, NC-06). Ngoài hợp đồng data
 * provider:
 *
 * <ul>
 *   <li>{@code GET /summary?year=&body=} — tổng hợp đề xuất theo cơ quan và nhóm thiết bị,</li>
 *   <li>{@code GET /{id}/candidates} — đề xuất đã duyệt, chưa vào kế hoạch nào,</li>
 *   <li>{@code GET /candidates} — như trên cho kế hoạch CHƯA LƯU,</li>
 *   <li>{@code PUT /{id}/proposals} — thay tập đề xuất trong kế hoạch nháp,</li>
 *   <li>{@code POST /{id}/submit|approve|return}.</li>
 * </ul>
 *
 * <p>Bản gốc còn {@code GET /{id}/export.xlsx}. Repo nhóm chưa có {@code shared/office/XlsxWriter} (là
 * {@code shared/**}), nên phần xuất tệp làm sau khi nhóm có bộ ghi dùng chung.
 *
 * <p>Trường {@code details} của bản gốc bỏ khỏi payload và DTO: cần {@code VoucherForms} cùng cột JSONB,
 * cả hai ngoài vùng này.
 */
@RestController
@RequestMapping("/api/procurement_plans")
public class ProcurementPlanController {

    /** {@code lines} có mặt thì THAY tập dòng của kế hoạch — xem {@link ProcurementPlanService.Input}. */
    public record Request(IdRef managingBody,
            @Size(max = 255, message = "Tên kế hoạch tối đa 255 ký tự") String title,
            @Min(value = 1950, message = "Năm ngân sách phải từ 1950 đến 2100")
            @Max(value = 2100, message = "Năm ngân sách phải từ 1950 đến 2100") Integer budgetYear,
            IdRef schoolYear,
            LocalDate planDate,
            @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự") String note,
            @Valid List<ProcurementPlanService.LineQuantity> lines) {
    }

    /**
     * Một dòng thiết bị của một đề xuất trong kế hoạch: số trường đề nghị, số đưa vào kế hoạch và thành tiền
     * theo số đưa vào kế hoạch.
     */
    public record PlanLine(Long lineId, Long proposalId, String proposalCode, RefSummary school, Integer lineNo,
            RefSummary catalog, String name, String specification, String unitName, int requestedQuantity,
            int plannedQuantity, BigDecimal unitPrice, BigDecimal amount, Integer priority) {

        static PlanLine of(PurchaseProposal p, PurchaseProposalLine l) {
            var c = l.getCatalog();
            int effective = l.effectiveQuantity();
            BigDecimal amount = l.getUnitPrice() == null ? BigDecimal.ZERO
                    : l.getUnitPrice().multiply(BigDecimal.valueOf(effective));
            return new PlanLine(l.getId(), p.getId(), p.getCode(), ref(p.getSchool()), l.getLineNo(),
                    new RefSummary(c.getId(), c.getCode(), c.getName()), l.getName(), l.getSpecification(),
                    l.getUnitName(), l.getQuantity() == null ? 0 : l.getQuantity(), effective,
                    l.getUnitPrice(), amount, l.getPriority());
        }

        private static RefSummary ref(com.g123.sfems.domain.organization.School school) {
            return school == null ? null : new RefSummary(school.getId(), school.getCode(), school.getName());
        }
    }

    public record ProposalIds(List<Long> ids) {
    }

    public record NoteRequest(@Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note) {
    }

    public record ProposalRow(Long id, String code, RefSummary school, String status, Integer budgetYear,
            String reason, int lineCount, int totalQuantity, BigDecimal totalAmount) {

        static ProposalRow of(PurchaseProposal p) {
            int total = p.getLines().stream().mapToInt(l -> l.getQuantity() == null ? 0 : l.getQuantity()).sum();
            return new ProposalRow(p.getId(), p.getCode(), PlanLine.ref(p.getSchool()), p.getStatus().name(),
                    p.getBudgetYear(), p.getReason(), p.getLines().size(), total, p.totalAmount());
        }
    }

    /** {@code name} lặp lại {@code title} cho ô chọn tham chiếu dùng chung. */
    public record Response(Long id, String code, RefSummary managingBody, String title, String name,
            Integer budgetYear, RefSummary schoolYear, LocalDate planDate, String status, String note,
            Instant approvedAt, String approvalNote, Instant createdAt, Instant updatedAt, RefSummary createdBy,
            List<ProposalRow> proposals, List<PlanLine> lines, List<ProcurementPlanService.CatalogTotal> totals,
            BigDecimal totalAmount, Integer proposalCount,
            @JsonProperty("_can") Map<String, Boolean> can, @JsonProperty("_actions") Set<String> actions) {
    }

    private final ProcurementPlanService service;
    private final UserService users;

    public ProcurementPlanController(ProcurementPlanService service, UserService users) {
        this.service = service;
        this.users = users;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('procurement_plans:read')")
    public ResponseEntity<List<Response>> list(@RequestParam MultiValueMap<String, String> query) {
        Page<ProcurementPlan> page = service.list(new ListParams(query));
        return ListResponse.of(page.getContent().stream().map(p -> respond(p, null)).toList(),
                page.getTotalElements());
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('procurement_plans:read') or hasAuthority('purchase_proposals:read')")
    public ProcurementPlanService.Summary summary(@RequestParam(required = false) Integer year,
            @RequestParam(required = false) Long body) {
        return service.summary(year, body);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('procurement_plans:read')")
    public Response get(@PathVariable Long id) {
        return respond(service.get(id), service.detail(id));
    }

    /** Đề xuất chờ vào kế hoạch, kèm các dòng thiết bị — chọn đề xuất là các dòng của nó hiện ngay trên bảng. */
    public record Candidate(ProposalRow proposal, List<PlanLine> lines) {

        static Candidate of(PurchaseProposal p) {
            return new Candidate(ProposalRow.of(p), p.getLines().stream().map(l -> PlanLine.of(p, l)).toList());
        }
    }

    @GetMapping("/{id}/candidates")
    @PreAuthorize("hasAuthority('procurement_plans:write')")
    public List<Candidate> candidates(@PathVariable Long id) {
        return service.candidates(id).stream().map(Candidate::of).toList();
    }

    /** Đề xuất chờ vào kế hoạch cho kế hoạch CHƯA LƯU (màn lập); {@code body} chỉ có nghĩa với quản trị viên. */
    @GetMapping("/candidates")
    @PreAuthorize("hasAuthority('procurement_plans:write')")
    public List<Candidate> candidatesForNew(@RequestParam(required = false) Long body) {
        return service.candidatesForNew(body).stream().map(Candidate::of).toList();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('procurement_plans:write')")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        ProcurementPlan created = service.create(input(request));
        return ResponseEntity.created(URI.create("/api/procurement_plans/" + created.getId()))
                .body(respond(created, null));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('procurement_plans:write')")
    public Response update(@PathVariable Long id, @Valid @RequestBody Request request) {
        service.update(id, input(request));
        return respond(service.get(id), service.detail(id));
    }

    @PutMapping("/{id}/proposals")
    @PreAuthorize("hasAuthority('procurement_plans:write')")
    public Response setProposals(@PathVariable Long id, @Valid @RequestBody ProposalIds request) {
        service.setProposals(id, request.ids());
        return respond(service.get(id), service.detail(id));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('procurement_plans:write')")
    public Response submit(@PathVariable Long id) {
        service.submit(id);
        return respond(service.get(id), service.detail(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('procurement_plans:approve')")
    public Response approve(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        service.approve(id, request == null ? null : request.note());
        return respond(service.get(id), service.detail(id));
    }

    @PostMapping("/{id}/return")
    @PreAuthorize("hasAuthority('procurement_plans:approve')")
    public Response returnToDraft(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        service.returnToDraft(id, request == null ? null : request.note());
        return respond(service.get(id), service.detail(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('procurement_plans:delete')")
    public Response delete(@PathVariable Long id) {
        return respond(service.delete(id), null);
    }

    private static ProcurementPlanService.Input input(Request r) {
        return new ProcurementPlanService.Input(r.managingBody() == null ? null : r.managingBody().id(), r.title(),
                r.budgetYear(), r.schoolYear() == null ? null : r.schoolYear().id(), r.planDate(), r.note(),
                r.lines());
    }

    private Response respond(ProcurementPlan p, ProcurementPlanService.Detail detail) {
        var body = p.getManagingBody();
        Set<String> actions = service.actions(p);
        boolean draft = p.getStatus() == ProcurementPlan.Status.DRAFT;
        Map<String, Boolean> can = Map.of(
                "write", draft && actions.contains("edit"),
                "delete", draft && actions.contains("delete") && CurrentUser.has("procurement_plans:delete"));
        List<PlanLine> lines = null;
        if (detail != null) {
            lines = new ArrayList<>();
            for (PurchaseProposal proposal : detail.proposals()) {
                for (PurchaseProposalLine line : proposal.getLines()) {
                    lines.add(PlanLine.of(proposal, line));
                }
            }
        }
        return new Response(p.getId(), p.getCode(), new RefSummary(body.getId(), body.getCode(), body.getName()),
                p.getTitle(), p.getTitle(), p.getBudgetYear(), RefSummary.of(p.getSchoolYear()), p.getPlanDate(),
                p.getStatus().name(), p.getNote(),
                p.getApprovedAt(), p.getApprovalNote(), p.getCreatedAt(), p.getUpdatedAt(),
                detail == null ? null : creator(p.getCreatedById()),
                detail == null ? null : detail.proposals().stream().map(ProposalRow::of).toList(),
                lines,
                detail == null ? null : detail.totals(),
                detail == null ? null : detail.totalAmount(),
                detail == null ? null : detail.proposals().size(),
                can, actions);
    }

    /** Người lập kế hoạch — tên đăng nhập và họ tên; {@code null} nếu tài khoản đã bị xoá. */
    private RefSummary creator(Long userId) {
        if (userId == null) {
            return null;
        }
        for (User user : users.getMany(List.of(userId))) {
            return new RefSummary(user.getId(), user.getUsername(),
                    user.getFullName() != null ? user.getFullName() : user.getUsername());
        }
        return null;
    }
}
