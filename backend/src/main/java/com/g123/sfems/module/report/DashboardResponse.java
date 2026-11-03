package com.g123.sfems.module.report;

import java.util.List;

/** Dữ liệu bảng điều khiển BC-01. Khối nghiệp vụ để null cho tới khi các module nguồn được chuyển sang. */
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
            List<SchoolAttention> schoolsNeedingAttention) {}

    public record School(
            Devices devices,
            SchoolMinimumStandard minimumStandard,
            Integer pendingVouchers,
            SchoolInventory inventory) {}

    public record Devices(
            Integer total,
            Long originalValue,
            Integer inUse,
            Integer inStorage,
            Integer broken,
            Integer missing,
            Integer disposed) {}

    public record MinimumStandard(Integer schoolsMeeting, Integer schoolCount, Double rate) {}

    public record SchoolMinimumStandard(Integer met, Integer required, Double rate) {}

    public record ProcurementPlan(Integer year, String status, Long plannedValue) {}

    public record Inventory(String campaignName, Integer submittedSchools, Integer schoolCount, String dueDate) {}

    public record SchoolInventory(String campaignName, String dueDate, Boolean submitted) {}

    public record SchoolAttention(Long id, String name, String reason) {}
}
