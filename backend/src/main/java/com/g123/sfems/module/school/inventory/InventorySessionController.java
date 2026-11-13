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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/inventory_sessions} — phiếu kiểm kê. Năm endpoint của danh sách / xem / lập / sửa / xoá và
 * các bước của vòng duyệt có sẵn từ {@link VoucherController}; thêm {@code POST /{id}/count} ghi kết quả
 * kiểm đếm, {@code GET /{id}/breakdown} chênh lệch theo phòng / môn và {@code GET /active} các phiếu đang khoá
 * số liệu của trường, {@code GET/POST /{id}/follow-ups} lập nhanh phiếu xử lý chênh lệch sau khi duyệt.
 */
@RestController
@RequestMapping("/api/inventory_sessions")
public class InventorySessionController
        extends VoucherController<InventorySession, InventorySessionApi.Request, InventorySessionApi.Patch> {

    private final InventorySessionService sessions;
    private final InventoryDiscrepancies discrepancies;

    public InventorySessionController(InventorySessionService service, RowLevelSecurity rowLevel,
            InventoryDiscrepancies discrepancies) {
        super(service, rowLevel);
        this.sessions = service;
        this.discrepancies = discrepancies;
    }

    /** Phiếu kiểm kê đang khoá số liệu của trường mình — không gắn đường dẫn tới phiếu nháp không đọc được. */
    @GetMapping("/active")
    public List<InventorySessionService.ActiveInventory> active() {
        require("read");
        return sessions.activeForMySchool();
    }

    /** Biên bản đã duyệt: mỗi nhóm chênh lệch còn bao nhiêu dòng chưa có phiếu xử lý. */
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

    /** Chênh lệch của biên bản theo phòng và theo môn học của thiết bị. */
    @GetMapping("/{id}/breakdown")
    public InventoryDiscrepancies.SessionBreakdown breakdown(@PathVariable Long id) {
        require("read");
        return discrepancies.session(id);
    }

    /** Ghi kết quả kiểm đếm cho một hoặc nhiều dòng của phiếu nháp. */
    @PostMapping("/{id}/count")
    public Object count(@PathVariable Long id, @Valid @RequestBody InventorySessionApi.Count request) {
        require("write");
        return respond(sessions.count(id, request));
    }

    @Override
    protected Object toResponse(InventorySession voucher, Map<String, Boolean> can, Set<String> actions) {
        return InventorySessionApi.Response.from(voucher, can, actions);
    }

    /** Dòng danh sách: số tóm tắt đếm bằng SQL, không nạp các dòng của biên bản. */
    @Override
    protected Object toListResponse(InventorySession voucher, Map<String, Boolean> can, Set<String> actions) {
        InventorySessionApi.Summary summary = sessions.summaries(List.of(voucher.getId())).get(voucher.getId());
        return InventorySessionApi.Response.listRow(voucher, can, actions, summary);
    }
}
