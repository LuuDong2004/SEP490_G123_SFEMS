package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import java.time.Instant;

/** Một dòng lịch sử, dạng đọc được: nhãn tiếng Việt do frontend ghép từ {@code action} và {@code field}. */
public record EquipmentHistoryResponse(
        Long id,
        String action,
        String field,
        String fromValue,
        String toValue,
        String voucherResource,
        Long voucherId,
        String voucherCode,
        String note,
        String actorName,
        Instant createdAt) {

    public static EquipmentHistoryResponse from(EquipmentHistory row) {
        return new EquipmentHistoryResponse(
                row.getId(),
                row.getAction().name(),
                row.getField(),
                row.getFromValue(),
                row.getToValue(),
                row.getVoucherResource(),
                row.getVoucherId(),
                row.getVoucherCode(),
                row.getNote(),
                row.getActorName(),
                row.getCreatedAt());
    }
}
