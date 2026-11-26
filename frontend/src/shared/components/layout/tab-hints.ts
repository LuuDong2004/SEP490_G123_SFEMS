/**
 * Câu giải thích hiện khi rê chuột lên một tab (`module-tabs.tsx`). Một câu ngắn, nói tab đó chứa gì.
 * Cặp `[trường, quản lý]` khi hai góc nhìn thấy phạm vi khác nhau (một trường / cả địa bàn).
 * Tab không có ở đây thì tooltip hiện tên đầy đủ của tab.
 */
export const TAB_HINTS: Record<string, string | [school: string, management: string]> = {
  // Quy trình của mỗi phân hệ
  process_equipment: "Các bước quản lý thiết bị: ai lập, ai duyệt",
  process_procurement: "Các bước đề xuất và lập kế hoạch mua sắm",

  // Thiết bị
  equipment: ["Danh sách các thiết bị toàn trường", "Thiết bị hiện có của các trường trong địa bàn"],
  equipment_minimum: ["Thiết bị của trường so với danh mục tối thiểu", "Mức đáp ứng danh mục tối thiểu của từng trường"],
  equipment_intakes: "Phiếu nhập thiết bị mới vào hệ thống, cấp mã thiết bị",
  inventory_campaigns: "Đợt kiểm kê giao cho các trường, có hạn nộp",
  inventory_sessions: ["Biên bản kiểm kê thiết bị của trường", "Biên bản kiểm kê các trường đã nộp"],

  // Mua sắm
  equipment_adequacy: ["Thiết bị còn thiếu so với định mức", "Tổng hợp nhu cầu mua sắm của các trường"],
  purchase_proposals: ["Đề xuất mua thiết bị còn thiếu", "Đề xuất mua sắm các trường gửi lên"],
  procurement_plans: "Kế hoạch mua sắm gom từ các đề xuất đã duyệt",

  // Trường học (góc nhìn quản lý)
  school_explorer: "Số liệu tổng quan từng trường",
  departments_of_education: "Sở GD&ĐT quản lý trường",
  schools: "Danh sách trường trong địa bàn",

  // Danh mục chung — tổ chức
  education_levels: "Tiểu học, THCS, THPT",
  wards: "Phường, xã nơi trường đặt",
  room_types: "Phòng học, phòng bộ môn, sân, cổng…",
  facility_groups: "Khối phòng học tập, khối phụ trợ…",
  facility_standard_rules: "Tối thiểu, mức độ 1, mức độ 2 theo loại",
  // Năm học và môn học
  school_years: "Các năm học, ngày bắt đầu và kết thúc",
  grades: "Khối lớp 1 đến 12",
  subject_groups: "Tổ chuyên môn theo nhóm môn",
  subjects: "Môn học dùng cho thiết bị và tổ bộ môn",
  // Thiết bị
  equipment_catalogs: "Tất cả thiết bị trong danh mục chung",
  equipment_types: "Nhóm thiết bị: dùng chung, vật tư, hoá chất…",
  units: "Cái, bộ, chiếc, lít…",
  equipment_configs: "Thông số kỹ thuật theo từng thiết bị",
  equipment_standards: "Danh mục thiết bị tối thiểu theo thông tư",
  equipment_norms: "Số lượng tối thiểu từng thiết bị theo cấp, khối",
  // Tài chính, nghiệp vụ
  origin_sources: "Thiết bị từ đâu ra: kế hoạch mua sắm, được cấp phát, được tặng…",
  funding_sources: "Tiền từ đâu: ngân sách, học phí, tài trợ…",
  acquisition_methods: "Mua mới, tài trợ…",
  movement_reasons: "Lý do ghi tăng thiết bị",

  // Tổ chức của trường
  staff: "Cán bộ, giáo viên của trường",
  campuses: "Các điểm trường",
  buildings: "Khối nhà trong từng cơ sở",
  rooms: "Phòng học, phòng bộ môn, kho của trường",
  subject_teams: "Tổ bộ môn và thành viên",
  school_classes: "Lớp học theo năm học",
  students: "Học sinh theo lớp — sĩ số lớp tự đếm",

  // Báo cáo — tài sản
  report_equipment_by_school: "Số thiết bị theo từng trường",
  report_equipment_by_catalog: "Số lượng theo từng thiết bị trong danh mục",
  report_equipment_by_status: "Đang dùng, trong kho",
  report_equipment_by_condition: "Tốt, trung bình, kém",
  report_equipment_ledger: "Bảng theo dõi thiết bị để in",
  report_inventory: "Kết quả các đợt kiểm kê",
  // Cơ sở vật chất
  report_facilities: "Số phòng, khối nhà, diện tích",
  report_csvc_statistics: "Biểu số liệu theo mẫu Sở",
  report_room_standard: "Phòng bộ môn đạt chuẩn hay chưa",
  report_facility_standard: "Trường đạt chuẩn CSVC mức nào",
  report_idle_equipment: "Thiết bị nằm kho lâu không dùng",
  // Biến động, chứng từ
  report_movements: "Thiết bị tăng, giảm trong kỳ",
  report_vouchers: "Phiếu đang chờ duyệt, đã duyệt, bị trả lại",
  report_supply_expiry: "Vật tư, hoá chất sắp và đã hết hạn",
  // Mua sắm & định mức
  report_purchase: "Đề xuất, đã vào kế hoạch, đã nhập về",
  report_adequacy: "Mức đáp ứng danh mục tối thiểu",
  // Dữ liệu & lưu trữ
  report_data_quality: "Thiết bị thiếu thông tin hồ sơ",
  report_data_anomalies: "Số liệu lệch, trùng, bất thường",
  report_last_update: "Lần cập nhật dữ liệu gần nhất của từng trường",
  report_stale_schools: "Trường lâu chưa cập nhật dữ liệu",
  report_snapshots: "Báo cáo đã lưu lại để xem sau",

  // Quản trị — tài khoản & phân quyền
  users: "Tài khoản đăng nhập hệ thống",
  roles: "Vai trò và quyền của từng vai trò",
  permissions: "Danh sách quyền trên từng màn hình",
  row_level_policies: "Ai được xem, sửa dữ liệu của đơn vị nào",
  school_users: "Tài khoản thuộc trường",
  staff_accounts: "Tài khoản đăng nhập của cán bộ, giáo viên",
  // Cấu hình
  code_rules: "Cách sinh mã tự động cho danh mục chung",
  school_code_rules: "Cách sinh mã phòng, khối nhà, cán bộ của trường",
  approval_flows: "Ai duyệt từng loại phiếu, theo thứ tự nào",
  // Dữ liệu
  data_transfer: "Nhập, xuất dữ liệu bằng tệp",
  // Giám sát
  data_changes: "Giá trị cũ, mới của từng lần sửa dữ liệu",
};

export function tabHint(name: string, management: boolean): string | undefined {
  const h = TAB_HINTS[name];
  if (h === undefined) return undefined;
  return typeof h === "string" ? h : h[management ? 1 : 0];
}
