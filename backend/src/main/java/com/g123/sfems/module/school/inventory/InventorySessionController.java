package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.module.school.voucher.VoucherController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/inventory_sessions} — phiếu kiểm kê. Năm endpoint của danh sách / xem / lập / sửa / xoá và
 * các bước của vòng duyệt có sẵn từ {@link VoucherController}; thêm {@code POST /{id}/count} ghi kết quả
 * kiểm đếm.
 */
@RestController
@RequestMapping("/api/inventory_sessions")
public class InventorySessionController
        extends VoucherController<InventorySession, InventorySessionApi.Request, InventorySessionApi.Patch> {

    private final InventorySessionService sessions;

    public InventorySessionController(InventorySessionService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
        this.sessions = service;
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
