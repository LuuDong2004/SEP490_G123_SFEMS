package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.module.school.voucher.VoucherController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/inventory_sessions} — phiếu kiểm kê; thêm {@code POST /{id}/count} ghi kết quả kiểm đếm,
 * {@code GET/POST /{id}/follow-ups} lập nhanh phiếu xử lý chênh lệch sau khi duyệt,
 * {@code GET /{id}/breakdown} chênh lệch theo phòng / môn. */
@RestController
@RequestMapping("/api/inventory_sessions")
public class InventorySessionController
        extends VoucherController<InventorySession, InventorySessionApi.Request, InventorySessionApi.Patch> {

    private final InventorySessionService sessions;
    private final InventoryDiscrepancies discrepancies;
    private final InventoryFacilityService facilities;

    public InventorySessionController(InventorySessionService service, RowLevelSecurity rowLevel,
            InventoryDiscrepancies discrepancies, InventoryFacilityService facilities) {
        super(service, rowLevel);
        this.sessions = service;
        this.discrepancies = discrepancies;
        this.facilities = facilities;
    }

    /** Hạng mục CSVC của biên bản: khối nhà, phòng / hạng mục, kết cấu và hiện trạng sổ → thực tế. */
    @GetMapping("/{id}/facility-lines")
    public InventoryFacilityApi.Lines facilityLines(@PathVariable Long id) {
        require("read");
        return facilities.list(id);
    }

    /** Lập / bổ sung danh sách hạng mục theo phạm vi phiếu — phiếu còn nháp. */
    @PostMapping("/{id}/facility-lines/generate")
    public InventoryFacilityApi.Lines generateFacilityLines(@PathVariable Long id) {
        require("write");
        return facilities.generate(id);
    }

    @PutMapping("/{id}/facility-lines/{lineId}")
    public InventoryFacilityApi.Lines updateFacilityLine(@PathVariable Long id, @PathVariable Long lineId,
            @Valid @RequestBody InventoryFacilityApi.LineUpdate request) {
        require("write");
        return facilities.update(id, lineId, request);
    }

    /** Biên bản đã duyệt: ghi kết cấu / hiện trạng thấy thực tế vào hồ sơ CSVC . */
    @PostMapping("/{id}/facility-lines/apply")
    public InventoryFacilityApi.Applied applyFacilityLines(@PathVariable Long id) {
        require("read");
        return facilities.apply(id);
    }

    /** Show the school's active locks without linking to drafts the caller cannot read. */
    @GetMapping("/active")
    public List<InventorySessionService.ActiveInventory> active() {
        require("read");
        return sessions.activeForMySchool();
    }

    /** Chênh lệch của biên bản theo phòng và theo môn học của thiết bị. */
    @GetMapping("/{id}/breakdown")
    public InventoryDiscrepancies.SessionBreakdown breakdown(@PathVariable Long id) {
        require("read");
        return discrepancies.session(id);
    }

    @PostMapping("/{id}/count")
    public Object count(@PathVariable Long id, @Valid @RequestBody InventorySessionApi.Count request) {
        require("write");
        return respond(sessions.count(id, request));
    }

    /** Biên bản đã duyệt: mỗi nhóm chênh lệch còn bao nhiêu tài sản chưa có phiếu xử lý. */
    @GetMapping("/{id}/follow-ups")
    public List<InventorySessionService.FollowUpState> followUps(@PathVariable Long id) {
        require("read");
        return sessions.followUps(id);
    }

    /** Lập nhanh phiếu nháp xử lý một nhóm chênh lệch — cần quyền ghi của loại phiếu được lập. */
    @PostMapping("/{id}/follow-ups")
    public InventorySessionService.FollowUpResult followUp(@PathVariable Long id,
            @RequestParam InventorySessionService.FollowUp kind) {
        require("read");
        String code = kind.resource() + ":write";
        if (!CurrentUser.has(code)) {
            throw new AccessDeniedException(code);
        }
        return sessions.followUp(id, kind);
    }

    /** Danh sách đếm số tóm tắt bằng một câu SQL cho cả trang, không nạp dòng nào của biên bản. */
    @Override
    protected List<Object> listRows(List<InventorySession> vouchers) {
        Map<Long, InventorySessionApi.Summary> summaries =
                sessions.summaries(vouchers.stream().map(InventorySession::getId).toList());
        return vouchers.stream()
                .map(v -> withoutLines(respond(v, (session, can, actions) ->
                        InventorySessionApi.Response.listRow(session, can, actions, summaries.get(session.getId())))))
                .toList();
    }

    @Override
    protected Object toResponse(InventorySession voucher, Map<String, Boolean> can, Set<String> actions) {
        return InventorySessionApi.Response.from(voucher, can, actions);
    }
}
