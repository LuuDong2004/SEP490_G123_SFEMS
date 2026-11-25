package com.g123.sfems.module.school.equipment.history;

import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.module.school.equipment.EquipmentService;
import java.time.Instant;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/equipment/{id}/history} — lịch sử một tài sản, mới nhất trước.
 *
 * <p>Đọc thiết bị qua {@link EquipmentService#get} trước, để phạm vi dữ liệu của
 * thiết bị quyết định: không đọc được tài sản thì cũng không đọc được lịch sử của
 * nó, và câu trả lời là 404 như với chính tài sản.
 */
@RestController
@RequestMapping("/api/equipment")
public class EquipmentHistoryController {

    public record HistoryResponse(
            Long id,
            EquipmentHistory.Action action,
            String field,
            String fromValue,
            String toValue,
            String voucherResource,
            Long voucherId,
            String voucherCode,
            String note,
            String actorName,
            Instant createdAt) {

        static HistoryResponse from(EquipmentHistory row) {
            return new HistoryResponse(row.getId(), row.getAction(), row.getField(), row.getFromValue(),
                    row.getToValue(), row.getVoucherResource(), row.getVoucherId(), row.getVoucherCode(),
                    row.getNote(), row.getActorName(), row.getCreatedAt());
        }
    }

    private final EquipmentService equipment;
    private final EquipmentHistoryService history;

    public EquipmentHistoryController(EquipmentService equipment, EquipmentHistoryService history) {
        this.equipment = equipment;
        this.history = history;
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('equipment:read')")
    public List<HistoryResponse> history(@PathVariable Long id) {
        equipment.get(id);
        return history.of(id).stream().map(HistoryResponse::from).toList();
    }
}
