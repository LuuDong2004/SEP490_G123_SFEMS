package com.g123.sfems.module.report;

import java.math.BigDecimal;
import java.util.List;

/** Payload BC-05: tổng hợp kết quả kiểm kê trong phạm vi người xem được phép. */
public record InventoryReportResponse(String scope, Filters filters, Summary summary, List<Row> rows) {
    public record Option(Long id, String label) {}

    public record Filters(List<Option> campaigns, List<Option> schools) {}

    public record Summary(int sessions, BigDecimal bookQuantity, BigDecimal matchedQuantity,
            BigDecimal shortageQuantity, BigDecimal surplusQuantity, BigDecimal damagedQuantity,
            BigDecimal wrongLocationQuantity, BigDecimal discrepancyValue) {}

    public record Row(Long id, String code, String campaign, String school, String inventoryDate,
            String status, String statusLabel, BigDecimal bookQuantity, BigDecimal matchedQuantity,
            BigDecimal shortageQuantity, BigDecimal surplusQuantity, BigDecimal damagedQuantity,
            BigDecimal wrongLocationQuantity, BigDecimal discrepancyValue) {}
}
