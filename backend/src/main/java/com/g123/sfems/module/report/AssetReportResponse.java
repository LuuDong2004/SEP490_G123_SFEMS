package com.g123.sfems.module.report;

import java.math.BigDecimal;
import java.util.List;

/** Payload của BC-02: bộ lọc, các chỉ số và danh sách tài sản trong phạm vi người xem. */
public record AssetReportResponse(
        String scope,
        String fromDate,
        String toDate,
        Filters filters,
        Summary summary,
        long totalRows,
        boolean truncated,
        List<Row> rows) {

    public record Filters(List<Option> schools, List<Option> subjects, List<Option> equipmentTypes,
            List<Option> origins, List<Option> statuses) {}

    public record Option(Long id, String key, String label) {}

    public record Summary(BigDecimal quantity, BigDecimal originalValue, BigDecimal inUse,
            BigDecimal inStorage, BigDecimal broken, BigDecimal missing, BigDecimal recordedInPeriod) {}

    public record Row(Long id, String code, String name, String schoolName, String subjectName,
            String equipmentTypeName, String status, String statusLabel, String originName,
            String condition, BigDecimal quantity, BigDecimal originalValue, String receivedDate) {}
}
