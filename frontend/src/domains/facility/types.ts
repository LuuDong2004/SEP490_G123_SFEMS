/** Cơ sở vật chất (khối nhà, phòng): hiện trạng và tình trạng sử dụng. */

export const CONDITION_LABELS: Record<string, string> = {
  TOT: "Tốt",
  BINH_THUONG: "Bình thường",
  CAN_SUA_CHUA: "Cần sửa chữa",
  XUONG_CAP: "Xuống cấp",
  HU_HONG_NANG: "Hư hỏng nặng",
};

/** Loại việc làm trên một công trình (sổ sửa chữa, cải tạo — `facility_works`). */
export const FACILITY_WORK_TYPE_LABELS: Record<string, string> = {
  REPAIR: "Sửa chữa",
  RENOVATION: "Cải tạo",
  UPGRADE: "Nâng cấp",
  MAINTENANCE: "Bảo trì",
};

/**
 * Nguồn kinh phí của một lần SỬA CHỮA (QLTB-471, QLTB-476) — `RepairFunding` ở máy chủ. Sổ sửa chữa công
 * trình và "Nguồn kinh phí sửa chữa" của phiếu sửa chữa dùng chung ba mã này.
 */
export const REPAIR_FUNDING_LABELS: Record<string, string> = {
  STATE_BUDGET: "Ngân sách chi thường xuyên",
  SCHOOL_REVENUE: "Nguồn thu hợp pháp của trường",
  OTHER: "Nguồn khác",
};

export const USAGE_STATUS_LABELS: Record<string, string> = {
  DANG_SU_DUNG: "Đang sử dụng",
  BO_TRONG: "Bỏ trống",
  DANG_SUA_CHUA: "Đang sửa chữa",
  NGUNG_SU_DUNG: "Ngừng sử dụng",
};
