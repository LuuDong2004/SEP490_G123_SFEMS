package com.g123.sfems.module.report;

/** Bộ lọc BC-06; backend tự tải lại dữ liệu theo đúng phạm vi quyền của người dùng. */
public record ReportExportQuery(String report, String search, String fromDate, String toDate, Long schoolId,
        Long subjectId, Long equipmentTypeId, String status, Long originId, Integer year, Long equipmentId,
        Long campaignId, Long gradeId) {}
