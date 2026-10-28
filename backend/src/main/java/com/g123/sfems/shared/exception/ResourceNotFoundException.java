package com.g123.sfems.shared.exception;

import java.util.Map;

/** Raised when a resource is addressed by an id that does not exist. */
public class ResourceNotFoundException extends RuntimeException {

    /**
     * Tên loại bản ghi cho người dùng đọc. Nơi ném ngoại lệ truyền tên lớp ("EquipmentIntake") vì đó
     * là thứ nó có trong tay; câu trả lời thì tới thẳng màn hình, nên dịch ở MỘT chỗ này thay vì ở
     * hơn trăm chỗ ném. Tên chưa có trong bảng thì dùng câu chung, không lộ tên lớp Java.
     */
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("School", "trường"), Map.entry("User", "tài khoản"), Map.entry("Role", "vai trò"),
            Map.entry("Permission", "quyền"), Map.entry("DepartmentOfEducation", "cơ quan quản lý"),
            Map.entry("EducationLevel", "cấp học"), Map.entry("Attachment", "tệp đính kèm"),
            Map.entry("Subject", "môn học"), Map.entry("Staff", "cán bộ"), Map.entry("Room", "phòng"),
            Map.entry("Building", "khối nhà"), Map.entry("Campus", "cơ sở"), Map.entry("SchoolClass", "lớp học"),
            Map.entry("SubjectTeam", "tổ bộ môn"), Map.entry("FacilityWork", "hạng mục sửa chữa, cải tạo"),
            Map.entry("Equipment", "thiết bị"), Map.entry("EquipmentCatalog", "thiết bị trong danh mục"),
            Map.entry("EquipmentConfig", "bộ thông số"), Map.entry("EquipmentType", "loại thiết bị"),
            Map.entry("EquipmentStandard", "bộ tiêu chuẩn"), Map.entry("EquipmentNorm", "dòng định mức"),
            Map.entry("Unit", "đơn vị tính"), Map.entry("RoomType", "loại phòng"), Map.entry("Grade", "khối lớp"),
            Map.entry("SchoolYear", "năm học"), Map.entry("Semester", "học kỳ"), Map.entry("Ward", "phường, xã"),
            Map.entry("MaintenancePlan", "kế hoạch bảo trì"), Map.entry("Notification", "thông báo"),
            Map.entry("ApiClient", "khoá API"), Map.entry("Report", "báo cáo"),
            Map.entry("EquipmentIntake", "phiếu ghi tăng"), Map.entry("EquipmentAllocation", "phiếu cấp phát"),
            Map.entry("EquipmentTransfer", "phiếu điều chuyển"), Map.entry("EquipmentLoan", "phiếu mượn"),
            Map.entry("DamageReport", "phiếu báo hỏng"), Map.entry("RepairOrder", "phiếu sửa chữa"),
            Map.entry("WarrantyClaim", "phiếu bảo hành"), Map.entry("MaintenanceOrder", "phiếu bảo dưỡng"),
            Map.entry("StockIssue", "phiếu xuất kho"), Map.entry("StorageOrder", "phiếu lưu kho"),
            Map.entry("DepreciationOrder", "bảng tính hao mòn"), Map.entry("ConsumptionRecord", "phiếu ghi tiêu hao"),
            Map.entry("RoomBooking", "phiếu mượn phòng"), Map.entry("Disposal", "đề nghị thanh lý"),
            Map.entry("PurchaseProposal", "đề xuất mua sắm"), Map.entry("ProcurementPlan", "kế hoạch mua sắm"),
            Map.entry("InventorySession", "phiếu kiểm kê"), Map.entry("InventoryCampaign", "đợt kiểm kê"),
            Map.entry("RowLevelPolicy", "phạm vi dữ liệu"), Map.entry("Row-level policy", "phạm vi dữ liệu"));

    public ResourceNotFoundException(String resource, Object id) {
        super(message(resource, id));
    }

    private static String message(String resource, Object id) {
        String label = LABELS.get(resource);
        if (label == null) {
            // Nơi ném đã truyền sẵn tên tiếng Việt ("Trường") thì dùng luôn; tên lớp Java thì không.
            label = resource != null && resource.chars().anyMatch(c -> c > 127) ? resource.toLowerCase() : "bản ghi";
        }
        return "Không tìm thấy %s (mã số %s) — có thể đã bị xoá hoặc nằm ngoài phạm vi dữ liệu của bạn"
                .formatted(label, id);
    }
}
