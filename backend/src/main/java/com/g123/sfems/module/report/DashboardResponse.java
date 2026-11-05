package com.g123.sfems.module.report;

import java.util.List;

/** Dữ liệu bảng điều khiển BC-01 theo phạm vi xem và năm học được chọn. */
public record DashboardResponse(
        String scope,
        String schoolName,
        List<SchoolYear> schoolYears,
        Long selectedSchoolYearId,
        City city,
        School school) {

    public record SchoolYear(Long id, String label) {}

    public record City(
            Devices devices,
            MinimumStandard minimumStandard,
            Integer proposalsAwaitingDepartmentApproval,
            ProcurementPlan procurementPlan,
            Inventory inventory,
            List<SchoolAttention> schoolsNeedingAttention,
            List<StatusCount> statuses,
            List<Month> months,
            List<PendingTask> pendingByType) {}

    public record School(
            Devices devices,
            SchoolMinimumStandard minimumStandard,
            Integer pendingVouchers,
            SchoolInventory inventory,
            List<StatusCount> statuses,
            List<StatusCount> vouchers,
            List<Month> months,
            List<PendingTask> pendingByType) {}

    public record Devices(
            Integer total,
            Long originalValue,
            Integer inUse,
            Integer inStorage,
            Integer broken,
            Integer missing,
            Integer disposed,
            Integer pendingLiquidation) {}

    public record MinimumStandard(Integer schoolsMeeting, Integer schoolCount, Double rate) {}

    public record SchoolMinimumStandard(Integer met, Integer required, Double rate) {}

    public record ProcurementPlan(Integer year, String status, Long plannedValue) {}

    public record Inventory(String campaignName, Integer submittedSchools, Integer schoolCount, String dueDate) {}

    public record SchoolInventory(String campaignName, String dueDate, Boolean submitted) {}

    public record SchoolAttention(Long id, String name, String reason, Integer equipment,
            Integer broken, Integer missing, Integer pending) {}

    public record StatusCount(String key, String label, Integer count) {}

    public record Month(String month, Integer intake, Integer allocation, Integer damage, Integer disposal) {}

    public record PendingTask(String key, String label, Integer count) {}
}
