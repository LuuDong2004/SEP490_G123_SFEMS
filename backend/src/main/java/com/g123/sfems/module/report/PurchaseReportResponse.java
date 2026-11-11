package com.g123.sfems.module.report;

import java.math.BigDecimal;
import java.util.List;

public record PurchaseReportResponse(String scope, Filters filters, Summary summary, List<Row> rows) {
    public record Option(String key, String label) {}
    public record Filters(List<Option> schools, List<Option> years, List<Option> equipment, List<Option> statuses) {}
    public record Summary(long proposals, long pending, long approved, long planned,
            BigDecimal quantity, BigDecimal receivedQuantity, BigDecimal amount, BigDecimal approvedAmount) {}
    public record Row(String key, String name, long schools, long proposals, long pending, long approved,
            long planned, BigDecimal quantity, BigDecimal receivedQuantity, BigDecimal amount, BigDecimal approvedAmount) {}
}
