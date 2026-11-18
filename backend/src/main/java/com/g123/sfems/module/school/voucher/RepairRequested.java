package com.g123.sfems.module.school.voucher;

import java.math.BigDecimal;
import java.util.List;

/**
 * Phiếu báo hỏng được duyệt với cách xử lý "sửa" hoặc "bảo hành": phiếu sửa chữa
 * / phiếu bảo hành lập một phiếu NHÁP từ đó. Cùng lý do với
 * {@link EquipmentIncident}: báo hỏng có trước, sửa chữa và bảo hành dựa vào nó,
 * không phải ngược lại — nên là sự kiện, không phải lời gọi service. Listener
 * chạy đồng bộ trong cùng giao dịch.
 */
public record RepairRequested(
        Kind kind,
        Long schoolId,
        List<Long> equipmentIds,
        String source,
        Long sourceId,
        String sourceCode,
        String description,
        String vendor,
        BigDecimal estimatedCost,
        boolean outsourced) {

    public enum Kind {
        REPAIR,
        WARRANTY
    }
}
