/** Bảng điều khiển và báo cáo (`/api/reports`). */

export type DashboardLevel = "CITY" | "BODY" | "SCHOOL" | "NONE";

export type Dashboard = {
  level: DashboardLevel;
  scope: string;
  kpis: {
    schools: number;
    equipment: number;
    originalValue: number;
    inUse: number;
    broken: number;
    missing: number;
    pendingLiquidation: number;
    pendingVouchers: number;
    /** Tính trên các trường đã nhập thiết bị (`adequacySchools`), không phải mọi trường trong phạm vi. */
    adequacyPercent: number;
    adequacySchools: number;
  };
  statuses: { key: string; label: string; count: number }[];
  pending: { key: string; label: string; count: number }[];
  months: { month: string; intake: number; allocation: number; damage: number; disposal: number }[];
  attention: { id: number; name: string; equipment: number; broken: number; missing: number; pending: number }[];
  /** Kỳ của ô "tình trạng xử lý phiếu": month | quarter | year | all. */
  period: string;
  /** Số phiếu lập trong kỳ, theo trạng thái. */
  vouchers: { key: string; label: string; count: number }[];
  days: number;
  /** Phiếu lập ra / hoàn tất theo ngày. */
  daily: { date: string; created: number; completed: number }[];
  /** Tình trạng kỹ thuật của tài sản còn trên sổ. */
  conditions: { key: string; label: string; count: number }[];
  /** Phiếu chờ duyệt theo nơi đang phải duyệt: SCHOOL (lãnh đạo trường), UBND, SO. */
  waitingAt: { key: string; label: string; count: number }[];
};

/**
 * Trạng thái tài sản gộp thành 5 nhóm cho biểu đồ cơ cấu — mười trạng thái thì mười màu,
 * không mắt nào đọc nổi. Đã thanh lý và mất đã ra khỏi sổ nên không đếm.
 */
export const ASSET_STATUS_GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "use", label: "Đang sử dụng", statuses: ["IN_USE"] },
  { key: "stock", label: "Trong kho", statuses: ["IN_STOCK"] },
  { key: "broken", label: "Hỏng, chờ xử lý", statuses: ["BROKEN", "UNREPAIRABLE", "REPAIRING", "WARRANTY"] },
];

export type ReportDefinition = {
  name: string;
  title: string;
  description: string;
  /** Báo cáo theo kỳ: nhận `from`, `to`. */
  period: boolean;
  /** Báo cáo theo năm ngân sách: nhận `year`. */
  year: boolean;
  /** Các chiều tổng hợp chọn được (tham số `group`); rỗng là báo cáo có một hình cố định. Phần tử đầu là mặc định. */
  groups: { key: string; label: string }[];
  /** Ô chọn riêng của báo cáo (tham số `choice`) — vd. trạng thái ở danh sách thiết bị; rỗng là không có. */
  choices: { key: string; label: string }[];
  /**
   * Bộ lọc theo tài sản báo cáo nhận: `type` (tham số `typeId`, chọn từ danh mục loại thiết bị), `status`,
   * `condition` (danh sách cố định ở `options`). Rỗng là báo cáo không lọc theo tài sản.
   */
  filters: ReportAssetFilter[];
};

export type ReportAssetFilter = {
  key: "type" | "status" | "condition";
  label: string;
  options: { key: string; label: string }[];
};

export type ReportColumnType = "text" | "number" | "money" | "date";

export type Report = {
  name: string;
  title: string;
  subtitle: string;
  columns: { key: string; label: string; type: ReportColumnType }[];
  rows: Record<string, string | number | null>[];
  /** Số của dòng "Tổng" cho cột không cộng dồn được (vd. số người khác nhau); cột vắng ở đây thì cộng các dòng. */
  totals?: Record<string, number>;
};

/**
 * Báo cáo trên menu — mỗi báo cáo một mục, đường dẫn `/reports/<name>`, resource
 * `report_<name>` (mượn quyền `reports:read`, xem `shared/lib/permissions.ts`).
 * `name` phải khớp tên báo cáo của `/api/reports`.
 */
export const REPORT_MENU: { name: string; resource: string; label: string; title: string }[] = [
  { name: "equipment-by-school", resource: "report_equipment_by_school", label: "Tổng hợp thiết bị", title: "Tổng hợp thiết bị" },
  { name: "equipment-by-catalog", resource: "report_equipment_by_catalog", label: "Thiết bị theo danh mục", title: "Tổng hợp thiết bị theo danh mục" },
  { name: "equipment-by-status", resource: "report_equipment_by_status", label: "Theo trạng thái sử dụng", title: "Thiết bị theo trạng thái sử dụng" },
  { name: "equipment-by-condition", resource: "report_equipment_by_condition", label: "Theo tình trạng kỹ thuật", title: "Thiết bị theo tình trạng kỹ thuật" },
  { name: "equipment-list", resource: "report_equipment_list", label: "Danh sách theo trạng thái", title: "Danh sách thiết bị theo trạng thái" },
  { name: "facilities", resource: "report_facilities", label: "Cơ sở vật chất", title: "Tổng hợp cơ sở vật chất" },
  { name: "csvc-statistics", resource: "report_csvc_statistics", label: "Biểu số liệu CSVC", title: "Biểu số liệu cơ sở vật chất" },
  { name: "equipment-ledger", resource: "report_equipment_ledger", label: "Bảng theo dõi thiết bị", title: "Bảng theo dõi thiết bị" },
  { name: "facility-standard", resource: "report_facility_standard", label: "Mức độ chuẩn CSVC", title: "Đánh giá mức độ chuẩn CSVC" },
  { name: "room-standard", resource: "report_room_standard", label: "Chuẩn phòng bộ môn", title: "Đánh giá chuẩn phòng bộ môn" },
  { name: "broken-equipment", resource: "report_broken_equipment", label: "Hư hỏng, mất, cần thay thế", title: "Thiết bị hư hỏng, mất, cần thay thế" },
  { name: "supply-expiry", resource: "report_supply_expiry", label: "Hoá chất, vật tư hết hạn", title: "Hoá chất, vật tư hết hạn" },
  { name: "unused-equipment", resource: "report_unused_equipment", label: "Không còn sử dụng", title: "Thiết bị không còn sử dụng" },
  { name: "idle-equipment", resource: "report_idle_equipment", label: "Nằm kho kéo dài", title: "Thiết bị nằm kho kéo dài" },
  { name: "inventory", resource: "report_inventory", label: "Kết quả kiểm kê", title: "Kết quả kiểm kê" },
  { name: "movements", resource: "report_movements", label: "Tăng, giảm thiết bị", title: "Tăng, giảm thiết bị" },
  { name: "purchase", resource: "report_purchase", label: "Nhu cầu mua sắm", title: "Tổng hợp nhu cầu mua sắm" },
  { name: "adequacy", resource: "report_adequacy", label: "Đáp ứng danh mục tối thiểu", title: "Mức đáp ứng danh mục thiết bị tối thiểu" },
  { name: "data-quality", resource: "report_data_quality", label: "Chất lượng dữ liệu", title: "Chất lượng dữ liệu theo trường" },
  { name: "data-anomalies", resource: "report_data_anomalies", label: "Dữ liệu bất thường", title: "Thiết bị có dữ liệu bất thường" },
  { name: "last-update", resource: "report_last_update", label: "Thời điểm cập nhật", title: "Thời điểm cập nhật dữ liệu của đơn vị" },
  { name: "stale-schools", resource: "report_stale_schools", label: "Đơn vị chưa cập nhật", title: "Đơn vị chưa cập nhật dữ liệu" },
  { name: "vouchers", resource: "report_vouchers", label: "Tình hình xử lý chứng từ", title: "Tình hình xử lý chứng từ" },
];
