/**
 * Kiểm kê (KK-01 – KK-07). Khớp với phản hồi của `module/school/inventory` ở backend.
 */

/** Tham chiếu rút gọn (id, mã, tên). */
export type InventoryRef = {
  id: number;
  code: string;
  name: string;
};

/** Đợt kiểm kê do Sở phát động. */
export type InventoryCampaign = {
  id: number;
  managingBody: InventoryRef;
  title: string;
  /** Lặp lại `title` để ô chọn tham chiếu dùng chung đọc được. */
  name: string;
  /** Ngày chốt số liệu, dạng "2026-12-31". */
  cutoffDate: string;
  /** Hạn các trường nộp biên bản. */
  deadline: string;
  note: string | null;
  closed: boolean;
  /** Đợt còn mở mà đã quá hạn nộp. */
  overdue: boolean;
  createdAt: string;
  /** Người đang đăng nhập được sửa, xoá đợt này không. */
  _can?: { write?: boolean; delete?: boolean };
};
