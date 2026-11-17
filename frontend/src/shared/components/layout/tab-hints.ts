/**
 * Câu giải thích hiện khi rê chuột lên một tab (`module-tabs.tsx`). Một câu ngắn, nói tab đó chứa gì.
 * Cặp `[trường, quản lý]` khi hai góc nhìn thấy phạm vi khác nhau (một trường / cả địa bàn).
 * Tab không có ở đây thì tooltip hiện tên đầy đủ của tab.
 */
export const TAB_HINTS: Record<string, string | [school: string, management: string]> = {
  // Quy trình của mỗi phân hệ
  process_equipment: "Các bước quản lý thiết bị: ai lập, ai duyệt",
  process_usage: "Các bước cấp phát, điều chuyển, tiêu hao: ai lập, ai duyệt",
  process_loans: "Các bước mượn trả thiết bị và phòng",
  process_maintenance: "Các bước báo hỏng, sửa chữa, bảo hành, bảo trì",
  process_procurement: "Các bước đề xuất và lập kế hoạch mua sắm",

  // Thiết bị
  equipment: ["Danh sách các thiết bị toàn trường", "Thiết bị hiện có của các trường trong địa bàn"],
  equipment_minimum: ["Thiết bị của trường so với danh mục tối thiểu", "Mức đáp ứng danh mục tối thiểu của từng trường"],
  standard_adjustments: "Đề nghị điều chỉnh chuẩn tối thiểu của các trường",
  equipment_intakes: "Phiếu nhập thiết bị mới vào hệ thống, cấp mã thiết bị",
  inventory_campaigns: "Đợt kiểm kê giao cho các trường, có hạn nộp",
  inventory_sessions: ["Biên bản kiểm kê thiết bị của trường", "Biên bản kiểm kê các trường đã nộp"],
  disposals: ["Thanh lý, tiêu huỷ, ghi giảm thiết bị mất", "Đề nghị ghi giảm của các trường chờ duyệt"],

  // Cấp phát & sử dụng
  equipment_allocations: "Giao thiết bị cho phòng, người quản lý trong trường",
  equipment_transfers: ["Chuyển thiết bị sang trường khác", "Điều chuyển thiết bị giữa các trường"],
  consumption_records: "Ghi vật tư, hoá chất đã dùng, trừ tồn kho",

  // Mượn trả
  equipment_loans: "Ghi giáo viên mượn và trả thiết bị",
  room_bookings: "Ghi mượn phòng theo tiết, buổi",

  // Sửa chữa & bảo trì
  damage_reports: "Ghi nhận thiết bị hỏng",
  repair_orders: "Phiếu sửa chữa, bảo trì và kết quả",
  warranty_claims: "Gửi bảo hành và kết quả bảo hành",
  maintenance_plans: "Lịch bảo trì định kỳ của từng thiết bị",
  facility_works: "Sửa chữa, cải tạo phòng, khối nhà",

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
  semesters: "Học kỳ trong năm học",
  grades: "Khối lớp 1 đến 12",
  subject_groups: "Tổ chuyên môn theo nhóm môn",
  subjects: "Môn học dùng cho thiết bị và tổ bộ môn",
  // Thiết bị
  standard_adjustment_rules: "Thiết bị nào trường được đề nghị điều chỉnh chuẩn",
  equipment_catalogs: "Tất cả thiết bị trong danh mục chung",
  equipment_types: "Nhóm thiết bị: dùng chung, vật tư, hoá chất…",
  units: "Cái, bộ, chiếc, lít…",
  equipment_configs: "Thông số kỹ thuật theo từng thiết bị",
  equipment_standards: "Danh mục thiết bị tối thiểu theo thông tư",
  equipment_norms: "Số lượng tối thiểu từng thiết bị theo cấp, khối",
  // Tài chính, nghiệp vụ
  origin_sources: "Thiết bị từ đâu ra: kế hoạch mua sắm, được điều chuyển, được tặng…",
  funding_sources: "Tiền từ đâu: ngân sách, học phí, tài trợ…",
  acquisition_methods: "Mua mới, tài trợ, điều chuyển đến…",
  movement_reasons: "Lý do khi thiết bị tăng, giảm, điều chuyển",

  // Tổ chức của trường
  staff: "Cán bộ, giáo viên của trường",
  campuses: "Các điểm trường",
  buildings: "Khối nhà trong từng cơ sở",
  rooms: "Phòng học, phòng bộ môn, kho của trường",
  subject_teams: "Tổ bộ môn và thành viên",
  school_classes: "Lớp học theo năm học",

  // Báo cáo — tài sản
  report_equipment_by_school: "Số thiết bị theo từng trường",
  report_equipment_by_catalog: "Số lượng theo từng thiết bị trong danh mục",
  report_equipment_by_status: "Đang dùng, trong kho, đang mượn, hỏng…",
  report_equipment_by_condition: "Tốt, hỏng, cần sửa…",
  report_equipment_list: "Danh sách thiết bị lọc theo trạng thái",
  report_equipment_ledger: "Bảng theo dõi thiết bị để in",
  report_inventory: "Kết quả các đợt kiểm kê",
  // Cơ sở vật chất
  report_facilities: "Số phòng, khối nhà, diện tích",
  report_csvc_statistics: "Biểu số liệu theo mẫu Sở",
  report_room_usage: "Phòng được mượn bao nhiêu lần",
  report_room_standard: "Phòng bộ môn đạt chuẩn hay chưa",
  report_facility_standard: "Trường đạt chuẩn CSVC mức nào",
  // Hư hỏng & bảo trì
  report_broken_equipment: "Thiết bị hỏng, mất, cần thay thế",
  report_unused_equipment: "Thiết bị không còn dùng được",
  report_idle_equipment: "Thiết bị nằm kho lâu không dùng",
  report_damage_trends: "Số hỏng theo thời gian",
  report_maintenance: "Số lần sửa chữa, bảo trì",
  // Biến động & mượn trả
  report_movements: "Thiết bị tăng, giảm trong kỳ",
  report_transfers: "Thiết bị đã chuyển giữa phòng, trường",
  report_overdue_loans: "Thiết bị mượn chưa trả đúng hạn",
  report_loans: "Số lượt mượn trả",
  report_utilization: "Thiết bị được dùng nhiều hay ít",
  report_vouchers: "Phiếu đang chờ duyệt, đã duyệt, bị trả lại",
  report_disposals: "Thiết bị đã thanh lý, tiêu huỷ, ghi giảm",
  report_supply_consumption: "Vật tư, hoá chất đã dùng",
  report_supply_expiry: "Vật tư, hoá chất sắp và đã hết hạn",
  // Mua sắm & định mức
  report_purchase: "Thiết bị cần mua theo đề xuất",
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
  ai_settings: "Kết nối AI dùng khi nhập dữ liệu",
  // Tích hợp
  api_clients: "Khoá cho hệ thống ngoài gọi API",
  integrations: "Kết nối với hệ thống của Bộ, Sở",
  data_transfer: "Nhập, xuất dữ liệu bằng tệp",
  // Giám sát
  system_status: "Máy chủ, CSDL, bộ lưu tệp đang chạy ra sao",
  activity_logs: "Ai đã làm gì, lúc nào",
  data_changes: "Giá trị cũ, mới của từng lần sửa dữ liệu",
};

export function tabHint(name: string, management: boolean): string | undefined {
  const h = TAB_HINTS[name];
  if (h === undefined) return undefined;
  return typeof h === "string" ? h : h[management ? 1 : 0];
}
