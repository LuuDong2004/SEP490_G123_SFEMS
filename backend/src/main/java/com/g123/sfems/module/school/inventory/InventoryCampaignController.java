package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import com.g123.sfems.shared.validation.DateRange;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/inventory_campaigns} — đợt kiểm kê; thêm {@code GET /{id}/progress} tiến độ theo trường,
 * {@code GET /{id}/discrepancies} chênh lệch theo trường. */
@RestController
@RequestMapping("/api/inventory_campaigns")
public class InventoryCampaignController {

    @DateRange(from = "cutoffDate", to = "deadline", message = "Ngày kết thúc không được trước ngày hiệu lực")
    public record Request(IdRef managingBody, IdRef schoolYear,
            @Text(value = FieldRule.NAME, label = "Tên đợt kiểm kê") String title,
            @Text(value = FieldRule.SHORT_TEXT, label = "Số công văn", max = 100) String documentNo,
            @DateValue(value = DateRule.ANY, label = "Ngày hiệu lực") LocalDate cutoffDate,
            @DateValue(value = DateRule.ANY, label = "Ngày kết thúc") LocalDate deadline,
            @Text(value = FieldRule.LONG_TEXT, label = "Nội dung", max = 1000) String note,
            Boolean closed) {
    }

    /** {@code name} lặp lại {@code title} để ô chọn tham chiếu dùng chung (hiển thị theo "name") đọc được. */
    public record Response(Long id, RefSummary managingBody, RefSummary schoolYear, String title, String name,
            String documentNo, LocalDate cutoffDate,
            LocalDate deadline,
            String note, boolean closed, boolean overdue, Instant createdAt,
            String status, String approvalNote, Instant submittedAt, Instant approvedAt,
            @JsonProperty("_can") Map<String, Boolean> can) {
    }

    private final InventoryCampaignService service;
    private final InventoryDiscrepancies discrepancies;

    public InventoryCampaignController(InventoryCampaignService service, InventoryDiscrepancies discrepancies) {
        this.service = service;
        this.discrepancies = discrepancies;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('inventory_campaigns:read')")
    public ResponseEntity<List<Response>> list(@RequestParam MultiValueMap<String, String> query) {
        Page<InventoryCampaign> page = service.list(new ListParams(query));
        return ListResponse.of(page.getContent().stream().map(this::respond).toList(), page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory_campaigns:read')")
    public Response get(@PathVariable Long id) {
        return respond(service.get(id));
    }

    @GetMapping("/{id}/progress")
    @PreAuthorize("hasAuthority('inventory_campaigns:read')")
    public InventoryCampaignService.Progress progress(@PathVariable Long id) {
        return service.progress(id);
    }

    /** Chênh lệch theo trường — số của biên bản người xem mở được (cần cả quyền đọc phiếu kiểm kê). */
    @GetMapping("/{id}/discrepancies")
    @PreAuthorize("hasAuthority('inventory_campaigns:read') and hasAuthority('inventory_sessions:read')")
    public List<InventoryDiscrepancies.SchoolRow> discrepancies(@PathVariable Long id) {
        return discrepancies.campaign(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('inventory_campaigns:write')")
    public ResponseEntity<Response> create(@Valid @RequestBody Request request) {
        InventoryCampaign created = service.create(input(request));
        return ResponseEntity.created(URI.create("/api/inventory_campaigns/" + created.getId())).body(respond(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('inventory_campaigns:write')")
    public Response update(@PathVariable Long id, @Valid @RequestBody Request request) {
        return respond(service.update(id, input(request)));
    }

    /** Ý kiến khi duyệt (không bắt buộc) hoặc lý do trả lại (bắt buộc). */
    public record NoteRequest(@Text(value = FieldRule.NOTE, label = "Ý kiến", max = 500) String note) {
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('inventory_campaigns:write')")
    public Response submit(@PathVariable Long id) {
        return respond(service.submit(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('inventory_campaigns:approve')")
    public Response approve(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        return respond(service.approve(id, request == null ? null : request.note()));
    }

    @PostMapping("/{id}/return")
    @PreAuthorize("hasAuthority('inventory_campaigns:approve')")
    public Response returnToDraft(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        return respond(service.returnToDraft(id, request == null ? null : request.note()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory_campaigns:delete')")
    public Response delete(@PathVariable Long id) {
        return respond(service.delete(id));
    }

    private static InventoryCampaignService.Input input(Request r) {
        return new InventoryCampaignService.Input(r.managingBody() == null ? null : r.managingBody().id(),
                r.schoolYear() == null ? null : r.schoolYear().id(), r.title(), r.documentNo(), r.cutoffDate(), r.deadline(), r.note(),
                r.closed());
    }

    private Response respond(InventoryCampaign c) {
        var body = c.getManagingBody();
        // Nút theo trạng thái duyệt (308): nháp thì sửa / xoá / trình; chờ duyệt thì lãnh đạo duyệt / trả lại.
        var actions = service.actions(c);
        var year = c.getSchoolYear();
        return new Response(c.getId(), new RefSummary(body.getId(), body.getCode(), body.getName()),
                year == null ? null : new RefSummary(year.getId(), year.getCode(), year.getName()), c.getTitle(),
                c.getTitle(), c.getDocumentNo(), c.getCutoffDate(), c.getDeadline(), c.getNote(), c.isClosed(),
                !c.isClosed() && c.getDeadline().isBefore(LocalDate.now()), c.getCreatedAt(),
                c.getStatus().name(), c.getApprovalNote(), c.getSubmittedAt(), c.getApprovedAt(),
                Map.of("write", actions.contains("write"), "delete", actions.contains("delete"),
                        "submit", actions.contains("submit"), "approve", actions.contains("approve")));
    }
}
