package com.g123.sfems.module.school.inventory;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
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

/** {@code /api/inventory_campaigns} — đợt kiểm kê do Sở phát động (KK-01). */
@RestController
@RequestMapping("/api/inventory_campaigns")
public class InventoryCampaignController {

    public record Request(
            IdRef managingBody,
            @Size(max = 255, message = "Tên đợt kiểm kê tối đa 255 ký tự") String title,
            LocalDate cutoffDate,
            LocalDate deadline,
            @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự") String note,
            Boolean closed) {
    }

    /**
     * {@code name} lặp lại {@code title} để ô chọn tham chiếu dùng chung (hiển thị theo "name") đọc được.
     * {@code overdue}: đợt còn mở mà đã quá hạn nộp.
     */
    public record Response(Long id, RefSummary managingBody, String title, String name, LocalDate cutoffDate,
            LocalDate deadline, String note, boolean closed, boolean overdue, Instant createdAt,
            @JsonProperty("_can") Map<String, Boolean> can) {
    }

    private final InventoryCampaignService service;

    public InventoryCampaignController(InventoryCampaignService service) {
        this.service = service;
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

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory_campaigns:delete')")
    public Response delete(@PathVariable Long id) {
        return respond(service.delete(id));
    }

    private static InventoryCampaignService.Input input(Request r) {
        return new InventoryCampaignService.Input(r.managingBody() == null ? null : r.managingBody().id(), r.title(),
                r.cutoffDate(), r.deadline(), r.note(), r.closed());
    }

    private Response respond(InventoryCampaign campaign) {
        var body = campaign.getManagingBody();
        boolean manage = service.canManage(campaign);
        return new Response(campaign.getId(), new RefSummary(body.getId(), body.getCode(), body.getName()),
                campaign.getTitle(), campaign.getTitle(), campaign.getCutoffDate(), campaign.getDeadline(),
                campaign.getNote(), campaign.isClosed(),
                !campaign.isClosed() && campaign.getDeadline().isBefore(LocalDate.now()), campaign.getCreatedAt(),
                Map.of("write", manage, "delete", manage));
    }
}
