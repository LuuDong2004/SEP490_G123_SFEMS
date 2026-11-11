package com.g123.sfems.module.report;

import java.util.List;

/** Dữ liệu đã lọc trên màn hình, dùng để dựng tệp Excel và bản in báo cáo. */
public record ReportExportRequest(String filename, String title, String subtitle, List<Column> columns,
        List<List<Object>> rows) {
    public record Column(String label, String type) {}
}
