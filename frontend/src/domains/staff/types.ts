/** Cán bộ, giáo viên: loại nhân sự và chức vụ (cùng danh mục cố định "Chức vụ"). */

export const STAFF_TYPE_LABELS: Record<string, string> = {
  teacher: "Giáo viên",
  staff: "Cán bộ",
};

/** Cùng danh sách với danh mục cố định "Chức vụ" (backend `StaffPosition`). */
export const POSITION_LABELS: Record<string, string> = {
  HIEU_TRUONG: "Hiệu trưởng",
  PHO_HIEU_TRUONG: "Phó hiệu trưởng",
  TO_TRUONG: "Tổ trưởng chuyên môn",
  GIAO_VIEN: "Giáo viên",
  CAN_BO_THIET_BI: "Cán bộ thiết bị",
  NHAN_VIEN_THU_VIEN: "Nhân viên thư viện",
  KE_TOAN: "Kế toán",
  THU_KHO: "Thủ kho",
  VAN_THU: "Văn thư",
  NHAN_VIEN: "Nhân viên",
  KHAC: "Khác",
};

/** Chức vụ lãnh đạo: quyết định vai mặc định khi cấp tài khoản (`StaffAccountService.defaultRole`). */
export const LEADERSHIP_POSITIONS: ReadonlySet<string> = new Set(["HIEU_TRUONG", "PHO_HIEU_TRUONG"]);

/**
 * Chức vụ của người đứng lớp: giáo viên và tổ trưởng chuyên môn. Loại = Giáo viên chỉ mang chức vụ
 * ở đây; Loại = Cán bộ không mang chức vụ nào ở đây (tổ trưởng phải chọn từ danh sách giáo viên,
 * nên cán bộ mang chức vụ này không bao giờ làm được tổ trưởng).
 */
export const TEACHING_POSITIONS: ReadonlySet<string> = new Set(["GIAO_VIEN", "TO_TRUONG"]);

/**
 * Chức vụ một người được phép đặt, theo Loại (`staffType`) và quyền của người đặt.
 *
 * - Hiệu trưởng / Phó hiệu trưởng: không ràng buộc theo Loại (vẫn có thể đứng lớp), chỉ dành cho
 *   người có quyền quản lý chức vụ lãnh đạo (`staff:assign_leadership`) — máy chủ cũng chặn.
 * - Còn lại: Giáo viên → chức vụ đứng lớp; Cán bộ → chức vụ không đứng lớp.
 *
 * `keep` là chức vụ hồ sơ ĐANG mang: luôn giữ trong danh sách, nếu không ô chọn hiện như trống.
 */
export function assignablePositions(
  mayAssignLeadership: boolean,
  staffType?: string | null,
  keep?: string | null,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(POSITION_LABELS).filter(([code]) => {
      if (code === keep) return true;
      if (LEADERSHIP_POSITIONS.has(code)) return mayAssignLeadership;
      if (!staffType) return true;
      return TEACHING_POSITIONS.has(code) === (staffType === "teacher");
    }),
  );
}
